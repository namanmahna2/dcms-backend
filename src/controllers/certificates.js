const mute = require("immutable");
const path = require("path");
const moment = require("moment");
const fs = require("fs");
const { ethers } = require("ethers");
const crypto = require("crypto");
const axios = require("axios")

// MODELS + SERVICES
const student_model = require("../models/pgsql/students");
const { renderCertificateNoQR } = require("../utils/certificateWithNoQR");
const { renderCertificateWithQR } = require("../utils/certificatesRender");
const { issueDegree, revokeDegree_ } = require("./common");
const { uploadFileToPinata, uploadJSONToPinata } = require("../services/ipfs");
const ano_detection_queue = require("../utils/queues/anamoly_detection");
const { contract } = require("../blockchain/certificates");


const responseStruct = new mute.Map({
    signature: "",
    status: null,
    message: "",
    data: null,
    success: false
})

const generate_degree = async (data, response, cb) => {
    if (!cb) cb = response;

    try {
        let student_details = await student_model.get_by_id({ id: data.student_id });
        student_details = student_details.rows[0];

        if (!student_details) {
            return cb(
                responseStruct.merge({
                    signature: "sign11",
                    status: 404,
                    success: false,
                    message: "Student not found"
                }).toJS()
            );
        }

        const studentName = `${student_details.first_name} ${student_details.last_name}`;
        const issue_date_formatted = moment().format("DD MMMM YYYY");
        const issueDateISO = new Date().toISOString();

        const nextTokenIdBN = await contract.currentTokenId();
        const tokenId = Number(nextTokenIdBN);

        const baseVerifyUrl = process.env.VERIFY_BASE_URL || "127.0.0.1:3011";
        const verifyUrl = `${baseVerifyUrl}/cr/v1/verify/${tokenId}`;

        const universityWallet = process.env.UNI_WALLET_PUBLIC_Ganache;

        // BUILD VC METADATA (BEFORE QR)
        const metadataPartial = {
            "@context": [
                "https://www.w3.org/2018/credentials/v1",
                "https://dcms.org/schema/degree-v1"
            ],
            type: ["VerifiableCredential", "DegreeCredential"],

            id: `did:dcms:token:${tokenId}`,

            issuer: {
                id: "did:dcms:university:coventry",
                name: student_details.uni,
                wallet: universityWallet,
                issuedDate: issueDateISO
            },

            credentialSubject: {
                id: `did:dcms:student:${student_details.id}`,
                studentName,
                course: student_details.course_name,
                degree: student_details.course_name,
                tokenId,
                walletAddress: student_details.wallet_address
            },

            blockchain: {
                network: "Ganache",
                contract: contract.target
            },

            verification: {
                verifyUrl
            }
        };

        // HASH METADATA BEFORE SIGNING
        const metadataBufferTemp = Buffer.from(JSON.stringify(metadataPartial));
        const metadataHashPreImage = crypto.createHash("sha256")
            .update(metadataBufferTemp)
            .digest("hex");

        metadataPartial.credentialSubject.metadataHash = metadataHashPreImage;

        // SIGN METADATA
        const stringToSign = JSON.stringify({
            issuer: metadataPartial.issuer,
            credentialSubject: metadataPartial.credentialSubject,
            blockchain: metadataPartial.blockchain,
            issuedAt: issueDateISO
        });

        const signer = new ethers.Wallet(process.env.GANACHE_PRIVATE_KEY);

        // HASH THE STRING INTO RAW BYTES
        const messageHash = ethers.sha256(ethers.toUtf8Bytes(stringToSign));

        // Convert hex → Uint8Array
        const messageBytes = ethers.getBytes(messageHash);

        // SIGN RAW HASH BYTES
        const signature = await signer.signMessage(messageBytes);

        metadataPartial.proof = {
            type: "EcdsaSecp256k1Signature2020",
            created: issueDateISO,
            verificationMethod: universityWallet,
            proofPurpose: "assertionMethod",
            signature
        };

        const qrPayload = {
            tokenId,
            studentWallet: student_details.wallet_address,
            issuerWallet: universityWallet,
            metadataHash: metadataHashPreImage,
            signature,
            verifyUrl
        };
        const imageBuffer = await renderCertificateWithQR({
            studentName,
            degreeName: student_details.course_name,
            issuerName: student_details.uni,
            issueDate: issue_date_formatted,
            ownerName: student_details.owner_name,
            qrPayload
        });

        // SAVE TEMP FILE FOR PINATA
        const tempFilePath = `/tmp/certificate_${Date.now()}.jpg`;
        fs.writeFileSync(tempFilePath, imageBuffer);

        // UPLOAD FILE PATH TO PINATA
        const finalImageCID = await uploadFileToPinata(
            tempFilePath,
            `certificate_${studentName.replace(/\s+/g, "_")}.jpg`
        );

        // DELETE TEMP FILE
        fs.unlinkSync(tempFilePath);

        const imageHash = crypto.createHash("sha256")
            .update(imageBuffer)
            .digest("hex");

        metadataPartial.credentialSubject.imageCID = finalImageCID;
        metadataPartial.credentialSubject.imageHash = imageHash;


        const finalMetadataCID = await uploadJSONToPinata(
            metadataPartial,
            `${student_details.first_name}-metadata-vc`
        );

        let degreeReceipt = await issueDegree(student_details, finalMetadataCID);
        degreeReceipt = degreeReceipt.data;

        const transactionHash = degreeReceipt.hash;

        await student_model.update_by_stuID(
            {
                student: {
                    degree_token_id: degreeReceipt.tokenIdMinted,
                    tx_hash: transactionHash,
                    issued_at: issue_date_formatted,
                    on_chain_verified: true
                }
            },
            { id: student_details.id }
        );

        await ano_detection_queue.ano_detection_queue.add(
            {
                info: JSON.stringify({
                    degree_token_id: Number(degreeReceipt.tokenIdMinted),
                    wallet: student_details.wallet_address,
                    tx_hash: transactionHash,
                    timestamp: Date.now(),
                    gas_price: Number(degreeReceipt.gasPrice || 1200000000),
                    gas_used: Number(degreeReceipt.gasUsed),
                    block_number: Number(degreeReceipt.blockNumber),
                    nonce: Number(degreeReceipt.nonce),
                    function: "safeMint",
                    metadata_cid: finalMetadataCID,
                    student_id: data.student_id,
                    issuer_id: data.req.user_id,
                    ip: data.req.client_ip
                })
            },
            { delay: 300 }
        );

        return cb(
            null,
            responseStruct.merge({
                signature: "sign11",
                status: 201,
                message: "Degree generated successfully",
                success: true
            }).toJS()
        );

    } catch (error) {
        console.error("Generate degree error:", error);
        return cb(
            responseStruct.merge({
                signature: "sign11",
                status: 500,
                success: false,
                message: "Something went wrong!"
            }).toJS()
        );
    }
};


