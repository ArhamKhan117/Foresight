import { initializeSDK, initializeContract } from "../../hedera_sdk";
import { GlobalSettingType } from "../../type";
import { execute } from "../bot/utils";

export const initialize = async (network: "testnet" | "mainnet", param: GlobalSettingType) => {
    try {
        // Initialize Hedera SDK
        await initializeSDK(network);
        
        // Run bot tasks (cleanup expired markets, etc.)
        await execute();
        
        // Initialize contract if not already initialized
        const result = await initializeContract(param);
        
        if (result) {
            if (!result.new) {
                console.log("✅ Contract already initialized:", result.contractId);
            } else {
                console.log("✅ Contract successfully initialized:", result.contractId);
            }
        } else {
            console.log("🚩 Failed initializing contract (may not be deployed yet)");
        }
    } catch (error) {
        console.error("❌ Initialization error:", error);
    }
};
