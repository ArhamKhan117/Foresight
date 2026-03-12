import { ethers, JsonRpcSigner } from "ethers";
import { PREDICTION_MARKET_CONTRACT, OPTIMISTIC_ORACLE_CONTRACT, MULTI_OUTCOME_CONTRACT, MULTI_OUTCOME_ORACLE_CONTRACT, HEDERA_NETWORK } from "./constants";
import { CreateMarketType, DepositeLiquidityType, BetType } from "../../types/type";
import { FORE_TOKEN_ID } from "./constants";

// Scale factor: 1 token = 1e8 units (same as tinybars)
const SCALE = BigInt(1e8);

// ============ ABI — Polymarket-style contract ============
const PREDICTION_MARKET_ABI = [
  "function initialize(address _feeAuthority, uint256 _creatorFeeAmount, uint256 _bettingFeePercentage, uint256 _fundFeePercentage) external",
  "function createMarket(string memory _marketId, string memory _question, int64 _resolutionDate, uint256 _liquidityGoal) external payable",
  "function addLiquidity(string memory _marketId) external payable",
  "function removeLiquidity(string memory _marketId) external",
  "function claimLPRewards(string memory _marketId) external",
  "function buyTokens(string memory _marketId, bool _isYes, uint256 _amount) external payable",
  "function sellTokens(string memory _marketId, bool _isYes, uint256 _amount) external",
  "function claimWinnings(string memory _marketId) external",
  "function resolveMarket(string memory _marketId, bool _result) external",
  "function requestOracleResolution(string memory _marketId) external",
  "function finalizeFromOracle(string memory _marketId) external",
  "function withdraw(string memory _marketId, address _receiver, uint256 _amount) external",
  "function getMarket(string memory _marketId) external view returns (tuple(address creator, uint8 marketStatus, bool result, uint256 qYes, uint256 qNo, uint256 b, uint256 totalVolume, uint256 liquidity, uint256 liquidityGoal, uint256 totalLPShares, uint256 accumulatedFees, int64 resolutionDate, string question, bytes32 oracleRequestId))",
  "function getGlobal() external view returns (tuple(address admin, address feeAuthority, uint256 creatorFeeAmount, uint256 bettingFeePercentage, uint256 fundFeePercentage))",
  "function initialized() external view returns (bool)",
  "function marketExists(string memory _marketId) external view returns (bool)",
  "function getPrices(string memory _marketId) external view returns (uint256 yesPrice, uint256 noPrice)",
  "function estimateBuyCost(string memory _marketId, bool _isYes, uint256 _amount) external view returns (uint256 cost, uint256 fee)",
  "function estimateSellRefund(string memory _marketId, bool _isYes, uint256 _amount) external view returns (uint256 refund, uint256 fee)",
  "function getUserTokens(string memory _marketId, address _user) external view returns (uint256 yesTokens, uint256 noTokens)",
  "function getLPInfo(string memory _marketId, address _user) external view returns (uint256 shares, uint256 totalShares, bool claimed)",
  "function winningsClaimed(bytes32, address) external view returns (bool)",
];

const OPTIMISTIC_ORACLE_ABI = [
  "function requestResolution(string memory question, int64 resolutionTime) external returns (bytes32)",
  "function proposeAnswer(bytes32 questionId, int256 value) external payable",
  "function disputeAnswer(bytes32 questionId) external payable",
  "function settleProposal(bytes32 questionId) external",
  "function resolveDispute(bytes32 questionId, int256 finalValue) external",
  "function getProposal(bytes32 questionId) external view returns (tuple(address proposer, int256 proposedValue, uint256 proposalTime, uint256 bondAmount, bool disputed, address disputer, uint256 disputeBond, bool settled))",
  "function canSettle(bytes32 questionId) external view returns (bool)",
  "function canDispute(bytes32 questionId) external view returns (bool)",
  "function disputeTimeRemaining(bytes32 questionId) external view returns (uint256)",
  "function isResolved(bytes32 questionId) external view returns (bool)",
  "function getResolvedValue(bytes32 questionId) external view returns (int256)",
  "function adminBond() external view returns (uint256)",
  "function userBond() external view returns (uint256)",
];

// ============ Helpers ============
export const getProvider = () => {
  const rpcUrl = HEDERA_NETWORK === "mainnet"
    ? "https://mainnet.hashio.io/api"
    : "https://testnet.hashio.io/api";
  return new ethers.JsonRpcProvider(rpcUrl);
};

export const getPredictionMarketContract = (signerOrProvider?: ethers.Signer | ethers.Provider) => {
  return new ethers.Contract(PREDICTION_MARKET_CONTRACT, PREDICTION_MARKET_ABI, signerOrProvider || getProvider());
};

export const getOptimisticOracleContract = (signerOrProvider?: ethers.Signer | ethers.Provider) => {
  return new ethers.Contract(OPTIMISTIC_ORACLE_CONTRACT, OPTIMISTIC_ORACLE_ABI, signerOrProvider || getProvider());
};

// ============ Create Market ============
export const createMarket = async (param: CreateMarketType & { signer: JsonRpcSigner; liquidityGoal?: number }) => {
  if (!param.signer) throw new Error("Wallet not connected");
  console.log("Creating market with params:", param);

  const contract = getPredictionMarketContract(param.signer);
  const global = await contract.getGlobal();
  const creatorFee = global.creatorFeeAmount;
  const creatorFeeInWeibars = creatorFee * BigInt(1e10);

  const resolutionDate = Math.floor(new Date(param.date).getTime() / 1000);

  // Liquidity goal in tinybars (default 100 HBAR if not set)
  const liquidityGoalTinybars = param.liquidityGoal
    ? BigInt(param.liquidityGoal) * SCALE
    : BigInt(100) * SCALE;

  try {
    const tx = await contract.createMarket(
      param.marketID,
      param.question,
      resolutionDate,
      liquidityGoalTinybars,
      { value: creatorFeeInWeibars, gasLimit: 800000 }
    );
    console.log("Transaction sent:", tx.hash);
    const receipt = await tx.wait();
    console.log("Transaction confirmed:", receipt);
    return { success: true, txHash: tx.hash, marketId: param.marketID };
  } catch (error: any) {
    console.error("Error creating market:", error);
    throw new Error(error.message || "Failed to create market");
  }
};