const get_certificate = async (data, response, cb) => {
    if (!cb) cb = response
    try {
        const db_result = await student_model.viewCertificate()

        return cb(null,
            responseStruct.merge({
                signature: "sign11",
                status: 200,
                message: "ok",
                success: true,
                data: db_result.rows
            }).toJS()
        );
    } catch (error) {
        console.error("Signup Error:", error);
        return cb(
            responseStruct.merge({
                signature: "sign11",
                status: 500,
                message: error.code === '23505'
                    ? "Email already exists"
                    : "Something went wrong!",
            }).toJS()
        );
    }
}

const generate_degree_attack = async (data, response, cb) => {
    if (!cb) cb = response

    try {
        let student_details = await student_model.get_by_id({ id: data.student_id });
        student_details = student_details.rows[0];

        // DUMMY CID
        const metadataCID = "ipfs://attack_metadata_cid";

        const ABNORMAL_GAS_PRICE = 1200000000000;

        let degreeReceipt = await issueDegree(student_details, metadataCID, {
            gasPriceOverride: ABNORMAL_GAS_PRICE
        });

        degreeReceipt = degreeReceipt.data;
        const transactionHash = degreeReceipt.hash;

        await ano_detection_queue.ano_detection_queue.add(
            {
                info: JSON.stringify({
                    wallet: student_details.wallet_address,
                    tx_hash: transactionHash,
                    timestamp: Date.now(),
                    gas_price: ABNORMAL_GAS_PRICE,
                    gas_used: Number(degreeReceipt.gasUsed),
                    anamoly: true,
                })

            },
            { delay: 1000 }
        );

        return cb(null,
            responseStruct.merge({
                signature: "sign11",
                status: 201,
                message: "Attack transaction submitted",
                success: true
            }).toJS()
        );

    } catch (error) {
        console.error("Signup Error:", error);
        return cb(
            responseStruct.merge({
                signature: "sign11",
                status: 500,
                message: error.code === '23505'
                    ? "Email already exists"
                    : "Something went wrong!",
            }).toJS()
        );
    }
}

