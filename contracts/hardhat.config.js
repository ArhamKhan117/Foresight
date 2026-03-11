require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      viaIR: true
    }
  },
  networks: {
    // Hedera Testnet
    hederaTestnet: {
      url: process.env.HEDERA_TESTNET_RPC || "https://testnet.hashio.io/api",
      accounts: process.env.OPERATOR_KEY ? [process.env.OPERATOR_KEY] : [],
      chainId: 296,
      timeout: 60000
    },
    // Hedera Mainnet
    hederaMainnet: {
      url: process.env.HEDERA_MAINNET_RPC || "https://mainnet.hashio.io/api",
      accounts: process.env.OPERATOR_KEY ? [process.env.OPERATOR_KEY] : [],
      chainId: 295,
      timeout: 60000
    },
    // Local development (Hedera Local Node)
    localhost: {
      url: "http://localhost:7546",
      accounts: process.env.LOCAL_PRIVATE_KEY ? [process.env.LOCAL_PRIVATE_KEY] : [],
      chainId: 298
    }
  },
  paths: {
    sources: "./src",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  }
};