// ============ Deposit Liquidity ============
export const depositLiquidity = async (param: DepositeLiquidityType & { signer: JsonRpcSigner }) => {
  if (!param.signer) throw new Error("Wallet not connected");
  console.log("Depositing liquidity:", param.amount, "HBAR to market:", param.market_id);

  const contract = getPredictionMarketContract(param.signer);
  const amountInWei = ethers.parseEther(param.amount.toString());

  try {
    const tx = await contract.addLiquidity(param.market_id, {
      value: amountInWei,
      gasLimit: 500000,
    });
    console.log("Transaction sent:", tx.hash);
    const receipt = await tx.wait();
    console.log("Transaction confirmed:", receipt);

    const market = await contract.getMarket(param.market_id);
    const statusMap = ["prepare", "active", "finished"];
    return { status: statusMap[Number(market.marketStatus)] || "prepare", txHash: tx.hash };
  } catch (error: any) {
    console.error("Error depositing liquidity:", error);
    throw new Error(error.message || "Failed to deposit liquidity");
  }
};

// ============ Remove Liquidity ============
export const removeLiquidity = async (marketId: string, signer: JsonRpcSigner) => {
  const contract = getPredictionMarketContract(signer);
  try {
    const tx = await contract.removeLiquidity(marketId, { gasLimit: 300000 });
    await tx.wait();
    return { success: true, txHash: tx.hash };
  } catch (error: any) {
    console.error("Error removing liquidity:", error);
    throw new Error(error.message || "Failed to remove liquidity");
  }
};

// ============ Claim LP Rewards ============
export const claimLPRewards = async (marketId: string, signer: JsonRpcSigner) => {
  const contract = getPredictionMarketContract(signer);
  try {
    const tx = await contract.claimLPRewards(marketId, { gasLimit: 300000 });
    await tx.wait();
    return { success: true, txHash: tx.hash };
  } catch (error: any) {
    console.error("Error claiming LP rewards:", error);
    throw new Error(error.message || "Failed to claim LP rewards");
  }
};

// ============ Buy Tokens (replaces placeBet/marketBetting) ============
export const buyTokens = async (param: BetType & { signer: JsonRpcSigner }) => {
  if (!param.signer) throw new Error("Wallet not connected");
  console.log("Buying tokens:", param);

  const contract = getPredictionMarketContract(param.signer);
  const readContract = getPredictionMarketContract(); // read-only provider

  try {
    // Amount in scaled units: 1 token = 1e8
    const scaledAmount = BigInt(param.amount) * SCALE;

    // Get cost estimate from contract
    const [rawCost, fee] = await readContract.estimateBuyCost(param.marketId, param.isYes, scaledAmount);
    const totalCostTinybars = rawCost + fee;

    // Add 5% buffer for rounding
    const totalWithBuffer = totalCostTinybars + (totalCostTinybars / BigInt(20));

    // Convert tinybars to weibars for MetaMask (relay converts back to tinybars for contract)
    const valueInWeibars = totalWithBuffer * BigInt(1e10);

    console.log("Cost:", Number(rawCost) / 1e8, "HBAR, Fee:", Number(fee) / 1e8, "HBAR, Sending:", Number(valueInWeibars) / 1e18, "HBAR (weibars)");

    const tx = await contract.buyTokens(
      param.marketId, param.isYes, scaledAmount,
      { value: valueInWeibars, gasLimit: 800000 }
    );
    console.log("Transaction sent:", tx.hash);
    const receipt = await tx.wait();
    if (receipt && receipt.status === 0) {
      throw new Error("Transaction reverted on-chain");
    }
    console.log("Transaction confirmed:", receipt);

    // Get updated prices
    const [yesPrice, noPrice] = await contract.getPrices(param.marketId);

    return {
      success: true,
      txHash: tx.hash,
      yesPrice: Number(yesPrice) / 1e8,
      noPrice: Number(noPrice) / 1e8,
      cost: Number(rawCost) / 1e8,
      fee: Number(fee) / 1e8,
    };
  } catch (error: any) {
    console.error("Error buying tokens:", error);
    throw new Error(error.message || "Failed to buy tokens");
  }
};

// Keep old name as alias for backward compatibility
export const marketBetting = buyTokens;

// ============ Sell Tokens ============
export const sellTokens = async (marketId: string, isYes: boolean, amount: number, signer: JsonRpcSigner) => {
  const contract = getPredictionMarketContract(signer);

  try {
    const scaledAmount = BigInt(amount) * SCALE;

    const iface = new ethers.Interface(PREDICTION_MARKET_ABI);
    const data = iface.encodeFunctionData("sellTokens", [marketId, isYes, scaledAmount]);

    const tx = await signer.sendTransaction({
      to: PREDICTION_MARKET_CONTRACT,
      data,
      gasLimit: 600000,
    });
    console.log("Sell tx sent:", tx.hash);
    const receipt = await tx.wait();
    if (receipt && receipt.status === 0) {
      throw new Error("Sell transaction reverted on-chain");
    }
    console.log("Sell tx confirmed:", receipt);

    const [yesPrice, noPrice] = await contract.getPrices(marketId);

    return {
      success: true,
      txHash: tx.hash,
      yesPrice: Number(yesPrice) / 1e8,
      noPrice: Number(noPrice) / 1e8,
    };
  } catch (error: any) {
    console.error("Error selling tokens:", error);
    throw new Error(error.message || "Failed to sell tokens");
  }
};

// ============ Claim Winnings ============
export const claimWinnings = async (marketId: string, signer: JsonRpcSigner) => {
  const contract = getPredictionMarketContract(signer);
  try {
    const tx = await contract.claimWinnings(marketId, { gasLimit: 300000 });
    await tx.wait();
    return { success: true, txHash: tx.hash };
  } catch (error: any) {
    console.error("Error claiming winnings:", error);
    throw new Error(error.message || "Failed to claim winnings");
  }
};

