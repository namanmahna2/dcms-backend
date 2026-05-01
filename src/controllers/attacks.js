// Import required libraries
const mute = require("immutable"); // Immutable.js for structured response object
const path = require("path"); // For handling file paths
const moment = require("moment"); // (Unused here, could be removed)
const fs = require("fs"); // File system operations
const crypto = require("crypto"); // Generate random values (wallets, hashes)
const { ano_detection_queue } = require("../utils/queues/anamoly_detection"); // Queue for anomaly detection
const { contract } = require("../blockchain/certificates"); // Blockchain contract instance
const { default: axios } = require("axios"); // HTTP client

// Base response structure (immutable for consistency)
const responseStruct = new mute.Map({
    signature: "",   // identifier for response type
    status: null,    // HTTP-like status code
    message: "",     // human-readable message
    data: null,      // optional data payload
    success: false   // success flag
});


/**
 * 🚨 Simulates a Sybil Attack
 * Creates multiple fake blockchain transactions from random wallets
 * and pushes them into the anomaly detection queue.
 */
async function simulateSybilAttack(data, response, cb) {
    // Ensure callback exists
    if (typeof cb !== "function") cb = response;

    try {
        // Number of fake transactions to generate (default = 10)
        const times = Number(data?.times) || 10;

        // Validate input
        if (times <= 0) {
            return cb(
                null,
                responseStruct.merge({
                    signature: "sign11",
                    status: 400,
                    success: false,
                    message: "Invalid 'times' value"
                }).toJS()
            );
        }

        // Loop to generate fake identities/transactions
        for (let i = 0; i < times; i++) {

            // Generate fake wallet address (20 bytes hex)
            const fakeWallet = "0x" + crypto.randomBytes(20).toString("hex");

            // Generate fake IPFS CID
            const fakeCid = `ipfs://fakeCID_${crypto.randomBytes(4).toString("hex")}`;

            // Random gas price between 1–4 Gwei (approx)
            const fakeGas = Math.floor(Math.random() * 3e9 + 1e9);

            // Create fake blockchain transaction payload
            const payload = {
                wallet: fakeWallet,
                gas_price: fakeGas,
                gas_used: 75000 + Math.floor(Math.random() * 5000),
                tx_hash: "0x" + crypto.randomBytes(32).toString("hex"),
                metadata_cid: fakeCid,
                metadata_size: 1500,
                timestamp: Date.now(),
                nonce: Math.floor(Math.random() * 1000),

                // Real user context (important for detecting attack patterns)
                issuer_id: data.req.user_id,
                ip: data.req.client_ip
            };

            // Push fake transaction into anomaly detection queue
            await ano_detection_queue.add({
                info: JSON.stringify(payload)
            });
        }

        // Success response
        return cb(
            null,
            responseStruct.merge({
                signature: "sign11",
                status: 201,
                message: "Sybil attack simulated",
                count: times,
                success: true
            }).toJS()
        );

    } catch (error) {
        console.error("simulateSybilAttack error:", error);

        return cb(
            null,
            responseStruct.merge({
                signature: "sign11",
                status: 500,
                success: false,
                message: "Something went wrong!"
            }).toJS()
        );
    }
}


/**
 * 🤖 Simulates Bot Scraping + Metadata Tampering
 * Fetches NFT metadata from IPFS, modifies it,
 * and stores a fake version locally.
 */
async function simulateBotScraping(data, response, cb) {
    if (typeof cb !== "function") cb = response;

    try {
        const tokenId = data.tokenId;

        // Fetch token URI from blockchain contract
        const tokenURI = await contract.tokenURI(tokenId);

        // Extract CID from ipfs:// URL
        const cid = tokenURI.replace("ipfs://", "");

        // Convert to HTTP gateway URL
        const metadataURL = `https://gateway.pinata.cloud/ipfs/${cid}`;

        const metadata = (await axios.get(metadataURL)).data;

        // Simulate tampering
        metadata.issuer.name = "Hacked University";
        metadata.credentialSubject.studentName = "Fake Hacker";

        // Remove proof (simulating integrity attack)
        delete metadata.proof;

        const fakeMetadataPath = path.join(
            __dirname,
            `scraped_fake_${tokenId}.json`
        );

        fs.writeFileSync(
            fakeMetadataPath,
            JSON.stringify(metadata, null, 2)
        );

        return cb(
            null,
            responseStruct.merge({
                signature: "sign11",
                status: 201,
                message: "Bot scraping simulated",
                fakeFile: fakeMetadataPath, // location of fake file
                original: metadataURL,      // original source
                success: true
            }).toJS()
        );

    } catch (error) {
        console.error("simulateSybilAttack error:", error);

        return cb(
            null,
            responseStruct.merge({
                signature: "sign11",
                status: 500,
                success: false,
                message: "Something went wrong!"
            }).toJS()
        );
    }
}

module.exports = {
    simulateSybilAttack,
    simulateBotScraping
};