const { ethers } = require("ethers")
const db = require("../models/pgsql")

const { encryptPrivateKey_wallet, getKeyFromEnv_wallet } = require("../utils/helper")

const createCustodialWalletUser = async (userId) => {
    const wallet = ethers.Wallet.createRandom()
    const address = wallet.address()
    const pkHex = wallet.privateKey
    console("private key hex ", pkHex)

    const key = getKeyFromEnv_wallet()
    const { ciphertext_b64, iv_b64, tag_b64 } = encryptPrivateKey_wallet(pkHex, key)

    const [id] = await db("dcms_wallets")
        .insert({
            user_id: userId,
            address,
            custody: "custodial",
            pk_ciphertext: ciphertext_b64,
            pk_iv: iv_b64,
            pk_tag: tag_b64
        })
        .returning("id")

    return { id, address }
}

const attachBYOWallet = async (userId, address) => {
    if (!ethers.isAddress(address)) throw new Error("Invalid address")


    const [id] = await db("dcms_wallets")
        .insert({
            user_id: userId,
            address: ethers.getAddress(address),
            custody: "byo"
        })
        .returning("id")

    return { id, address: ethers.getAddress(address) }
}

module.exports = {
    createCustodialWalletUser,
    attachBYOWallet
}