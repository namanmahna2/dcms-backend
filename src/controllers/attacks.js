const mute = require("immutable");
const path = require("path");
const moment = require("moment");
const fs = require("fs");
const crypto = require("crypto");
const { ano_detection_queue } = require("../utils/queues/anamoly_detection");
const { contract } = require("../blockchain/certificates");
const { default: axios } = require("axios");

const responseStruct = new mute.Map({
    signature: "",
    status: null,
    message: "",
    data: null,
    success: false
})


async function simulateSybilAttack(data, response, cb) {
    if (typeof cb !== "function") cb = response;

    try {
        const times = Number(data?.times) || 10;
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

        for (let i = 0; i < times; i++) {
            const fakeWallet = "0x" + crypto.randomBytes(20).toString("hex");
            const fakeCid = `ipfs://fakeCID_${crypto.randomBytes(4).toString("hex")}`;
            const fakeGas = Math.floor(Math.random() * 3e9 + 1e9);

            const payload = {
                wallet: fakeWallet,
                gas_price: fakeGas,
                gas_used: 75000 + Math.floor(Math.random() * 5000),
                tx_hash: "0x" + crypto.randomBytes(32).toString("hex"),
                metadata_cid: fakeCid,
                metadata_size: 1500,
                timestamp: Date.now(),
                nonce: Math.floor(Math.random() * 1000),
                issuer_id: data.req.user_id,
                ip: data.req.client_ip
            };

            await ano_detection_queue.add({ info: JSON.stringify(payload) });
        }

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

async function simulateBotScraping(data, response, cb) {
    if (typeof cb !== "function") cb = response
    try {
        const tokenId = data.tokenId
        const tokenURI = await contract.tokenURI(tokenId);
        const cid = tokenURI.replace("ipfs://", "");
        const metadataURL = `https://gateway.pinata.cloud/ipfs/${cid}`;


        const metadata = (await axios.get(metadataURL)).data;

        metadata.issuer.name = "Hacked University";
        metadata.credentialSubject.studentName = "Fake Hacker";
        delete metadata.proof;

        const fakeMetadataPath = path.join(__dirname, `scraped_fake_${tokenId}.json`);
        fs.writeFileSync(fakeMetadataPath, JSON.stringify(metadata, null, 2));

        return cb(
            null,
            responseStruct.merge({
                signature: "sign11",
                status: 201,
                message: "Bot scraping simulated",
                fakeFile: fakeMetadataPath,
                original: metadataURL,
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