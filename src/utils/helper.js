const fs = require("fs")
const crypto = require("crypto")
const bcrypt = require("bcrypt")
const path = require("path")

const PEPPER_ = process.env.PEPPER
const ROUNDS_ = process.env.SALT_ROUNDS

const privateKey = fs.readFileSync(path.join(__dirname, "../../private.pem"), "utf8");
const ENC_ALGO = "aes-256-gcm";
const IV_LEN = 12;

const passworHash = async (plainPassword) => {
    const pepperedPass = plainPassword + PEPPER_
    try {
        const hashPass = await bcrypt.hash(pepperedPass, Number(ROUNDS_))
        return hashPass
    } catch (error) {
        throw (error)
    }
}

const isValidPassword = async (password, compare_data) => {
    try {
        if (!password || !compare_data?.hashPass) {
            throw new Error("Missing password or hashed password");
        }

        const pepperedPass = password + PEPPER_
        const isMatch = await bcrypt.compare(pepperedPass, compare_data.hashPass)
        return isMatch
    } catch (error) {
        throw error
    }
}
const encryptForToken = async (data) => {
    const crypto = require('crypto');

    let secretKey = Buffer.from(process.env.ENCRYPTION_SECRET, 'utf-8');
    if (secretKey.length !== 32) {
        throw new Error("Invalid encryption key length. AES-256-CBC requires a 32-byte key.");
    }

    let iv = Buffer.from(process.env.ENCRYPTION_IV, 'utf-8');
    if (iv.length !== 16) {
        throw new Error("Invalid IV length. AES-CBC requires a 16-byte IV.");
    }

    const cipher = crypto.createCipheriv(process.env.ENCRYPTION_ALGO, secretKey, iv)
    let encryptedCipher = cipher.update(JSON.stringify(data) + "", "utf-8", "hex")
    encryptedCipher += cipher.final("hex")

    return encryptedCipher;

}

const decryptForToken = async (encryptedData) => {
    const crypto = require('crypto');

    if (!encryptedData) {
        throw new Error("No encrypted data provided for decryption");
    }

    let secretKey = Buffer.from(process.env.ENCRYPTION_SECRET, 'utf-8');
    if (secretKey.length !== 32) {
        throw new Error("Invalid encryption key length. AES-256-CBC requires a 32-byte key.");
    }

    let iv = Buffer.from(process.env.ENCRYPTION_IV, 'utf-8');
    if (iv.length !== 16) {
        throw new Error("Invalid IV length. AES-CBC requires a 16-byte IV.");
    }

    const decipher = crypto.createDecipheriv(process.env.ENCRYPTION_ALGO, secretKey, iv);

    let decryptedData = decipher.update(encryptedData, 'hex', 'utf-8');
    decryptedData += decipher.final('utf-8');
    return JSON.parse(decryptedData);
}

const decryptForAccessToken = async (encryptedData) => {
    const crypto = require('crypto');

    if (!encryptedData) {
        throw new Error("No encrypted data provided for decryption");
    }

    let secretKey = Buffer.from(process.env.ACCESS_TOKEN_SECRET, 'base64');

    if (secretKey.length !== 32) {
        throw new Error("Access Token Invalid encryption key length. AES-256-CBC requires a 32-byte key.");
    }

    let iv = Buffer.from(process.env.ENCRYPTION_IV, 'utf-8');
    if (iv.length !== 16) {
        throw new Error("Invalid IV length. AES-CBC requires a 16-byte IV.");
    }

    const decipher = crypto.createDecipheriv(process.env.ENCRYPTION_ALGO, secretKey, iv);

    let decryptedData = decipher.update(encryptedData, 'hex', 'utf-8');
    decryptedData += decipher.final('utf-8');
    return JSON.parse(decryptedData);
}

const refreshToken = async (data) => {
    const jwt = require('jsonwebtoken');

    const encryptedData = await encryptForToken(data)
    const token = jwt.sign(
        {
            encryptedData: encryptedData
        },
        process.env.JWT_SECRET,
        {
            expiresIn: process.env.JWT_EXPIRES_IN
        })
    return token
}

const encryptForAccessToken = async (data) => {
    const crypto = require('crypto');

    let secretKey = Buffer.from(process.env.ACCESS_TOKEN_SECRET, 'base64');
    if (secretKey.length !== 32) {
        throw new Error("Access Token: Invalid encryption key length. AES-256-CBC requires a 32-byte key.");
    }

    let iv = Buffer.from(process.env.ENCRYPTION_IV, 'utf-8');
    if (iv.length !== 16) {
        throw new Error("Invalid IV length. AES-CBC requires a 16-byte IV.");
    }

    const cipher = crypto.createCipheriv(process.env.ENCRYPTION_ALGO, secretKey, iv)
    let encryptedCipher = cipher.update(JSON.stringify(data) + "", "utf-8", "hex")
    encryptedCipher += cipher.final("hex")

    return encryptedCipher;

}

const generateAccessToken = async (data) => {
    const jwt = require('jsonwebtoken');

    const encryptedData = await encryptForAccessToken(data)
    const token = jwt.sign(
        {
            encryptedData: encryptedData
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN
        })
    return token
}

function encryptPrivateKey_wallet(pkHex, keyBuf) {
    const iv = crypto.randomBytes(IV_LEN);
    const cipher = crypto.createCipheriv(ENC_ALGO, keyBuf, iv);
    const ciphertext = Buffer.concat([cipher.update(pkHex, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
        ciphertext_b64: ciphertext.toString("base64"),
        iv_b64: iv.toString("base64"),
        tag_b64: tag.toString("base64"),
    };
}

function decryptPrivateKey_wallet(ciphertext_b64, iv_b64, tag_b64, keyBuf) {
    const decipher = crypto.createDecipheriv(ENC_ALGO, keyBuf, Buffer.from(iv_b64, "base64"));
    decipher.setAuthTag(Buffer.from(tag_b64, "base64"));
    const plaintext = Buffer.concat([
        decipher.update(Buffer.from(ciphertext_b64, "base64")),
        decipher.final()
    ]);
    return plaintext.toString("utf8");
}

function getKeyFromEnv_wallet() {
    const k = process.env.WALLET_AES_KEY; // base64 32 bytes
    if (!k) throw new Error("WALLET_AES_KEY missing");
    const buf = Buffer.from(k, "base64");
    if (buf.length !== 32) throw new Error("WALLET_AES_KEY must be 32 bytes base64");
    return buf;
}

function generateStudentId(universityCode = "CU") {
    const year = new Date().getFullYear().toString().slice(-2); // last two digits of year
    const randomPart = crypto.randomBytes(4).toString("hex").toUpperCase(); // 8 random hex chars
    return `${universityCode}-${year}${randomPart}`;
}

const decryptedPassword = (encryptedPassword) => {
    const buffer = Buffer.from(encryptedPassword, "base64");

    const decrypted = crypto.privateDecrypt(
        {
            key: privateKey,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: "sha256", // must match frontend
        },
        buffer
    );

    return decrypted.toString("utf8");
};

module.exports = {
    passworHash,
    isValidPassword,
    decryptForToken,
    generateAccessToken,
    refreshToken,
    decryptForAccessToken,
    encryptPrivateKey_wallet,
    decryptPrivateKey_wallet,
    getKeyFromEnv_wallet,
    generateStudentId,
    decryptedPassword
}