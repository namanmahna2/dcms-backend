const pinataSDK = require("@pinata/sdk");
const fs = require("fs");
require("dotenv").config();

const pinata = pinataSDK(
    process.env.PINATA_API_KEY,
    process.env.PINATA_API_SECRET
);

async function uploadFileToPinata(filePath, fileName = "degree") {
    const readableStream = fs.createReadStream(filePath);

    const options = {
        pinataMetadata: {
            name: fileName,
        },
        pinataOptions: {
            cidVersion: 1
        }
    };

    const result = await pinata.pinFileToIPFS(readableStream, options);
    return `ipfs://${result.IpfsHash}`;
}

async function uploadJSONToPinata(jsonObj, fileName = "metadata.json") {
    const options = {
        pinataMetadata: { name: fileName },
        pinataOptions: { cidVersion: 1 }
    };

    const result = await pinata.pinJSONToIPFS(jsonObj, options);
    return `ipfs://${result.IpfsHash}`;
}

module.exports = {
    uploadFileToPinata,
    uploadJSONToPinata
};