// UTIL
function queueAttack(tx, attack_type) {
    return ano_detection_queue.ano_detection_queue.add(
        {
            info: JSON.stringify({
                wallet: tx.wallet,
                tx_hash: tx.tx_hash,
                timestamp: Date.now(),
                gas_price: tx.gas_price,
                gas_used: tx.gas_used,
                metadata_cid: tx.metadata_cid || null,
                metadata_size: tx.metadata_size || null,
                nonce: tx.nonce || null,
                attack_type,
                anomaly: true
            })
        },
        { delay: 500 }
    );
}

const generate_attack = async (data, response, cb) => {
    if (!cb) cb = response;

    try {
        let { student_id, attack_type } = data;

        if (!student_id || !attack_type) {
            return cb(
                responseStruct.merge({
                    success: false,
                    status: 400,
                    message: "student_id and attack_type are required"
                }).toJS()
            );
        }

        // Fetch student
        let student = await student_model.get_by_id({ id: student_id });
        student = student.rows[0];

        if (!student) {
            return cb(
                responseStruct.merge({
                    success: false,
                    status: 404,
                    message: "Student not found"
                }).toJS()
            );
        }

        let metadataCID = "ipfs://valid-metadata.json";
        let gasOverride = null;

        switch (attack_type) {

            case "gas_price_anomaly":
                gasOverride = 1500000000000;
                break;

            case "replay_attack":
                metadataCID = "ipfs://replay-cid";
                break;

            case "wallet_impersonation":
                student.wallet_address = "0x0000deadbeef0000deadbeef0000deadbeef0000";
                break;

            case "metadata_tampering":
                metadataCID = "not_ipfs://tampered.json";
                break;

            case "ipfs_abuse":
                metadataCID = "ipfs://malicious.exe";
                break;

            case "rapid_minting":
                gasOverride = 10000000000;
                metadataCID = "ipfs://rapid-mint-attack";
                break;

            case "suspicious_wallet_pattern":
                metadataCID = "ipfs://normal";
                break;

            default:
                return cb(
                    responseStruct.merge({
                        status: 400,
                        success: false,
                        message: "Invalid attack_type"
                    }).toJS()
                );
        }

        let mintResponse = await issueDegree(student, metadataCID, {
            gasPriceOverride: gasOverride || undefined
        });

        const tx = mintResponse.data;

        await queueAttack(
            {
                wallet: student.wallet_address,
                tx_hash: tx.hash,
                gas_price: gasOverride || Number(tx.gasPrice),
                gas_used: Number(tx.gasUsed),
                metadata_cid: metadataCID,
                metadata_size: 0,
                nonce: tx.nonce
            },
            attack_type
        );

        return cb(
            null,
            responseStruct.merge({
                success: true,
                status: 201,
                message: `Attack '${attack_type}' transaction submitted`,
                tx_hash: tx.hash
            }).toJS()
        );

    } catch (error) {
        console.error("Attack Error:", error);

        return cb(
            responseStruct.merge({
                signature: "sign11",
                status: 500,
                success: false,
                message: "Something went wrong!"
            }).toJS()
        );
    }
};

