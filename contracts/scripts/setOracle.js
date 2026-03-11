const hre = require("hardhat");

async function main() {
  const PREDICTION_MARKET = "0x61E76D8eD410aDc29EcF65aE697b7599eB17E97D";
  const OPTIMISTIC_ORACLE = "0x506eA2BE51Daf38BBE1278cd836e799013fcC4Ed";

  const [deployer] = await hre.ethers.getSigners();
  console.log("Calling setOracle with account:", deployer.address);

  const pm = await hre.ethers.getContractAt(
    ["function setOracle(address payable _oracle) external", "function oracle() external view returns (address)"],
    PREDICTION_MARKET,
    deployer
  );

  // Check current oracle
  try {
    const current = await pm.oracle();
    console.log("Current oracle:", current);
    if (current.toLowerCase() === OPTIMISTIC_ORACLE.toLowerCase()) {
      console.log("Oracle already set correctly!");
      return;
    }
  } catch (e) {
    console.log("No oracle set yet");
  }

  const tx = await pm.setOracle(OPTIMISTIC_ORACLE);
  console.log("setOracle tx:", tx.hash);
  await tx.wait();
  console.log("Oracle linked successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
