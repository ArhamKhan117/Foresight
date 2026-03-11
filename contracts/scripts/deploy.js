const hre = require("hardhat");

async function main() {
  console.log("Deploying Polymarket-style contracts to Hedera Testnet...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "HBAR\n");

  // Deploy OptimisticOracle
  console.log("1. Deploying OptimisticOracle...");
  const OptimisticOracle = await hre.ethers.getContractFactory("OptimisticOracle");
  const optimisticOracle = await OptimisticOracle.deploy();
  await optimisticOracle.waitForDeployment();
  const oracleAddress = await optimisticOracle.getAddress();
  console.log("   OptimisticOracle:", oracleAddress);

  // Deploy PredictionMarket
  console.log("2. Deploying PredictionMarket...");
  const PredictionMarket = await hre.ethers.getContractFactory("PredictionMarket");
  const predictionMarket = await PredictionMarket.deploy();
  await predictionMarket.waitForDeployment();
  const marketAddress = await predictionMarket.getAddress();
  console.log("   PredictionMarket:", marketAddress);

  // Initialize (new signature: feeAuthority, creatorFee, bettingFee%, fundFee%)
  console.log("3. Initializing PredictionMarket...");
  const feeAuthority = deployer.address;
  const creatorFeeAmount = process.env.CREATOR_FEE_AMOUNT || "100000";     // 0.001 HBAR
  const bettingFeePercentage = process.env.BETTING_FEE_PERCENTAGE || 250;   // 2.5%
  const fundFeePercentage = process.env.FUND_FEE_PERCENTAGE || 150;         // 1.5%

  const initTx = await predictionMarket.initialize(
    feeAuthority, creatorFeeAmount,
    bettingFeePercentage, fundFeePercentage
  );
  await initTx.wait();
  console.log("   Initialized");

  // Link oracle
  console.log("4. Linking Oracle...");
  const setOracleTx = await predictionMarket.setOracle(oracleAddress);
  await setOracleTx.wait();
  console.log("   Oracle linked");

  // Summary
  console.log("\n========================================");
  console.log("DEPLOYMENT COMPLETE (Polymarket-style)");
  console.log("========================================");
  console.log("PredictionMarket:", marketAddress);
  console.log("OptimisticOracle:", oracleAddress);
  console.log("Admin:", deployer.address);
  console.log("Creator Fee:", creatorFeeAmount, "tinybars");
  console.log("Betting Fee:", Number(bettingFeePercentage) / 100, "%");
  console.log("Fund Fee:", Number(fundFeePercentage) / 100, "%");
  console.log("\nAdd to .env:");
  console.log(`PREDICTION_MARKET_CONTRACT=${marketAddress}`);
  console.log(`OPTIMISTIC_ORACLE_CONTRACT=${oracleAddress}`);
  console.log("========================================");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