// ============ Estimate Buy Cost (read-only) ============
export const estimateBetCost = async (marketId: string, amount: number, isYes: boolean) => {
  try {
    const contract = getPredictionMarketContract();
    const scaledAmount = BigInt(amount) * SCALE;

    const [rawCost, fee] = await contract.estimateBuyCost(marketId, isYes, scaledAmount);

    const costHbar = Number(rawCost) / 1e8;
    const feeHbar = Number(fee) / 1e8;
    return { cost: costHbar, fee: feeHbar, total: costHbar + feeHbar };
  } catch (error) {
    console.error("Error estimating bet cost:", error);
    return null;
  }
};

// ============ Estimate Sell Refund (read-only) ============
export const estimateSellRefund = async (marketId: string, amount: number, isYes: boolean) => {
  try {
    const contract = getPredictionMarketContract();
    const scaledAmount = BigInt(amount) * SCALE;

    const [refund, fee] = await contract.estimateSellRefund(marketId, isYes, scaledAmount);

    return {
      refund: Number(refund) / 1e8,
      fee: Number(fee) / 1e8,
      net: (Number(refund) - Number(fee)) / 1e8,
    };
  } catch (error) {
    console.error("Error estimating sell refund:", error);
    return null;
  }
};

// ============ Fetch Market Info (read-only) ============
export const fetchMarketInfo = async (marketId: string) => {
  try {
    const contract = getPredictionMarketContract();
    const exists = await contract.marketExists(marketId);
    if (!exists) return null;

    const market = await contract.getMarket(marketId);
    const statusMap = ["prepare", "active", "finished"];

    // Get prices
    let yesPrice = 0.5, noPrice = 0.5;
    try {
      const [yp, np] = await contract.getPrices(marketId);
      yesPrice = Number(yp) / 1e8;
      noPrice = Number(np) / 1e8;
    } catch { /* default 50/50 */ }

    return {
      status: statusMap[Number(market.marketStatus)] || "prepare",
      creator: market.creator,
      qYes: Number(market.qYes) / 1e8,
      qNo: Number(market.qNo) / 1e8,
      b: Number(market.b) / 1e8,
      yesPrice,
      noPrice,
      totalVolume: Number(market.totalVolume) / 1e8,
      liquidity: Number(market.liquidity) / 1e8,
      liquidityGoal: Number(market.liquidityGoal) / 1e8,
      totalLPShares: market.totalLPShares.toString(),
      accumulatedFees: Number(market.accumulatedFees) / 1e8, // stored in tinybars
      result: market.result,
      oracleRequestId: market.oracleRequestId === ethers.ZeroHash ? null : market.oracleRequestId,
    };
  } catch (error) {
    console.error("Error fetching market info:", error);
    return null;
  }
};

// ============ Get User Tokens (read-only) ============
export const getUserTokens = async (marketId: string, userAddress: string) => {
  try {
    const contract = getPredictionMarketContract();
    const [yesTokens, noTokens] = await contract.getUserTokens(marketId, userAddress);
    return { yesTokens: Number(yesTokens) / 1e8, noTokens: Number(noTokens) / 1e8 };
  } catch (error) {
    console.error("Error getting user tokens:", error);
    return { yesTokens: 0, noTokens: 0 };
  }
};

// ============ Check if winnings already claimed ============
export const hasClaimedWinnings = async (marketId: string, userAddress: string): Promise<boolean> => {
  try {
    const contract = getPredictionMarketContract();
    const h = ethers.keccak256(ethers.toUtf8Bytes(marketId));
    return await contract.winningsClaimed(h, userAddress);
  } catch { return false; }
};

// ============ Get LP Info (read-only) ============
export const getLPInfo = async (marketId: string, userAddress: string) => {
  try {
    const contract = getPredictionMarketContract();
    const [shares, totalShares, claimed] = await contract.getLPInfo(marketId, userAddress);
    return { shares: Number(shares), totalShares: Number(totalShares), claimed };
  } catch (error) {
    console.error("Error getting LP info:", error);
    return { shares: 0, totalShares: 0, claimed: false };
  }
};

// ============ Get Prices (read-only) ============
export const getPrices = async (marketId: string) => {
  try {
    const contract = getPredictionMarketContract();
    const [yesPrice, noPrice] = await contract.getPrices(marketId);
    return { yes: Number(yesPrice) / 1e8, no: Number(noPrice) / 1e8 };
  } catch (error) {
    console.error("Error getting prices:", error);
    return { yes: 0.5, no: 0.5 };
  }
};

// ============ Get Global Settings ============
export const getGlobalSettings = async () => {
  try {
    const contract = getPredictionMarketContract();
    const g = await contract.getGlobal();
    return {
      admin: g.admin,
      feeAuthority: g.feeAuthority,
      creatorFeeAmount: Number(g.creatorFeeAmount) / 1e8,
      bettingFeePercentage: Number(g.bettingFeePercentage),
      fundFeePercentage: Number(g.fundFeePercentage),
    };
  } catch (error) {
    console.error("Error getting global settings:", error);
    return null;
  }
};

// ============ Oracle Functions ============

// Request oracle resolution (anyone can call after resolution date)
export const requestOracleResolution = async (marketId: string, signer: JsonRpcSigner) => {
  const contract = getPredictionMarketContract(signer);
  try {
    const tx = await contract.requestOracleResolution(marketId, { gasLimit: 500000 });
    console.log("Oracle resolution request tx:", tx.hash);
    await tx.wait();
    return { success: true, txHash: tx.hash };
  } catch (error: any) {
    console.error("Error requesting oracle resolution:", error);
    throw new Error(error.message || "Failed to request oracle resolution");
  }
};

// Direct admin resolve (bypasses oracle)
export const resolveMarketDirect = async (marketId: string, result: boolean, signer: JsonRpcSigner) => {
  const contract = getPredictionMarketContract(signer);
  try {
    const tx = await contract.resolveMarket(marketId, result, { gasLimit: 300000 });
    console.log("Direct resolve tx:", tx.hash);
    await tx.wait();
    return { success: true, txHash: tx.hash };
  } catch (error: any) {
    console.error("Error resolving market directly:", error);
    throw new Error(error.message || "Failed to resolve market");
  }
};

// Finalize market from oracle result
export const finalizeMarketFromOracle = async (marketId: string, signer: JsonRpcSigner) => {
  const contract = getPredictionMarketContract(signer);
  try {
    const tx = await contract.finalizeFromOracle(marketId, { gasLimit: 300000 });
    console.log("Finalize from oracle tx:", tx.hash);
    await tx.wait();
    return { success: true, txHash: tx.hash };
  } catch (error: any) {
    console.error("Error finalizing from oracle:", error);
    throw new Error(error.message || "Failed to finalize market from oracle");
  }
};

