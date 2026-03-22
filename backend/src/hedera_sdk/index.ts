import {
    Client,
    ContractId,
    ContractExecuteTransaction,
    ContractCallQuery,
    Hbar,
    TransferTransaction,
    AccountId,
} from "@hashgraph/sdk";
import { ethers } from "ethers";
import { getHederaClient, getOperatorId, initializeHederaClient } from "./config";
import { PREDICTION_MARKET_ABI, OPTIMISTIC_ORACLE_ABI, MULTI_OUTCOME_ORACLE_ABI, MULTI_OUTCOME_EVENT_ABI } from "./contracts";
import { PREDICTION_MARKET_CONTRACT, OPTIMISTIC_ORACLE_CONTRACT, MULTI_OUTCOME_CONTRACT, MULTI_OUTCOME_ORACLE_CONTRACT } from "./constants";
import { WithdrawType } from "../type";

// Contract instances
let predictionMarketContract: ContractId;
let optimisticOracleContract: ContractId;
let multiOutcomeEventContract: ContractId;
let multiOutcomeOracleContract: ContractId;

// Ethers interface for encoding function calls
const predictionMarketInterface = new ethers.Interface(PREDICTION_MARKET_ABI);
const optimisticOracleInterface = new ethers.Interface(OPTIMISTIC_ORACLE_ABI);
const multiOutcomeEventInterface = new ethers.Interface(MULTI_OUTCOME_EVENT_ABI);
const multiOutcomeOracleInterface = new ethers.Interface(MULTI_OUTCOME_ORACLE_ABI);

const parseContractId = (address: string): ContractId => {
    if (address.startsWith("0x")) {
        return ContractId.fromEvmAddress(0, 0, address);
    }
    return ContractId.fromString(address);
};

/**
 * Initialize the SDK with network and contract addresses
 */
export const initializeSDK = async (network: "testnet" | "mainnet" = "testnet") => {
    initializeHederaClient(network);
    
    if (PREDICTION_MARKET_CONTRACT && PREDICTION_MARKET_CONTRACT !== "0.0.XXXXX") {
        predictionMarketContract = parseContractId(PREDICTION_MARKET_CONTRACT);
        console.log(`📄 PredictionMarket contract: ${predictionMarketContract.toString()}`);
    } else {
        console.log(`⚠️  PredictionMarket contract not configured`);
    }
    
    if (OPTIMISTIC_ORACLE_CONTRACT && OPTIMISTIC_ORACLE_CONTRACT !== "0.0.XXXXX") {
        optimisticOracleContract = parseContractId(OPTIMISTIC_ORACLE_CONTRACT);
        console.log(`📄 OptimisticOracle contract: ${optimisticOracleContract.toString()}`);
    } else {
        console.log(`⚠️  OptimisticOracle contract not configured`);
    }

    if (MULTI_OUTCOME_CONTRACT) {
        multiOutcomeEventContract = parseContractId(MULTI_OUTCOME_CONTRACT);
        console.log(`📄 MultiOutcomeEvent contract: ${multiOutcomeEventContract.toString()}`);
    }

    if (MULTI_OUTCOME_ORACLE_CONTRACT) {
        multiOutcomeOracleContract = parseContractId(MULTI_OUTCOME_ORACLE_CONTRACT);
        console.log(`📄 MultiOutcomeOracle contract: ${multiOutcomeOracleContract.toString()}`);
    }
};

/**
 * Initialize the PredictionMarket contract (Polymarket-style, no marketCount/decimal)
 */
export const initializeContract = async (params: {
    creatorFeeAmount: number;
    bettingFeePercentage: number;
    fundFeePercentage: number;
}) => {
    try {
        if (!predictionMarketContract) {
            console.log("⚠️  Contract not configured, skipping initialization");
            return null;
        }
        
        const client = getHederaClient();
        const feeAuthority = process.env.FEE_AUTHORITY_ID || getOperatorId().toString();
        
        const isInit = await checkInitialized();
        if (isInit) {
            console.log("✅ Contract already initialized");
            return { new: false, contractId: predictionMarketContract.toString() };
        }

        const functionData = predictionMarketInterface.encodeFunctionData("initialize", [
            AccountId.fromString(feeAuthority).toSolidityAddress(),
            params.creatorFeeAmount,
            params.bettingFeePercentage,
            params.fundFeePercentage,
        ]);

        const tx = new ContractExecuteTransaction()
            .setContractId(predictionMarketContract)
            .setGas(300000)
            .setFunctionParameters(Buffer.from(functionData.slice(2), "hex"));

        const response = await tx.execute(client);
        const receipt = await response.getReceipt(client);
        
        console.log(`✅ Contract initialized. Status: ${receipt.status}`);
        return { new: true, contractId: predictionMarketContract.toString() };
    } catch (error) {
        console.error("❌ Error initializing contract:", error);
        return null;
    }
};

