const { contract, isRevoked } = require("../blockchain/certificates")
const { passworHash } = require("../utils/helper")

// Models
const user_model = require("../models/pgsql/users")
const sessions_model = require("../models/pgsql/sessions")
const student_model = require("../models/pgsql/students")
const { ano_detection_queue } = require("../utils/queues/anamoly_detection")


const is_already_user = async (data) => {
    try {
        if (!data.email) {
            throw "Email is required"
        }
        const user_details = await user_model.fetchSingleUser({
            email: data.email,
            ...(data.phone && { phone: data.phone })
        })

        if (user_details && user_details.length > 0) {
            return true
        } else {
            return false
        }

    } catch (error) {
        throw error
    }
}

const build_password_hash_student = async () => {
    const password_ = "student@123"

    const passhash = await passworHash(password_)
    return passhash
}

const check_if_degree_issued = async (student_id = 0) => {
    if (student_id === 0) throw "student id is required"
    else {
        const db_result = await student_model.is_degree_issued({ id: student_id })

        console.log("db result for wlllt add", db_result)

        if (db_result.length > 0 && db_result[0].tx_hash !== null) {
            return {
                has_degree: true
            }
        } else {
            return {
                has_degree: false
            }
        }
    }
}

const issueDegree = async (data, metadataCID, txOptions = {}) => {
    try {

        const student_wallet = data.wallet_address;

        // Check current token number
        const currentId = await contract.currentTokenId();
        console.log("🟡 Blockchain token counter before mint:", Number(currentId));

        //  Mint token
        const overrides = {
            gasLimit: 300000,
        };

        if (txOptions.gasPriceOverride) {
            overrides.gasPrice = BigInt(txOptions.gasPriceOverride);
        }

        const tx = await contract.safeMint(student_wallet, metadataCID, overrides);
        const nonce = tx.nonce

        const receipt = await tx.wait();
        console.log("receipt", receipt)

        // 🔥 3️⃣ Check new token counter again
        const newId = await contract.currentTokenId();
        console.log("Blockchain token counter AFTER mint:", Number(newId));

        return {
            success: true,
            data: {
                nonce,
                tokenIdMinted: Number(currentId),
                ...receipt
            }
        };

    } catch (error) {
        console.error("Mint Error:", error);
        throw error;
    }
};

const getBlockTimestamp = async (blockNumber, prev = false) => {
    try {
        const provider = contract.runner.provider
        const block = await provider.getBlock(prev ? blockNumber - 1 : blockNumber)
        return block.timestamp

    } catch (error) {
        throw error
    }
}

const revokeDegree_ = async (data) => {
    try {
        let db_result = await student_model.get_by_id({ id: data.id })
        db_result = db_result.rows

        let RevokeDegree = await contract.revokeDegree(db_result[0].degree_token_id, db_result[0].wallet_address)

        RevokeDegree = await RevokeDegree.wait()

        const updateDb = await student_model.update_by_id(
            {
                student: {
                    is_revoked: true,
                    revocation_reason: data.reason
                }
            },
            {
                id: data.id
            })

        const tx_data = {
            degree_token_id: Number(db_result[0].degree_token_id),
            wallet: db_result[0].wallet_address,
            tx_hash: RevokeDegree.hash,
            timestamp: Date.now(),
            gas_price: Number(RevokeDegree.gasPrice || 1200000000),
            gas_used: Number(RevokeDegree?.gasUsed),
            block_number: Number(RevokeDegree.blockNumber),
            // block_time_diff,
            nonce: Number(RevokeDegree.nonce),
            function: "revokeDegree",
            // metadata_cid: imageCID,
        }

        await ano_detection_queue.add(
            {
                info: JSON.stringify(tx_data)
            },
            {
                delay: 1000
            }
        )

        return true

    } catch (error) {
        throw error
    }
}

const inactive_session = async (data) => {
    try {
        const db_result = await sessions_model.signout({
            refresh_token: data.refresh_token
        })

        return db_result
    } catch (error) {
        throw error
    }
}


module.exports = {
    is_already_user,
    build_password_hash_student,
    issueDegree,
    check_if_degree_issued,
    getBlockTimestamp,
    revokeDegree_,
    inactive_session
}