// Propose answer to oracle (bond: admin 2 HBAR, user 10,000 HBAR — sent as weibars)
export const proposeAnswer = async (questionId: string, value: 1 | -1, signer: JsonRpcSigner, isAdmin = false) => {
  const contract = getOptimisticOracleContract(signer);
  const bondTinybars = isAdmin ? await contract.adminBond() : await contract.userBond();
  // Convert tinybars to weibars for MetaMask
  const bondWeibars = BigInt(bondTinybars) * BigInt(1e10);
  try {
    const tx = await contract.proposeAnswer(questionId, value, { value: bondWeibars, gasLimit: 400000 });
    console.log("Propose answer tx:", tx.hash);
    await tx.wait();
    return { success: true, txHash: tx.hash };
  } catch (error: any) {
    console.error("Error proposing answer:", error);
    throw new Error(error.message || "Failed to propose answer");
  }
};

// Dispute answer (bond: admin 2 HBAR, user 10,000 HBAR — sent as weibars)
export const disputeAnswer = async (questionId: string, signer: JsonRpcSigner, isAdmin = false) => {
  const contract = getOptimisticOracleContract(signer);
  const bondTinybars = isAdmin ? await contract.adminBond() : await contract.userBond();
  const bondWeibars = BigInt(bondTinybars) * BigInt(1e10);
  try {
    const tx = await contract.disputeAnswer(questionId, { value: bondWeibars, gasLimit: 400000 });
    console.log("Dispute answer tx:", tx.hash);
    await tx.wait();
    return { success: true, txHash: tx.hash };
  } catch (error: any) {
    console.error("Error disputing answer:", error);
    throw new Error(error.message || "Failed to dispute answer");
  }
};

// Settle undisputed proposal (anyone, after dispute window)
export const settleProposal = async (questionId: string, signer: JsonRpcSigner) => {
  const contract = getOptimisticOracleContract(signer);
  try {
    const tx = await contract.settleProposal(questionId, { gasLimit: 300000 });
    console.log("Settle proposal tx:", tx.hash);
    await tx.wait();
    return { success: true, txHash: tx.hash };
  } catch (error: any) {
    console.error("Error settling proposal:", error);
    throw new Error(error.message || "Failed to settle proposal");
  }
};

// Admin resolves a disputed proposal
export const resolveOracleDispute = async (questionId: string, finalValue: 1 | -1, signer: JsonRpcSigner) => {
  const contract = getOptimisticOracleContract(signer);
  try {
    const tx = await contract.resolveDispute(questionId, finalValue, { gasLimit: 300000 });
    console.log("Resolve dispute tx:", tx.hash);
    await tx.wait();
    return { success: true, txHash: tx.hash };
  } catch (error: any) {
    console.error("Error resolving dispute:", error);
    throw new Error(error.message || "Failed to resolve dispute");
  }
};

export const canSettle = async (questionId: string): Promise<boolean> => {
  try { return await getOptimisticOracleContract().canSettle(questionId); }
  catch { return false; }
};

export const canDispute = async (questionId: string): Promise<boolean> => {
  try { return await getOptimisticOracleContract().canDispute(questionId); }
  catch { return false; }
};

export const getProposal = async (questionId: string) => {
  try {
    const p = await getOptimisticOracleContract().getProposal(questionId);
    return {
      proposer: p.proposer,
      proposedValue: Number(p.proposedValue),
      proposalTime: Number(p.proposalTime),
      bondAmount: Number(p.bondAmount) / 1e8, // tinybars to HBAR
      disputed: p.disputed,
      disputer: p.disputer,
      disputeBond: Number(p.disputeBond) / 1e8,
      settled: p.settled,
    };
  } catch (error) {
    console.error("Error getting proposal:", error);
    return null;
  }
};

// Get oracle request ID from market
export const getOracleRequestId = async (marketId: string): Promise<string | null> => {
  try {
    const contract = getPredictionMarketContract();
    const market = await contract.getMarket(marketId);
    const requestId = market.oracleRequestId;
    // bytes32(0) means no request yet
    if (requestId === ethers.ZeroHash) return null;
    return requestId;
  } catch (error) {
    console.error("Error getting oracle request ID:", error);
    return null;
  }
};

// Get dispute time remaining (seconds)
export const getDisputeTimeRemaining = async (questionId: string): Promise<number> => {
  try {
    const oracleContract = getOptimisticOracleContract();
    const remaining = await oracleContract.disputeTimeRemaining(questionId);
    return Number(remaining);
  } catch (error) {
    console.error("Error getting dispute time remaining:", error);
    return 0;
  }
};

// Check if oracle question is resolved
export const isOracleResolved = async (questionId: string): Promise<boolean> => {
  try {
    const oracleContract = getOptimisticOracleContract();
    return await oracleContract.isResolved(questionId);
  } catch { return false; }
};

// Get resolved value from oracle
export const getOracleResolvedValue = async (questionId: string): Promise<number | null> => {
  try {
    const oracleContract = getOptimisticOracleContract();
    const val = await oracleContract.getResolvedValue(questionId);
    return Number(val);
  } catch { return null; }
};


