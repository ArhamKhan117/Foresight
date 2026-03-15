const hre = require("hardhat");

async function main() {
  console.log("Deploying MultiOutcomeOracle + updated MultiOutcomeEvent...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "HBAR\n");

  // 1. Deploy MultiOutcomeOracle
  console.log("1. Deploying MultiOutcomeOracle...");
  const MultiOutcomeOracle = await hre.ethers.getContractFactory("MultiOutcomeOracle");
  const oracle = await MultiOutcomeOracle.deploy();
  await oracle.waitForDeployment();
  const oracleAddress = await oracle.getAddress();
  console.log("   MultiOutcomeOracle:", oracleAddress);

  // 2. Deploy updated MultiOutcomeEvent
  console.log("2. Deploying MultiOutcomeEvent (with oracle support)...");
  const MultiOutcomeEvent = await hre.ethers.getContractFactory("MultiOutcomeEvent");
  const multiOutcome = await MultiOutcomeEvent.deploy();
  await multiOutcome.waitForDeployment();
  const eventAddress = await multiOutcome.getAddress();
  console.log("   MultiOutcomeEvent:", eventAddress);

  // 3. Initialize MultiOutcomeEvent
  console.log("3. Initializing MultiOutcomeEvent...");
  const feeAuthority = deployer.address;
  const creatorFeeAmount = process.env.CREATOR_FEE_AMOUNT || "100000";
  const bettingFeePercentage = process.env.BETTING_FEE_PERCENTAGE || 250;
  const fundFeePercentage = process.env.FUND_FEE_PERCENTAGE || 150;

  const initTx = await multiOutcome.initialize(
    feeAuthority, creatorFeeAmount,
    bettingFeePercentage, fundFeePercentage
  );
  await initTx.wait();
  console.log("   Initialized");

  // 4. Link oracle to MultiOutcomeEvent
  console.log("4. Linking Oracle to MultiOutcomeEvent...");
  const setOracleTx = await multiOutcome.setOracle(oracleAddress);
  await setOracleTx.wait();
  console.log("   Oracle linked");

  // Summary
  console.log("\n========================================");
  console.log("MULTI-OUTCOME ORACLE DEPLOYMENT COMPLETE");
  console.log("========================================");
  console.log("MultiOutcomeOracle:", oracleAddress);
  console.log("MultiOutcomeEvent:", eventAddress);
  console.log("Admin:", deployer.address);
  console.log("\nAdd to .env:");
  console.log(`MULTI_OUTCOME_ORACLE_CONTRACT=${oracleAddress}`);
  console.log(`MULTI_OUTCOME_CONTRACT=${eventAddress}`);
  console.log(`NEXT_PUBLIC_MULTI_OUTCOME_ORACLE_CONTRACT=${oracleAddress}`);
  console.log(`NEXT_PUBLIC_MULTI_OUTCOME_CONTRACT=${eventAddress}`);
  console.log("========================================");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
