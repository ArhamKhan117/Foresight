// Contract IDs (set from environment after deployment)
export const PREDICTION_MARKET_CONTRACT = process.env.PREDICTION_MARKET_CONTRACT || "";
export const OPTIMISTIC_ORACLE_CONTRACT = process.env.OPTIMISTIC_ORACLE_CONTRACT || "";
export const MULTI_OUTCOME_CONTRACT = process.env.MULTI_OUTCOME_CONTRACT || "";
export const MULTI_OUTCOME_ORACLE_CONTRACT = process.env.MULTI_OUTCOME_ORACLE_CONTRACT || "";

// Fee Authority
export const FEE_AUTHORITY_ID = process.env.FEE_AUTHORITY_ID || "";

// Hedera Token Service precompile address
export const HTS_PRECOMPILE = "0x0000000000000000000000000000000000000167";

// Bond amounts for OptimisticOracle (in tinybars)
export const ADMIN_BOND = 2 * 10 ** 8;        // 2 HBAR
export const USER_BOND = 10000 * 10 ** 8;     // 10,000 HBAR

// Dispute window
export const DISPUTE_WINDOW = 2 * 60 * 60;    // 2 hours in seconds

// Market status enum (matches contract)
export enum MarketStatus {
    Prepare = 0,
    Active = 1,
    Finished = 2
}

// Oracle values
export const ORACLE_YES = 1;
export const ORACLE_NO = -1;