// ============ Multi-Outcome Event Contract ============
const MULTI_OUTCOME_ABI = [
  "function initialize(address _feeAuthority, uint256 _creatorFeeAmount, uint256 _bettingFeePercentage, uint256 _fundFeePercentage) external",
  "function createEvent(string memory _eventId, string memory _question, string[] memory _outcomeNames, int64 _resolutionDate, uint256 _liquidityGoal) external payable",
  "function fundEvent(string memory _eventId) external payable",
  "function removeLiquidity(string memory _eventId) external",
  "function claimLPRewards(string memory _eventId) external",
  "function buyTokens(string memory _eventId, uint256 _outcomeIndex, bool _isYes, uint256 _amount) external payable",
  "function sellTokens(string memory _eventId, uint256 _outcomeIndex, bool _isYes, uint256 _amount) external",
  "function claimWinnings(string memory _eventId) external",
  "function resolveEvent(string memory _eventId, int256 _winningOutcome) external",
  "function requestOracleResolution(string memory _eventId) external",
  "function finalizeFromOracle(string memory _eventId) external",
  "function getEvent(string memory _eventId) external view returns (tuple(address creator, uint8 status, string question, int64 resolutionDate, uint256 outcomeCount, uint256 liquidity, uint256 liquidityGoal, uint256 totalLPShares, int256 winningOutcome, bytes32 oracleRequestId))",
  "function getOutcome(string memory _eventId, uint256 _index) external view returns (tuple(string name, uint256 qYes, uint256 qNo, uint256 b, uint256 totalVolume, uint256 accumulatedFees))",
  "function getOutcomePrices(string memory _eventId, uint256 _index) external view returns (uint256 yesPrice, uint256 noPrice)",
  "function eventExists(string memory _eventId) external view returns (bool)",
  "function getEventCount() external view returns (uint256)",
  "function getGlobal() external view returns (tuple(address admin, address feeAuthority, uint256 creatorFeeAmount, uint256 bettingFeePercentage, uint256 fundFeePercentage))",
  "function getUserTokens(string memory _eventId, uint256 _outcomeIndex, address _user) external view returns (uint256 yesTokens, uint256 noTokens)",
  "function getLPInfo(string memory _eventId, address _user) external view returns (uint256 shares, uint256 totalShares, bool claimed)",
  "function estimateBuyCost(string memory _eventId, uint256 _outcomeIndex, bool _isYes, uint256 _amount) external view returns (uint256 cost, uint256 fee)",
];

const MULTI_OUTCOME_ORACLE_ABI = [
  "function requestResolution(string memory question, uint256 resolutionTime, uint256 outcomeCount) external returns (bytes32)",
  "function proposeAnswer(bytes32 questionId, int256 value) external payable",
  "function disputeAnswer(bytes32 questionId) external payable",
  "function settleProposal(bytes32 questionId) external",
  "function resolveDispute(bytes32 questionId, int256 finalValue) external",
  "function getProposal(bytes32 questionId) external view returns (tuple(address proposer, int256 proposedValue, uint256 proposalTime, uint256 bondAmount, bool disputed, address disputer, uint256 disputeBond, bool settled))",
  "function getRequest(bytes32 questionId) external view returns (tuple(address requester, bytes32 questionId, string question, uint256 requestTime, uint256 resolutionTime, bool resolved, int256 resolvedValue, uint256 outcomeCount))",
  "function canSettle(bytes32 questionId) external view returns (bool)",
  "function canDispute(bytes32 questionId) external view returns (bool)",
  "function disputeTimeRemaining(bytes32 questionId) external view returns (uint256)",
  "function isResolved(bytes32 questionId) external view returns (bool)",
  "function getResolvedValue(bytes32 questionId) external view returns (int256)",
  "function adminBond() external view returns (uint256)",
  "function userBond() external view returns (uint256)",
];

export const getMultiOutcomeContract = (signerOrProvider?: ethers.Signer | ethers.Provider) => {
  return new ethers.Contract(MULTI_OUTCOME_CONTRACT, MULTI_OUTCOME_ABI, signerOrProvider || getProvider());
};

export const getMultiOutcomeOracleContract = (signerOrProvider?: ethers.Signer | ethers.Provider) => {
  return new ethers.Contract(MULTI_OUTCOME_ORACLE_CONTRACT, MULTI_OUTCOME_ORACLE_ABI, signerOrProvider || getProvider());
};

// ============ Create Multi-Outcome Event (1 tx) ============
export const createMultiOutcomeEvent = async (params: {
  eventId: string;
  question: string;
  outcomeNames: string[];
  date: string;
  liquidityGoal: number;
  signer: JsonRpcSigner;
}) => {
  if (!params.signer) throw new Error("Wallet not connected");
  const contract = getMultiOutcomeContract(params.signer);
  const global = await contract.getGlobal();
  const creatorFee = global.creatorFeeAmount;
  const creatorFeeInWeibars = creatorFee * BigInt(1e10);

  const resolutionDate = Math.floor(new Date(params.date).getTime() / 1000);
  const liquidityGoalTinybars = BigInt(params.liquidityGoal) * SCALE;

  try {
    const tx = await contract.createEvent(
      params.eventId,
      params.question,
      params.outcomeNames,
      resolutionDate,
      liquidityGoalTinybars,
      { value: creatorFeeInWeibars, gasLimit: 1500000 }
    );
    console.log("Multi-outcome event tx sent:", tx.hash);
    const receipt = await tx.wait();
    console.log("Multi-outcome event confirmed:", receipt);
    return { success: true, txHash: tx.hash, eventId: params.eventId };
  } catch (error: any) {
    console.error("Error creating multi-outcome event:", error);
    throw new Error(error.message || "Failed to create multi-outcome event");
  }
};

// ============ Fund Multi-Outcome Event (1 tx) ============
export const fundMultiOutcomeEvent = async (params: {
  eventId: string;
  amount: number;
  signer: JsonRpcSigner;
}) => {
  if (!params.signer) throw new Error("Wallet not connected");
  const contract = getMultiOutcomeContract(params.signer);
  const amountInWei = ethers.parseEther(params.amount.toString());

  try {
    const tx = await contract.fundEvent(params.eventId, {
      value: amountInWei,
      gasLimit: 800000,
    });
    console.log("Fund event tx sent:", tx.hash);
    const receipt = await tx.wait();
    console.log("Fund event confirmed:", receipt);

    // Check status after funding
    const evt: any = await contract["getEvent(string)"](params.eventId);
    const statusMap = ["prepare", "active", "finished"];
    return { status: statusMap[Number(evt.status)] || "prepare", txHash: tx.hash };
  } catch (error: any) {
    console.error("Error funding multi-outcome event:", error);
    throw new Error(error.message || "Failed to fund event");
  }
};