export const checkInitialized = async (): Promise<boolean> => {
    try {
        const client = getHederaClient();
        const query = new ContractCallQuery()
            .setContractId(predictionMarketContract)
            .setGas(100000)
            .setFunction("initialized");
        const result = await query.execute(client);
        return result.getBool(0);
    } catch (error) {
        return false;
    }
};

export const getGlobalSettings = async () => {
    try {
        const client = getHederaClient();
        const query = new ContractCallQuery()
            .setContractId(predictionMarketContract)
            .setGas(100000)
            .setFunction("getGlobal");
        const result = await query.execute(client);
        const decoded = predictionMarketInterface.decodeFunctionResult("getGlobal", result.bytes);
        return {
            admin: decoded[0].admin,
            feeAuthority: decoded[0].feeAuthority,
            creatorFeeAmount: decoded[0].creatorFeeAmount.toString(),
            bettingFeePercentage: decoded[0].bettingFeePercentage.toString(),
            fundFeePercentage: decoded[0].fundFeePercentage.toString(),
        };
    } catch (error) {
        console.error("❌ Error getting global settings:", error);
        return null;
    }
};

export const getCreatorFee = async (): Promise<number> => {
    try {
        const settings = await getGlobalSettings();
        return settings ? parseInt(settings.creatorFeeAmount) : 100000;
    } catch {
        return 100000;
    }
};

/**
 * Get market data from the new LMSR contract
 */
export const getMarketFromChain = async (marketId: string) => {
    try {
        const client = getHederaClient();
        const functionData = predictionMarketInterface.encodeFunctionData("getMarket", [marketId]);
        const query = new ContractCallQuery()
            .setContractId(predictionMarketContract)
            .setGas(200000)
            .setFunctionParameters(Buffer.from(functionData.slice(2), "hex"));
        const result = await query.execute(client);
        const decoded = predictionMarketInterface.decodeFunctionResult("getMarket", result.bytes);
        return decoded[0];
    } catch (error) {
        console.error("❌ Error getting market:", error);
        return null;
    }
};

/**
 * Resolve market directly (admin only)
 */
export const resolveMarket = async (marketId: string, result: boolean) => {
    try {
        const client = getHederaClient();
        const functionData = predictionMarketInterface.encodeFunctionData("resolveMarket", [marketId, result]);
        const tx = new ContractExecuteTransaction()
            .setContractId(predictionMarketContract)
            .setGas(300000)
            .setFunctionParameters(Buffer.from(functionData.slice(2), "hex"));
        const response = await tx.execute(client);
        const receipt = await response.getReceipt(client);
        console.log(`✅ Market resolved. Status: ${receipt.status}`);
        return { success: true };
    } catch (error) {
        console.error("❌ Error resolving market:", error);
        return { success: false, error };
    }
};

/**
 * Withdraw funds from market (admin only)
 */
export const withdraw = async (params: WithdrawType) => {
    try {
        const client = getHederaClient();
        const functionData = predictionMarketInterface.encodeFunctionData("withdraw", [
            params.marketId, params.receiver, params.amount,
        ]);
        const tx = new ContractExecuteTransaction()
            .setContractId(predictionMarketContract)
            .setGas(200000)
            .setFunctionParameters(Buffer.from(functionData.slice(2), "hex"));
        const response = await tx.execute(client);
        const receipt = await response.getReceipt(client);
        console.log(`✅ Withdrawal complete. Status: ${receipt.status}`);
        return { success: true, transactionId: response.transactionId.toString() };
    } catch (error) {
        console.error("❌ Error withdrawing:", error);
        return { success: false, error };
    }
};

/**
 * Transfer HBAR to an address (for referral claims)
 */
export const claimFee = async (address: string, amount: number) => {
    try {
        const client = getHederaClient();
        const operatorId = getOperatorId();
        const tx = new TransferTransaction()
            .addHbarTransfer(operatorId, Hbar.fromTinybars(-amount))
            .addHbarTransfer(AccountId.fromString(address), Hbar.fromTinybars(amount));
        const response = await tx.execute(client);
        const receipt = await response.getReceipt(client);
        console.log(`✅ Fee claimed. Status: ${receipt.status}`);
        return { success: true };
    } catch (error) {
        console.error("❌ Error claiming fee:", error);
        return { success: false, error };
    }
};

