import { AccountId, TokenId, ContractId } from "@hashgraph/sdk";
import { ethers } from "ethers";

/**
 * Convert Hedera Account ID to Solidity address
 */
export const accountIdToSolidityAddress = (accountId: string | AccountId): string => {
    const id = typeof accountId === "string" ? AccountId.fromString(accountId) : accountId;
    return id.toSolidityAddress();
};

/**
 * Convert Solidity address to Hedera Account ID
 */
export const solidityAddressToAccountId = (address: string): AccountId => {
    return AccountId.fromSolidityAddress(address);
};

/**
 * Convert Hedera Token ID to Solidity address
 */
export const tokenIdToSolidityAddress = (tokenId: string | TokenId): string => {
    const id = typeof tokenId === "string" ? TokenId.fromString(tokenId) : tokenId;
    return id.toSolidityAddress();
};

/**
 * Convert Solidity address to Hedera Token ID
 */
export const solidityAddressToTokenId = (address: string): TokenId => {
    return TokenId.fromSolidityAddress(address);
};

/**
 * Convert Hedera Contract ID to Solidity address
 */
export const contractIdToSolidityAddress = (contractId: string | ContractId): string => {
    const id = typeof contractId === "string" ? ContractId.fromString(contractId) : contractId;
    return id.toSolidityAddress();
};

/**
 * Convert HBAR to tinybars
 */
export const hbarToTinybars = (hbar: number): number => {
    return Math.floor(hbar * 10 ** 8);
};

/**
 * Convert tinybars to HBAR
 */
export const tinybarsToHbar = (tinybars: number): number => {
    return tinybars / 10 ** 8;
};

/**
 * Generate market ID hash (matches contract logic)
 */
export const generateMarketIdHash = (marketId: string): string => {
    return ethers.keccak256(ethers.toUtf8Bytes(marketId));
};

/**
 * Sleep utility
 */
export const sleep = (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Format HBAR amount for display
 */
export const formatHbar = (tinybars: number): string => {
    const hbar = tinybarsToHbar(tinybars);
    return `${hbar.toFixed(4)} HBAR`;
};

/**
 * Validate Hedera account ID format
 */
export const isValidAccountId = (accountId: string): boolean => {
    try {
        AccountId.fromString(accountId);
        return true;
    } catch {
        return false;
    }
};

/**
 * Validate Hedera contract ID format
 */
export const isValidContractId = (contractId: string): boolean => {
    try {
        ContractId.fromString(contractId);
        return true;
    } catch {
        return false;
    }
};

/**
 * Validate Hedera token ID format
 */
export const isValidTokenId = (tokenId: string): boolean => {
    try {
        TokenId.fromString(tokenId);
        return true;
    } catch {
        return false;
    }
};