// ============ Fetch Multi-Outcome Event Info ============
export const fetchMultiOutcomeEventInfo = async (eventId: string, retries = 2): Promise<any> => {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const contract = getMultiOutcomeContract();

      // Use getEvent directly — if the event doesn't exist, creator will be zero address
      // NOTE: Must use bracket notation because ethers.js v6 has a built-in getEvent() method
      // on Contract that looks up event fragments, colliding with our contract function name.
      const evt: any = await contract["getEvent(string)"](eventId);
      if (!evt || evt.creator === "0x0000000000000000000000000000000000000000") return null;

      const statusMap = ["prepare", "active", "finished"];
      const outcomeCount = Number(evt.outcomeCount);
      const outcomesData = [];
      let anyTraded = false;

      // Batch outcome fetches in parallel
      const outcomePromises = [];
      for (let i = 0; i < outcomeCount; i++) {
        outcomePromises.push(
          Promise.all([
            contract.getOutcome(eventId, i),
            contract.getOutcomePrices(eventId, i).catch(() => null),
          ])
        );
      }
      const outcomeResults = await Promise.all(outcomePromises);

      for (let i = 0; i < outcomeCount; i++) {
        const [o, prices] = outcomeResults[i];
        let yesPrice = 0.5, noPrice = 0.5;
        const qYes = Number(o.qYes) / 1e8;
        const qNo = Number(o.qNo) / 1e8;
        if (qYes > 0 || qNo > 0) anyTraded = true;
        if (prices) {
          yesPrice = Number(prices[0]) / 1e8;
          noPrice = Number(prices[1]) / 1e8;
        }
        outcomesData.push({
          name: o.name,
          qYes,
          qNo,
          b: Number(o.b) / 1e8,
          totalVolume: Number(o.totalVolume) / 1e8,
          yesPrice,
          noPrice,
        });
      }

      // Normalize prices so all outcome yesPrices sum to ~1.0
      if (outcomeCount > 0) {
        if (!anyTraded) {
          // No trading yet — equal shares
          const equalShare = 1 / outcomeCount;
          for (const o of outcomesData) {
            o.yesPrice = equalShare;
            o.noPrice = 1 - equalShare;
          }
        } else {
          // Trading has happened — each outcome has independent LMSR prices.
          // Raw yesPrices don't sum to 1, so normalize them.
          const rawSum = outcomesData.reduce((s, o) => s + o.yesPrice, 0);
          if (rawSum > 0) {
            for (const o of outcomesData) {
              o.yesPrice = o.yesPrice / rawSum;
              o.noPrice = 1 - o.yesPrice;
            }
          }
        }
      }

      // oracleRequestId from new contract
      const oracleRequestId = evt.oracleRequestId === ethers.ZeroHash ? null : evt.oracleRequestId;

      return {
        status: statusMap[Number(evt.status)] || "prepare",
        creator: evt.creator,
        question: evt.question,
        outcomeCount,
        liquidity: Number(evt.liquidity) / 1e8,
        liquidityGoal: Number(evt.liquidityGoal) / 1e8,
        totalLPShares: evt.totalLPShares.toString(),
        winningOutcome: Number(evt.winningOutcome),
        outcomes: outcomesData,
        oracleRequestId,
      };
    } catch (error) {
      console.error(`fetchMultiOutcomeEventInfo attempt ${attempt + 1} failed:`, error);
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
        continue;
      }
      return null;
    }
  }
  return null;
};

// ============ Buy Tokens on Multi-Outcome ============
export const buyMultiOutcomeTokens = async (params: {
  eventId: string;
  outcomeIndex: number;
  isYes: boolean;
  amount: number;
  signer: JsonRpcSigner;
}) => {
  if (!params.signer) throw new Error("Wallet not connected");
  const contract = getMultiOutcomeContract(params.signer);
  const readContract = getMultiOutcomeContract();
  const scaledAmount = BigInt(params.amount) * SCALE;

  try {
    const [cost, fee] = await readContract.estimateBuyCost(
      params.eventId, params.outcomeIndex, params.isYes, scaledAmount
    );
    const totalCost = cost + fee;
    const totalCostWeibars = totalCost * BigInt(1e10);
    const buffer = totalCostWeibars * BigInt(105) / BigInt(100);

    const tx = await contract.buyTokens(
      params.eventId, params.outcomeIndex, params.isYes, scaledAmount,
      { value: buffer, gasLimit: 500000 }
    );
    const receipt = await tx.wait();
    return { success: true, txHash: tx.hash, cost: Number(totalCost) / 1e8 };
  } catch (error: any) {
    console.error("Error buying multi-outcome tokens:", error);
    throw new Error(error.message || "Failed to buy tokens");
  }
};

// ============ Sell Tokens on Multi-Outcome ============
export const sellMultiOutcomeTokens = async (params: {
  eventId: string;
  outcomeIndex: number;
  isYes: boolean;
  amount: number;
  signer: JsonRpcSigner;
}) => {
  if (!params.signer) throw new Error("Wallet not connected");
  const contract = getMultiOutcomeContract(params.signer);
  const scaledAmount = BigInt(params.amount) * SCALE;
  try {
    const tx = await contract.sellTokens(
      params.eventId, params.outcomeIndex, params.isYes, scaledAmount,
      { gasLimit: 500000 }
    );
    await tx.wait();
    return { success: true, txHash: tx.hash };
  } catch (error: any) {
    console.error("Error selling multi-outcome tokens:", error);
    throw new Error(error.message || "Failed to sell tokens");
  }
};

// ============ Get User Tokens for Multi-Outcome ============
export const getMultiOutcomeUserTokens = async (eventId: string, outcomeIndex: number, userAddress: string) => {
  try {
    const contract = getMultiOutcomeContract();
    const [yesTokens, noTokens] = await contract.getUserTokens(eventId, outcomeIndex, userAddress);
    return { yesTokens: Number(yesTokens) / 1e8, noTokens: Number(noTokens) / 1e8 };
  } catch {
    return { yesTokens: 0, noTokens: 0 };
  }
};

// ============ Get LP Info for Multi-Outcome ============
export const getMultiOutcomeLPInfo = async (eventId: string, userAddress: string) => {
  try {
    const contract = getMultiOutcomeContract();
    const [shares, totalShares, claimed] = await contract.getLPInfo(eventId, userAddress);
    return { shares: Number(shares), totalShares: Number(totalShares), claimed };
  } catch {
    return { shares: 0, totalShares: 0, claimed: false };
  }
};

