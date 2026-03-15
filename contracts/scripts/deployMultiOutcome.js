const hre = require("hardhat");

async function main() {
  console.log("Deploying MultiOutcomeEvent contract to Hedera Testnet...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "HBAR\n");

  // Deploy MultiOutcomeEvent
  console.log("1. Deploying MultiOutcomeEvent...");
  const MultiOutcomeEvent = await hre.ethers.getContractFactory("MultiOutcomeEvent");
  const multiOutcome = await MultiOutcomeEvent.deploy();
  await multiOutcome.waitForDeployment();
  const contractAddress = await multiOutcome.getAddress();
  console.log("   MultiOutcomeEvent:", contractAddress);

  // Initialize
  console.log("2. Initializing MultiOutcomeEvent...");
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

  // Summary
  console.log("\n========================================");
  console.log("MULTI-OUTCOME DEPLOYMENT COMPLETE");
  console.log("========================================");
  console.log("MultiOutcomeEvent:", contractAddress);
  console.log("Admin:", deployer.address);
  console.log("\nAdd to .env:");
  console.log(`MULTI_OUTCOME_CONTRACT=${contractAddress}`);
  console.log(`NEXT_PUBLIC_MULTI_OUTCOME_CONTRACT=${contractAddress}`);
  console.log("========================================");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