// ============ Optimistic Oracle Functions ============

export const proposeAnswer = async (questionId: string, value: 1 | -1, bondAmount: number) => {
    try {
        const client = getHederaClient();
        const functionData = optimisticOracleInterface.encodeFunctionData("proposeAnswer", [questionId, value]);
        const tx = new ContractExecuteTransaction()
            .setContractId(optimisticOracleContract)
            .setGas(300000)
            .setPayableAmount(Hbar.fromTinybars(bondAmount))
            .setFunctionParameters(Buffer.from(functionData.slice(2), "hex"))
            .setTransactionMemo(`propose-${Date.now()}`);
        const response = await tx.execute(client);
        await response.getReceipt(client);
        return { success: true };
    } catch (error) {
        console.error("❌ Error proposing answer:", error);
        return { success: false, error };
    }
};

export const disputeAnswer = async (questionId: string, bondAmount: number) => {
    try {
        const client = getHederaClient();
        const functionData = optimisticOracleInterface.encodeFunctionData("disputeAnswer", [questionId]);
        const tx = new ContractExecuteTransaction()
            .setContractId(optimisticOracleContract)
            .setGas(300000)
            .setPayableAmount(Hbar.fromTinybars(bondAmount))
            .setFunctionParameters(Buffer.from(functionData.slice(2), "hex"));
        const response = await tx.execute(client);
        await response.getReceipt(client);
        return { success: true };
    } catch (error) {
        console.error("❌ Error disputing answer:", error);
        return { success: false, error };
    }
};

export const settleProposal = async (questionId: string) => {
    try {
        const client = getHederaClient();
        const functionData = optimisticOracleInterface.encodeFunctionData("settleProposal", [questionId]);
        const tx = new ContractExecuteTransaction()
            .setContractId(optimisticOracleContract)
            .setGas(300000)
            .setFunctionParameters(Buffer.from(functionData.slice(2), "hex"));
        const response = await tx.execute(client);
        await response.getReceipt(client);
        return { success: true };
    } catch (error) {
        console.error("❌ Error settling proposal:", error);
        return { success: false, error };
    }
};

export const resolveDispute = async (questionId: string, finalValue: 1 | -1) => {
    try {
        const client = getHederaClient();
        const functionData = optimisticOracleInterface.encodeFunctionData("resolveDispute", [questionId, finalValue]);
        const tx = new ContractExecuteTransaction()
            .setContractId(optimisticOracleContract)
            .setGas(300000)
            .setFunctionParameters(Buffer.from(functionData.slice(2), "hex"));
        const response = await tx.execute(client);
        await response.getReceipt(client);
        return { success: true };
    } catch (error) {
        console.error("❌ Error resolving dispute:", error);
        return { success: false, error };
    }
};

export const canSettle = async (questionId: string): Promise<boolean> => {
    try {
        const client = getHederaClient();
        const functionData = optimisticOracleInterface.encodeFunctionData("canSettle", [questionId]);
        const query = new ContractCallQuery()
            .setContractId(optimisticOracleContract)
            .setGas(100000)
            .setFunctionParameters(Buffer.from(functionData.slice(2), "hex"));
        const result = await query.execute(client);
        return result.getBool(0);
    } catch (error) {
        return false;
    }
};

export const canDispute = async (questionId: string): Promise<boolean> => {
    try {
        const client = getHederaClient();
        const functionData = optimisticOracleInterface.encodeFunctionData("canDispute", [questionId]);
        const query = new ContractCallQuery()
            .setContractId(optimisticOracleContract)
            .setGas(100000)
            .setFunctionParameters(Buffer.from(functionData.slice(2), "hex"));
        const result = await query.execute(client);
        return result.getBool(0);
    } catch (error) {
        return false;
    }
};

export const getProposal = async (questionId: string) => {
    try {
        const client = getHederaClient();
        const functionData = optimisticOracleInterface.encodeFunctionData("getProposal", [questionId]);
        const query = new ContractCallQuery()
            .setContractId(optimisticOracleContract)
            .setGas(100000)
            .setFunctionParameters(Buffer.from(functionData.slice(2), "hex"));
        const result = await query.execute(client);
        const decoded = optimisticOracleInterface.decodeFunctionResult("getProposal", result.bytes);
        return decoded[0];
    } catch (error) {
        console.error("❌ Error getting proposal:", error);
        return null;
    }
};

/**
 * Request oracle resolution for a market (backend/admin signer)
 */