// ============ Remove Liquidity from Multi-Outcome ============
export const removeMultiOutcomeLiquidity = async (eventId: string, signer: JsonRpcSigner) => {
  const contract = getMultiOutcomeContract(signer);
  try {
    const tx = await contract.removeLiquidity(eventId, { gasLimit: 500000 });
    await tx.wait();
    return { success: true, txHash: tx.hash };
  } catch (error: any) {
    console.error("Error removing multi-outcome liquidity:", error);
    throw new Error(error.message || "Failed to remove liquidity");
  }
};

// ============ Claim LP Rewards from Multi-Outcome ============
export const claimMultiOutcomeLPRewards = async (eventId: string, signer: JsonRpcSigner) => {
  const contract = getMultiOutcomeContract(signer);
  try {
    const tx = await contract.claimLPRewards(eventId, { gasLimit: 500000 });
    await tx.wait();
    return { success: true, txHash: tx.hash };
  } catch (error: any) {
    console.error("Error claiming multi-outcome LP rewards:", error);
    throw new Error(error.message || "Failed to claim LP rewards");
  }
};

// ============ Claim Winnings from Multi-Outcome ============
export const claimMultiOutcomeWinnings = async (eventId: string, signer: JsonRpcSigner) => {
  const contract = getMultiOutcomeContract(signer);
  try {
    const tx = await contract.claimWinnings(eventId, { gasLimit: 500000 });
    await tx.wait();
    return { success: true, txHash: tx.hash };
  } catch (error: any) {
    console.error("Error claiming multi-outcome winnings:", error);
    throw new Error(error.message || "Failed to claim winnings");
  }
};

// ============ Check if multi-outcome winnings already claimed ============
export const hasMultiOutcomeClaimedWinnings = async (eventId: string, userAddress: string): Promise<boolean> => {
  try {
    const contract = getMultiOutcomeContract();
    const claimed = await contract.winningsClaimed(ethers.keccak256(ethers.toUtf8Bytes(eventId)), userAddress);
    return claimed;
  } catch {
    return false;
  }
};



// ============ Multi-Outcome Oracle Functions ============

// Request oracle resolution for multi-outcome event
export const requestMultiOutcomeOracleResolution = async (eventId: string, signer: JsonRpcSigner) => {
  const contract = getMultiOutcomeContract(signer);
  try {
    const tx = await contract.requestOracleResolution(eventId, { gasLimit: 500000 });
    console.log("Multi-outcome oracle resolution request tx:", tx.hash);
    await tx.wait();
    return { success: true, txHash: tx.hash };
  } catch (error: any) {
    console.error("Error requesting multi-outcome oracle resolution:", error);
    throw new Error(error.message || "Failed to request oracle resolution");
  }
};

// Direct admin resolve for multi-outcome (bypasses oracle)
export const resolveMultiOutcomeEventDirect = async (eventId: string, winningOutcome: number, signer: JsonRpcSigner) => {
  const contract = getMultiOutcomeContract(signer);
  try {
    const tx = await contract.resolveEvent(eventId, winningOutcome, { gasLimit: 300000 });
    console.log("Direct multi-outcome resolve tx:", tx.hash);
    await tx.wait();
    return { success: true, txHash: tx.hash };
  } catch (error: any) {
    console.error("Error resolving multi-outcome event directly:", error);
    throw new Error(error.message || "Failed to resolve event");
  }
};

// Finalize multi-outcome event from oracle result
export const finalizeMultiOutcomeFromOracle = async (eventId: string, signer: JsonRpcSigner) => {
  const contract = getMultiOutcomeContract(signer);
  try {
    const tx = await contract.finalizeFromOracle(eventId, { gasLimit: 300000 });
    console.log("Finalize multi-outcome from oracle tx:", tx.hash);
    await tx.wait();
    return { success: true, txHash: tx.hash };
  } catch (error: any) {
    console.error("Error finalizing multi-outcome from oracle:", error);
    throw new Error(error.message || "Failed to finalize event from oracle");
  }
};

// Propose answer to multi-outcome oracle
export const proposeMultiOutcomeAnswer = async (questionId: string, value: number, signer: JsonRpcSigner, isAdmin = false) => {
  const contract = getMultiOutcomeOracleContract(signer);

  // Pre-validate: check request exists and state before sending tx
  try {
    const request = await contract.getRequest(questionId);
    const requester = request.requester;
    const resTime = Number(request.resolutionTime);
    const nowSec = Math.floor(Date.now() / 1000);
    console.log("Oracle request:", {
      requester, question: request.question,
      resolutionTime: resTime, resolved: request.resolved,
      outcomeCount: Number(request.outcomeCount),
      now: nowSec, timeUntilResolution: resTime - nowSec,
    });

    if (requester === "0x0000000000000000000000000000000000000000") {
      throw new Error("Oracle request not found — did you request oracle resolution first?");
    }
    if (request.resolved) {
      throw new Error("This oracle request is already resolved.");
    }
    if (nowSec < resTime) {
      const remaining = resTime - nowSec;
      throw new Error(`Resolution time not reached yet. ${remaining}s remaining. Please wait.`);
    }
    if (value < -1 || value >= Number(request.outcomeCount)) {
      throw new Error(`Invalid outcome index ${value}. Must be -1 to ${Number(request.outcomeCount) - 1}.`);
    }

    const existingProposal = await contract.getProposal(questionId);
    console.log("Existing proposal:", { proposer: existingProposal.proposer });
    if (existingProposal.proposer !== "0x0000000000000000000000000000000000000000") {
      throw new Error("A proposal already exists for this question. Dispute or settle it instead.");
    }
  } catch (dbgErr: any) {
    if (dbgErr.message && (dbgErr.message.includes("Oracle request not found") || dbgErr.message.includes("Resolution time") || dbgErr.message.includes("already resolved") || dbgErr.message.includes("Invalid outcome") || dbgErr.message.includes("proposal already exists"))) {
      throw dbgErr;
    }
    console.warn("Debug: could not read oracle request/proposal:", dbgErr);
  }

  const bondTinybars = isAdmin ? await contract.adminBond() : await contract.userBond();
  const bondWeibars = BigInt(bondTinybars) * BigInt(1e10);
  console.log("Propose bond:", { bondTinybars: bondTinybars.toString(), bondWeibars: bondWeibars.toString(), isAdmin, value });
  try {
    const tx = await contract.proposeAnswer(questionId, value, { value: bondWeibars, gasLimit: 600000 });
    console.log("Multi-outcome propose answer tx:", tx.hash);
    await tx.wait();
    return { success: true, txHash: tx.hash };
  } catch (error: any) {
    console.error("Error proposing multi-outcome answer:", error);
    throw new Error(error.message || "Failed to propose answer");
  }
};