const revoke_degree = async (data, response, cb) => {
    if (!cb) cb = response;

    try {
        // Get full student record
        const student = (await student_model.get_by_id({ id: data.id })).rows[0];

        const tokenId = Number(student.degree_token_id);
        const wallet = student.wallet_address;

        // 1. Check on-chain revocation
        const is_revoked_onchain = await contract.isRevoked(tokenId);
        console.log("revoked on-chain:", is_revoked_onchain);

        if (is_revoked_onchain) {
            return cb(
                responseStruct.merge({
                    status: 400,
                    success: false,
                    message: "Degree already revoked (on blockchain)"
                }).toJS()
            );
        }

        // 2. Perform revocation  
        const result = await revokeDegree_({ id: data.id });

        if (!result) {
            return cb(
                responseStruct.merge({
                    success: false,
                    status: 500,
                    message: "Error while revoking degree"
                }).toJS()
            );
        }

        return cb(
            null,
            responseStruct.merge({
                success: true,
                status: 200,
                message: "Degree revoked successfully"
            }).toJS()
        );

    } catch (error) {
        console.error("Revoke degree error:", error);

        return cb(
            responseStruct.merge({
                status: 500,
                success: false,
                message: "Something went wrong!"
            }).toJS()
        );
    }
};

const verify_degree = async (data, response, cb) => {
    if (!cb) cb = response;

    try {
        // STEP 1 — RESOLVE TOKEN ID
       
        let tokenID;

        if (data.token_id) {
            tokenID = data.token_id;
        } else {
            const db_result = await student_model.get_by_id({ id: data.id });
            const student = db_result.rows[0];

            if (!student?.degree_token_id) {
                return cb(responseStruct.merge({
                    status: 400,
                    success: false,
                    message: "token_id missing"
                }).toJS());
            }

            tokenID = student.degree_token_id;
        }
        
        // STEP 2 — LOAD REAL TOKEN URI
        const tokenURI = await contract.tokenURI(tokenID);

        if (!tokenURI) {
            return cb(responseStruct.merge({
                status: 400,
                success: false,
                message: "Invalid tokenId"
            }).toJS());
        }

        // Extract IPFS CID safely
        let cid = tokenURI.replace("ipfs://", "");
        cid = cid.split("/")[0];

        // Fetch real metadata
        const metadataURL = `https://gateway.pinata.cloud/ipfs/${cid}`;
        const metadata = (await axios.get(metadataURL)).data;

        // STEP 3 — VERIFY QR PAYLOAD IF PROVIDED

        let qr = null;
        if (data.qrPayload) {
            qr = JSON.parse(data.qrPayload);

            // Token mismatch
            if (qr.tokenId != tokenID) {
                return cb(responseStruct.merge({
                    status: 400,
                    success: false,
                    message: "QR tokenId mismatch — forged degree"
                }).toJS());
            }

            // Issuer mismatch
            if (qr.issuerWallet.toLowerCase() !== metadata.issuer.wallet.toLowerCase()) {
                return cb(responseStruct.merge({
                    status: 400,
                    success: false,
                    message: "Issuer mismatch — fake degree"
                }).toJS());
            }

            // Student wallet mismatch
            if (qr.studentWallet.toLowerCase() !== metadata.credentialSubject.walletAddress.toLowerCase()) {
                return cb(responseStruct.merge({
                    status: 400,
                    success: false,
                    message: "Student wallet mismatch — forged degree"
                }).toJS());
            }

            // Metadata hash mismatch
            if (qr.metadataHash !== metadata.credentialSubject.metadataHash) {
                return cb(responseStruct.merge({
                    status: 400,
                    success: false,
                    message: "Metadata hash mismatch — tampered metadata"
                }).toJS());
            }
        }


        // STEP 4 — SIGNATURE VERIFICATION (PROOF)
        if (!metadata?.proof?.signature) {
            return cb(responseStruct.merge({
                status: 400,
                success: false,
                message: "Signature not Found — Fake Degree"
            }).toJS());
        }

        // Clone credentialSubject except image stuff
        const subjectCopy = { ...metadata.credentialSubject };
        delete subjectCopy.imageCID;
        delete subjectCopy.imageHash;

        const stringToSign = JSON.stringify({
            issuer: metadata.issuer,
            credentialSubject: subjectCopy,
            blockchain: metadata.blockchain,
            issuedAt: metadata.issuer.issuedDate
        });

        // Hash must be a raw buffer, not hex encoded
        const expectedHash = ethers.sha256(ethers.toUtf8Bytes(stringToSign));

        const recovered = ethers.verifyMessage(
            ethers.getBytes(expectedHash),
            metadata.proof.signature
        );
        console.log("metasaya", metadata, recovered)
        if (recovered.toLowerCase() !== metadata.issuer.wallet.toLowerCase()) {
            return cb(responseStruct.merge({
                status: 400,
                success: false,
                message: "Invalid signature — fake certificate"
            }).toJS());
        }

        const metadataClone = {
            "@context": metadata["@context"],
            type: metadata.type,
            id: metadata.id,
            issuer: metadata.issuer,
            credentialSubject: {
                id: metadata.credentialSubject.id,
                studentName: metadata.credentialSubject.studentName,
                course: metadata.credentialSubject.course,
                degree: metadata.credentialSubject.degree,
                tokenId: metadata.credentialSubject.tokenId,
                walletAddress: metadata.credentialSubject.walletAddress
            },
            blockchain: metadata.blockchain,
            verification: metadata.verification
        };

        const localHash = crypto
            .createHash("sha256")
            .update(JSON.stringify(metadataClone))
            .digest("hex");

        if (localHash !== metadata.credentialSubject.metadataHash) {
            return cb(responseStruct.merge({
                status: 400,
                success: false,
                message: "Metadata tampered — forged certificate"
            }).toJS());
        }


        // --------------------------------------------------------------
        // STEP 6 — ON-CHAIN OWNER CHECK
        // --------------------------------------------------------------
        const owner = await contract.ownerOf(tokenID);

        if (owner.toLowerCase() !== metadata.credentialSubject.walletAddress.toLowerCase()) {
            return cb(responseStruct.merge({
                status: 400,
                success: false,
                message: "Owner mismatch — certificate transferred or fake"
            }).toJS());
        }


        // --------------------------------------------------------------
        // STEP 7 — REVOCATION CHECK
        // --------------------------------------------------------------
        const revoked = await contract.isRevoked(tokenID);
        if (revoked) {
            return cb(responseStruct.merge({
                status: 400,
                success: false,
                message: "Degree has been revoked"
            }).toJS());
        }


        // --------------------------------------------------------------
        // STEP 8 — OPTIONAL IMAGE HASH CHECK
        // --------------------------------------------------------------
        let imageTampered = false;

        if (data?.certificate?.data) {
            const uploadedHash = crypto
                .createHash("sha256")
                .update(data.certificate.data)
                .digest("hex");

            if (uploadedHash !== metadata.credentialSubject.imageHash) {
                imageTampered = true;
            }
        }


        // --------------------------------------------------------------
        // SUCCESS RESPONSE
        // --------------------------------------------------------------
        return cb(null, responseStruct.merge({
            status: 200,
            success: true,
            valid: true,
            tokenId: tokenID,
            issuer: metadata.issuer.name,
            student: metadata.credentialSubject.studentName,
            course: metadata.credentialSubject.course,
            on_chain_owner: owner,
            metadataCID: cid,
            imageTampered,
            message: imageTampered ? "Certificate image tampered" : "Verified successfully"
        }).toJS());

    } catch (error) {
        console.error("Verify error:", error);

        const msg =
            error?.reason ||
            error?.shortMessage ||
            error?.message ||
            String(error);

        if (msg.toLowerCase().includes("degree is revoked")) {
            return cb(null, responseStruct.merge({
                status: 200,
                success: false,
                revoked: true,
                message: "Degree is revoked!"
            }).toJS());
        }

        if (msg.includes("ERC721NonexistentToken")) {
            return cb(null, responseStruct.merge({
                status: 200,
                success: false,
                message: "Degree is Fake!"
            }).toJS());
        }

        return cb(responseStruct.merge({
            status: 500,
            success: false,
            message: "Internal verification error"
        }).toJS());
    }
};