export const requestOracleResolution = async (marketId: string) => {
    try {
        const client = getHederaClient();
        const functionData = predictionMarketInterface.encodeFunctionData("requestOracleResolution", [marketId]);
        const tx = new ContractExecuteTransaction()
            .setContractId(predictionMarketContract)
            .setGas(500000)
            .setFunctionParameters(Buffer.from(functionData.slice(2), "hex"));
        const response = await tx.execute(client);
        const receipt = await response.getReceipt(client);
        console.log(`✅ Oracle resolution requested for ${marketId}. Status: ${receipt.status}`);
        return { success: true };
    } catch (error) {
        console.error("❌ Error requesting oracle resolution:", error);
        return { success: false, error };
    }
};

/**
 * Finalize market from oracle result (backend/admin signer)
 */
export const finalizeFromOracle = async (marketId: string) => {
    try {
        const client = getHederaClient();
        const functionData = predictionMarketInterface.encodeFunctionData("finalizeFromOracle", [marketId]);
        const tx = new ContractExecuteTransaction()
            .setContractId(predictionMarketContract)
            .setGas(300000)
            .setFunctionParameters(Buffer.from(functionData.slice(2), "hex"));
        const response = await tx.execute(client);
        const receipt = await response.getReceipt(client);
        console.log(`✅ Market finalized from oracle for ${marketId}. Status: ${receipt.status}`);
        return { success: true };
    } catch (error) {
        console.error("❌ Error finalizing from oracle:", error);
        return { success: false, error };
    }
};

/**
 * Check if oracle question is resolved
 */
export const isOracleResolved = async (questionId: string): Promise<boolean> => {
    try {
        const client = getHederaClient();
        const functionData = optimisticOracleInterface.encodeFunctionData("isResolved", [questionId]);
        const query = new ContractCallQuery()
            .setContractId(optimisticOracleContract)
            .setGas(100000)
            .setFunctionParameters(Buffer.from(functionData.slice(2), "hex"));
        const result = await query.execute(client);
        return result.getBool(0);
    } catch (error) {
        return false;
    }
};

export const getRequiredBond = async (callerAddress: string): Promise<number> => {
    try {
        const client = getHederaClient();
        const functionData = optimisticOracleInterface.encodeFunctionData("getRequiredBond", [callerAddress]);
        const query = new ContractCallQuery()
            .setContractId(optimisticOracleContract)
            .setGas(100000)
            .setFunctionParameters(Buffer.from(functionData.slice(2), "hex"));
        const result = await query.execute(client);
        const decoded = optimisticOracleInterface.decodeFunctionResult("getRequiredBond", result.bytes);
        return Number(decoded[0]);
    } catch (error) {
        console.error("❌ Error getting required bond:", error);
        return 10000 * 10 ** 8;
    }
};

// ============ Multi-Outcome Oracle Functions ============

export const requestMultiOutcomeOracleResolution = async (eventId: string) => {
    try {
        const client = getHederaClient();
        const functionData = multiOutcomeEventInterface.encodeFunctionData("requestOracleResolution", [eventId]);
        const tx = new ContractExecuteTransaction()
            .setContractId(multiOutcomeEventContract)
            .setGas(500000)
            .setFunctionParameters(Buffer.from(functionData.slice(2), "hex"));
        const response = await tx.execute(client);
        const receipt = await response.getReceipt(client);
        console.log(`✅ Multi-outcome oracle resolution requested for ${eventId}. Status: ${receipt.status}`);
        return { success: true };
    } catch (error) {
        console.error("❌ Error requesting multi-outcome oracle resolution:", error);
        return { success: false, error };
    }
};

export const proposeMultiOutcomeAnswer = async (questionId: string, value: number, bondAmount: number) => {
    try {
        const client = getHederaClient();
        const functionData = multiOutcomeOracleInterface.encodeFunctionData("proposeAnswer", [questionId, value]);
        const tx = new ContractExecuteTransaction()
            .setContractId(multiOutcomeOracleContract)
            .setGas(300000)
            .setPayableAmount(Hbar.fromTinybars(bondAmount))
            .setFunctionParameters(Buffer.from(functionData.slice(2), "hex"))
            .setTransactionMemo(`multi-propose-${Date.now()}`);
        const response = await tx.execute(client);
        await response.getReceipt(client);
        return { success: true };
    } catch (error) {
        console.error("❌ Error proposing multi-outcome answer:", error);
        return { success: false, error };
    }
};