// Dispute multi-outcome oracle answer
export const disputeMultiOutcomeAnswer = async (questionId: string, signer: JsonRpcSigner, isAdmin = false) => {
  const contract = getMultiOutcomeOracleContract(signer);
  const bondTinybars = isAdmin ? await contract.adminBond() : await contract.userBond();
  const bondWeibars = BigInt(bondTinybars) * BigInt(1e10);
  try {
    const tx = await contract.disputeAnswer(questionId, { value: bondWeibars, gasLimit: 400000 });
    console.log("Multi-outcome dispute answer tx:", tx.hash);
    await tx.wait();
    return { success: true, txHash: tx.hash };
  } catch (error: any) {
    console.error("Error disputing multi-outcome answer:", error);
    throw new Error(error.message || "Failed to dispute answer");
  }
};

// Settle undisputed multi-outcome proposal
export const settleMultiOutcomeProposal = async (questionId: string, signer: JsonRpcSigner) => {
  const contract = getMultiOutcomeOracleContract(signer);
  try {
    const tx = await contract.settleProposal(questionId, { gasLimit: 300000 });
    console.log("Multi-outcome settle proposal tx:", tx.hash);
    await tx.wait();
    return { success: true, txHash: tx.hash };
  } catch (error: any) {
    console.error("Error settling multi-outcome proposal:", error);
    throw new Error(error.message || "Failed to settle proposal");
  }
};

// Admin resolves a disputed multi-outcome proposal
export const resolveMultiOutcomeOracleDispute = async (questionId: string, finalValue: number, signer: JsonRpcSigner) => {
  const contract = getMultiOutcomeOracleContract(signer);
  try {
    const tx = await contract.resolveDispute(questionId, finalValue, { gasLimit: 300000 });
    console.log("Multi-outcome resolve dispute tx:", tx.hash);
    await tx.wait();
    return { success: true, txHash: tx.hash };
  } catch (error: any) {
    console.error("Error resolving multi-outcome dispute:", error);
    throw new Error(error.message || "Failed to resolve dispute");
  }
};

export const canSettleMultiOutcome = async (questionId: string): Promise<boolean> => {
  try { return await getMultiOutcomeOracleContract().canSettle(questionId); }
  catch { return false; }
};

export const canDisputeMultiOutcome = async (questionId: string): Promise<boolean> => {
  try { return await getMultiOutcomeOracleContract().canDispute(questionId); }
  catch { return false; }
};

export const getMultiOutcomeProposal = async (questionId: string) => {
  try {
    const p = await getMultiOutcomeOracleContract().getProposal(questionId);
    return {
      proposer: p.proposer,
      proposedValue: Number(p.proposedValue),
      proposalTime: Number(p.proposalTime),
      bondAmount: Number(p.bondAmount) / 1e8,
      disputed: p.disputed,
      disputer: p.disputer,
      disputeBond: Number(p.disputeBond) / 1e8,
      settled: p.settled,
    };
  } catch (error) {
    console.error("Error getting multi-outcome proposal:", error);
    return null;
  }
};

export const getMultiOutcomeDisputeTimeRemaining = async (questionId: string): Promise<number> => {
  try {
    const remaining = await getMultiOutcomeOracleContract().disputeTimeRemaining(questionId);
    return Number(remaining);
  } catch { return 0; }
};

export const isMultiOutcomeOracleResolved = async (questionId: string): Promise<boolean> => {
  try { return await getMultiOutcomeOracleContract().isResolved(questionId); }
  catch { return false; }
};


// ============ FORE Token (HTS) ============

const HTS_PRECOMPILE = "0x0000000000000000000000000000000000000167";

const HTS_ASSOCIATE_ABI = [
  "function associateToken(address account, address token) external returns (int64)",
];

/**
 * Associate the FORE reward token with the connected wallet.
 * Users must associate before they can receive FORE rewards.
 */
export const associateFOREToken = async (signer: JsonRpcSigner): Promise<{ success: boolean; txHash?: string }> => {
  if (!FORE_TOKEN_ID) throw new Error("FORE token not configured");

  // Convert Hedera token ID (0.0.XXXXX) to EVM address
  const tokenNum = FORE_TOKEN_ID.split(".").pop();
  const tokenEvmAddress = "0x" + BigInt(tokenNum!).toString(16).padStart(40, "0");

  const htsContract = new ethers.Contract(HTS_PRECOMPILE, HTS_ASSOCIATE_ABI, signer);
  const userAddress = await signer.getAddress();

  try {
    const tx = await htsContract.associateToken(userAddress, tokenEvmAddress, { gasLimit: 1000000 });
    const receipt = await tx.wait();
    return { success: true, txHash: tx.hash };
  } catch (error: any) {
    // TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT is fine
    if (String(error?.message || error).includes("TOKEN_ALREADY_ASSOCIATED")) {
      return { success: true };
    }
    console.error("Error associating FORE token:", error);
    throw new Error(error.message || "Failed to associate FORE token");
  }
};

/**
 * Fetch FORE token balance for a given account via Mirror Node.
 * Returns balance as a number (e.g. 12.50 = 12.50 FORE).
 */
export const getFOREBalance = async (accountId: string): Promise<number> => {
  if (!FORE_TOKEN_ID || !accountId) return 0;
  try {
    const network = HEDERA_NETWORK === "mainnet" ? "mainnet-public" : "testnet";
    const res = await fetch(
      `https://${network}.mirrornode.hedera.com/api/v1/accounts/${accountId}/tokens?token.id=${FORE_TOKEN_ID}&limit=1`
    );
    if (!res.ok) return 0;
    const data = await res.json();
    if (data.tokens && data.tokens.length > 0) {
      return Number(data.tokens[0].balance) / 100; // 2 decimals
    }
    return 0;
  } catch {
    return 0;
  }
};