const generate_fake_degree = async (data, response, cb) => {
    if (!cb) cb = response;

    try {
        // 1) Input or defaults
        const studentName = data.studentName || "Fake Student";
        const course = data.course || "MSc Cybersecurity";

        // Make issuer look REAL, not obviously fake
        const issuer = data.issuerName || "Coventry University";

        // 2) Fake token ID (looks legit, 0–99999)
        const fakeTokenId = data.tokenId || Math.floor(Math.random() * 100000);

        // 3) Fake but well-formed hashes / signature
        const fakeMetadataHash = crypto.randomBytes(32).toString("hex");
        const fakeSignature = "0x" + crypto.randomBytes(65).toString("hex");

        // Pretend to be the real uni wallet (for realism)
        const fakeIssuerWallet =
            data.issuerWallet || "0x333dfb6Faa2b73B72F01C9Dc34BDaa231335b13B";

        const fakeStudentWallet =
            data.studentWallet || "0xFAKE000000000000000000000000000000000000";

        // Make verify URL *look* like your real DCMS route
        const baseVerifyUrl = process.env.VERIFY_BASE_URL || "http://127.0.0.1:3011";
        const fakeVerifyUrl = `${baseVerifyUrl}/cr/v1/verify/${fakeTokenId}`;

        // 4) Fake QR payload (this is what ends up encoded in the QR)
        const fakeQrPayload = {
            tokenId: fakeTokenId,
            studentWallet: fakeStudentWallet,
            issuerWallet: fakeIssuerWallet,
            metadataHash: fakeMetadataHash,
            signature: fakeSignature,
            verifyUrl: fakeVerifyUrl
        };

        const imageBuffer = await renderCertificateWithQR({
            studentName,
            degreeName: course,
            issuerName: issuer,
            issueDate: "01 January 2025",
            qrPayload: fakeQrPayload
        });

        // Persist the fake JPEG so you can upload it in Postman / UI
        const outDir = path.join(__dirname, "../generated_fake_certificates");
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

        const imagePath = path.join(outDir, `fake_degree_${Date.now()}.jpg`);
        fs.writeFileSync(imagePath, imageBuffer);

        // 7) Build matching fake metadata JSON (optional, for debugging / demo)
        const fakeMetadata = {
            "@context": [
                "https://www.w3.org/2018/credentials/v1",
                "https://dcms.org/schema/degree-v1"
            ],
            type: ["VerifiableCredential", "DegreeCredential"],

            id: `did:dcms:token:${fakeTokenId}`,

            issuer: {
                id: "did:dcms:university:coventry",
                name: issuer,
                wallet: fakeIssuerWallet,
                issuedDate: new Date().toISOString()
            },

            credentialSubject: {
                id: `did:dcms:student:fake-${Date.now()}`,
                studentName,
                course,
                degree: course,
                tokenId: fakeTokenId,
                walletAddress: fakeStudentWallet,
                imageCID: "ipfs://fake-image-does-not-exist",
                imageHash: crypto.randomBytes(32).toString("hex"),
                metadataHash: fakeMetadataHash
            },

            // Make it look like it's on your real contract/network
            blockchain: {
                network: "Ganache",
                contract: contract.target || "0x3CA339C60a346167F4c053f43208a25a3FC5A7D9"
            },

            verification: {
                verifyUrl: fakeVerifyUrl
            },

            proof: {
                type: "EcdsaSecp256k1Signature2020",
                created: new Date().toISOString(),
                verificationMethod: fakeIssuerWallet,
                proofPurpose: "assertionMethod",
                signature: fakeSignature   // NOT produced with UNI private key
            }
        };

        const metadataPath = path.join(outDir, `fake_metadata_${Date.now()}.json`);
        fs.writeFileSync(metadataPath, JSON.stringify(fakeMetadata, null, 2));

        // 8) Return paths so you can manually pick the files
        return cb(
            null,
            responseStruct.merge({
                signature: "sign11",
                status: 201,
                success: true,
                message: "Fake degree generated. Use the JPEG in your verify upload to simulate forgery.",
                data: {
                    fakeImagePath: imagePath,
                    fakeMetadataPath: metadataPath,
                    fakeMetadata
                }
            }).toJS()
        );

    } catch (error) {
        console.error("Fake degree generator error:", error);
        return cb(
            responseStruct.merge({
                signature: "sign11",
                status: 500,
                success: false,
                message: "Failed generating fake degree"
            }).toJS()
        );
    }
};

