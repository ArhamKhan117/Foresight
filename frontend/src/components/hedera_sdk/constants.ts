// Hedera Contract Addresses (from deployment)
export const PREDICTION_MARKET_CONTRACT = process.env.NEXT_PUBLIC_PREDICTION_MARKET_CONTRACT || "0x61E76D8eD410aDc29EcF65aE697b7599eB17E97D";
export const OPTIMISTIC_ORACLE_CONTRACT = process.env.NEXT_PUBLIC_OPTIMISTIC_ORACLE_CONTRACT || "0x506eA2BE51Daf38BBE1278cd836e799013fcC4Ed";
export const MULTI_OUTCOME_CONTRACT = process.env.NEXT_PUBLIC_MULTI_OUTCOME_CONTRACT || "0x5c678d1144Ea155Eb65176A6AC225DCB2e22B455";
export const MULTI_OUTCOME_ORACLE_CONTRACT = process.env.NEXT_PUBLIC_MULTI_OUTCOME_ORACLE_CONTRACT || "0x8B25245D57a8965bb36D715442Fcd41CBE945EB6";

// Network
export const HEDERA_NETWORK = process.env.NEXT_PUBLIC_HEDERA_NETWORK || "testnet";

// Fee Authority
export const FEE_AUTHORITY = process.env.NEXT_PUBLIC_FEE_AUTHORITY || "0.0.6362296";

// Token amounts (defaults)
export const tokenAAmount = 10000000;
export const tokenBAmount = 10000000;

// Bond amounts for oracle (in tinybars)
export const ADMIN_BOND = 2 * 10 ** 8; // 2 HBAR
export const USER_BOND = 10000 * 10 ** 8; // 10,000 HBAR

// Hedera Token Service precompile address
export const HTS_PRECOMPILE = "0x0000000000000000000000000000000000000167";

// Admin wallet address (set via NEXT_PUBLIC_ADMIN_ADDRESS env var)
export const ADMIN_ADDRESS = (process.env.NEXT_PUBLIC_ADMIN_ADDRESS || "").toLowerCase();

// FORE Reward Token (HTS)
export const FORE_TOKEN_ID = process.env.NEXT_PUBLIC_FORE_TOKEN_ID || "";