export const settleMultiOutcomeProposal = async (questionId: string) => {
    try {
        const client = getHederaClient();
        const functionData = multiOutcomeOracleInterface.encodeFunctionData("settleProposal", [questionId]);
        const tx = new ContractExecuteTransaction()
            .setContractId(multiOutcomeOracleContract)
            .setGas(300000)
            .setFunctionParameters(Buffer.from(functionData.slice(2), "hex"));
        const response = await tx.execute(client);
        await response.getReceipt(client);
        return { success: true };
    } catch (error) {
        console.error("❌ Error settling multi-outcome proposal:", error);
        return { success: false, error };
    }
};

export const finalizeMultiOutcomeFromOracle = async (eventId: string) => {
    try {
        const client = getHederaClient();
        const functionData = multiOutcomeEventInterface.encodeFunctionData("finalizeFromOracle", [eventId]);
        const tx = new ContractExecuteTransaction()
            .setContractId(multiOutcomeEventContract)
            .setGas(300000)
            .setFunctionParameters(Buffer.from(functionData.slice(2), "hex"));
        const response = await tx.execute(client);
        const receipt = await response.getReceipt(client);
        console.log(`✅ Multi-outcome event finalized from oracle for ${eventId}. Status: ${receipt.status}`);
        return { success: true };
    } catch (error) {
        console.error("❌ Error finalizing multi-outcome from oracle:", error);
        return { success: false, error };
    }
};

export const getMultiOutcomeEvent = async (eventId: string) => {
    try {
        const client = getHederaClient();
        const functionData = multiOutcomeEventInterface.encodeFunctionData("getEvent", [eventId]);
        const query = new ContractCallQuery()
            .setContractId(multiOutcomeEventContract)
            .setGas(200000)
            .setFunctionParameters(Buffer.from(functionData.slice(2), "hex"));
        const result = await query.execute(client);
        const decoded = multiOutcomeEventInterface.decodeFunctionResult("getEvent", result.bytes);
        return decoded[0];
    } catch (error) {
        console.error("❌ Error getting multi-outcome event:", error);
        return null;
    }
};

export const getMultiOutcomeProposal = async (questionId: string) => {
    try {
        const client = getHederaClient();
        const functionData = multiOutcomeOracleInterface.encodeFunctionData("getProposal", [questionId]);
        const query = new ContractCallQuery()
            .setContractId(multiOutcomeOracleContract)
            .setGas(100000)
            .setFunctionParameters(Buffer.from(functionData.slice(2), "hex"));
        const result = await query.execute(client);
        const decoded = multiOutcomeOracleInterface.decodeFunctionResult("getProposal", result.bytes);
        return decoded[0];
    } catch (error) {
        console.error("❌ Error getting multi-outcome proposal:", error);
        return null;
    }
};

export const canSettleMultiOutcome = async (questionId: string): Promise<boolean> => {
    try {
        const client = getHederaClient();
        const functionData = multiOutcomeOracleInterface.encodeFunctionData("canSettle", [questionId]);
        const query = new ContractCallQuery()
            .setContractId(multiOutcomeOracleContract)
            .setGas(100000)
            .setFunctionParameters(Buffer.from(functionData.slice(2), "hex"));
        const result = await query.execute(client);
        return result.getBool(0);
    } catch (error) {
        return false;
    }
};

export const isMultiOutcomeOracleResolved = async (questionId: string): Promise<boolean> => {
    try {
        const client = getHederaClient();
        const functionData = multiOutcomeOracleInterface.encodeFunctionData("isResolved", [questionId]);
        const query = new ContractCallQuery()
            .setContractId(multiOutcomeOracleContract)
            .setGas(100000)
            .setFunctionParameters(Buffer.from(functionData.slice(2), "hex"));
        const result = await query.execute(client);
        return result.getBool(0);
    } catch (error) {
        return false;
    }
};

/**
 * Resolve multi-outcome event directly (admin only, bypasses oracle)
 */
export const resolveMultiOutcomeEvent = async (eventId: string, winningOutcome: number) => {
    try {
        const client = getHederaClient();
        const functionData = multiOutcomeEventInterface.encodeFunctionData("resolveEvent", [eventId, winningOutcome]);
        const tx = new ContractExecuteTransaction()
            .setContractId(multiOutcomeEventContract)
            .setGas(300000)
            .setFunctionParameters(Buffer.from(functionData.slice(2), "hex"));
        const response = await tx.execute(client);
        const receipt = await response.getReceipt(client);
        console.log(`✅ Multi-outcome event resolved directly for ${eventId}. Status: ${receipt.status}`);
        return { success: true };
    } catch (error) {
        console.error("❌ Error resolving multi-outcome event:", error);
        return { success: false, error };
    }
};

export {
    initializeHederaClient,
    getHederaClient,
    getOperatorId,
} from "./config";