const rapid_mint_attack = async (data, response, cb) => {
    if (!cb) cb = response;

    try {
        const count = Number(data.count || 20);   // Number of fake mints
        const delayMs = Number(data.delay || 50); // Delay between mints (ms)

        const attackerWallet = process.env.CONTRACT_ADDRESS ||
            "0xFAKEBAD000000000000000000000000000000000";

        let attackResults = [];

        for (let i = 0; i < count; i++) {

            // ----- FAKE METADATA CID -----
            const fakeMetadataCID = `ipfs://rapid-${Date.now()}-${i}`;

            // ----- Fake student object to satisfy issueDegree() -----
            const fakeStudent = {
                id: 999999,
                first_name: "Attacker",
                last_name: `Bot${i}`,
                course_name: "Hacking 101",
                wallet_address: attackerWallet
            };

            // ----- Perform mint -----
            const mintRes = await issueDegree(fakeStudent, fakeMetadataCID, {
                gasPriceOverride: 10_000_000_000 // Burn gas OR cause anomaly
            });

            const tx = mintRes.data;

            // ----- Push to anomaly queue -----
            await ano_detection_queue.ano_detection_queue.add(
                {
                    info: JSON.stringify({
                        wallet: attackerWallet,
                        tx_hash: tx.hash,
                        timestamp: Date.now(),
                        gas_price: Number(tx.gasPrice),
                        gas_used: Number(tx.gasUsed),
                        nonce: Number(tx.nonce),
                        block_number: Number(tx.blockNumber),
                        metadata_cid: fakeMetadataCID,
                        function: "safeMint",
                        attack: "rapid_minting",
                        anomaly: true
                    })
                },
                { delay: 10 }
            );

            attackResults.push({
                tx_hash: tx.hash,
                nonce: tx.nonce,
                block: tx.blockNumber
            });

            // Small delay to simulate realistic spam
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }

        return cb(
            null,
            responseStruct.merge({
                status: 201,
                success: true,
                message: `Rapid minting attack executed (${count} fake mints).`,
                data: attackResults
            }).toJS()
        );

    } catch (error) {
        console.error("Rapid mint attack error:", error);

        return cb(
            responseStruct.merge({
                status: 500,
                success: false,
                message: "Rapid minting attack failed!"
            }).toJS()
        );
    }
};







module.exports = {
    generate_degree,
    get_certificate,
    generate_degree_attack,
    generate_attack,
    revoke_degree,
    verify_degree,
    generate_fake_degree,
    rapid_mint_attack
}