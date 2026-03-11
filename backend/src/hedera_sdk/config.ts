import { Client, PrivateKey, AccountId } from "@hashgraph/sdk";

// Hedera Client Configuration
let hederaClient: Client;
let operatorId: AccountId;
let operatorKey: PrivateKey;

/**
 * Initialize Hedera client based on network
 */
export const initializeHederaClient = (network: "testnet" | "mainnet" | "previewnet" = "testnet") => {
    operatorId = AccountId.fromString(process.env.HEDERA_OPERATOR_ID || "");
    operatorKey = PrivateKey.fromString(process.env.HEDERA_OPERATOR_KEY || "");

    switch (network) {
        case "mainnet":
            hederaClient = Client.forMainnet();
            break;
        case "previewnet":
            hederaClient = Client.forPreviewnet();
            break;
        case "testnet":
        default:
            hederaClient = Client.forTestnet();
            break;
    }

    hederaClient.setOperator(operatorId, operatorKey);
    
    console.log(`🔗 Hedera client initialized for ${network}`);
    console.log(`👤 Operator ID: ${operatorId.toString()}`);
    
    return hederaClient;
};

/**
 * Get the Hedera client instance
 */
export const getHederaClient = (): Client => {
    if (!hederaClient) {
        throw new Error("Hedera client not initialized. Call initializeHederaClient first.");
    }
    return hederaClient;
};

/**
 * Get the operator account ID
 */
export const getOperatorId = (): AccountId => {
    if (!operatorId) {
        throw new Error("Operator ID not set. Call initializeHederaClient first.");
    }
    return operatorId;
};

/**
 * Get the operator private key
 */
export const getOperatorKey = (): PrivateKey => {
    if (!operatorKey) {
        throw new Error("Operator key not set. Call initializeHederaClient first.");
    }
    return operatorKey;
};

export { hederaClient, operatorId, operatorKey };
