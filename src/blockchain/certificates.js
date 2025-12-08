const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const rpcUrl = process.env.GANACHE_RPC;
const privateKey = process.env.GANACHE_PRIVATE_KEY;
const contractAddress = process.env.CONTRACT_ADDRESS;

// ---- Check Environment Variables ----
if (!rpcUrl || !privateKey || !contractAddress) {
  console.error("❌ Missing environment variables in .env");
  console.error("Make sure you have GANACHE_RPC, GANACHE_PRIVATE_KEY, and CONTRACT_ADDRESS set.");
  process.exit(1);
}

// ---- Setup Provider and Wallet ----
const provider = new ethers.JsonRpcProvider(rpcUrl);
const wallet = new ethers.Wallet(privateKey, provider);

// ---- Load ABI ----
const abiPath = path.join(__dirname, "./DegreeNFT.json");

if (!fs.existsSync(abiPath)) {
  console.error(`❌ ABI file not found at ${abiPath}`);
  process.exit(1);
}

const abi = JSON.parse(fs.readFileSync(abiPath, "utf8")).abi;

// ---- Connect Contract ----
const contract = new ethers.Contract(contractAddress, abi, wallet);

async function check() {
  try {
    console.log("🚀 Calling safeMint...");

    const tx = await contract.safeMint(
      "0x21E064BC351d98fF2528E3D19c4AD156dD970b9d",
      "ipfs://dummy.json",
      { gasLimit: 300000 }
    );

    console.log("⏳ Waiting for confirmation...");
    const receipt = await tx.wait();

    console.log("✅ Mint Successful!");
    console.log("Tx Hash:", receipt.hash);

  } catch (err) {
    console.error("❌ Mint Error:", err);
  }
}

const isRevoked = async (token_id) => {
  return await contract.isRevoked(token_id)
}

// check();



// ---- Debug Log ----
console.log("✅ Connected to Ganache RPC:", rpcUrl);
console.log("👛 Using wallet address:", wallet.address);
console.log("📄 Contract connected at:", contractAddress);

module.exports = { provider, wallet, contract, isRevoked };
