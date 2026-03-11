// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

/**
 * @title IHederaTokenService
 * @notice Interface for Hedera Token Service precompile
 * @dev This is a simplified interface - full HTS has more functions
 */
interface IHederaTokenService {
    
    /// Token info structure
    struct TokenInfo {
        string name;
        string symbol;
        address treasury;
        uint64 totalSupply;
        uint32 decimals;
    }

    /// Fungible token info
    struct FungibleTokenInfo {
        TokenInfo tokenInfo;
        int32 decimals;
    }

    /**
     * @notice Creates a fungible token
     * @param token The token to create
     * @return responseCode The response code
     * @return tokenAddress The created token address
     */
    function createFungibleToken(
        TokenInfo memory token,
        int64 initialTotalSupply,
        int32 decimals
    ) external payable returns (int64 responseCode, address tokenAddress);

    /**
     * @notice Mints tokens to treasury
     * @param token The token to mint
     * @param amount The amount to mint
     * @return responseCode The response code
     * @return newTotalSupply The new total supply
     */
    function mintToken(
        address token,
        int64 amount,
        bytes[] memory metadata
    ) external returns (int64 responseCode, int64 newTotalSupply, int64[] memory serialNumbers);

    /**
     * @notice Transfers tokens
     * @param token The token to transfer
     * @param sender The sender address
     * @param receiver The receiver address
     * @param amount The amount to transfer
     * @return responseCode The response code
     */
    function transferToken(
        address token,
        address sender,
        address receiver,
        int64 amount
    ) external returns (int64 responseCode);

    /**
     * @notice Associates tokens with an account
     * @param account The account to associate
     * @param tokens The tokens to associate
     * @return responseCode The response code
     */
    function associateTokens(
        address account,
        address[] memory tokens
    ) external returns (int64 responseCode);

    /**
     * @notice Gets token info
     * @param token The token address
     * @return responseCode The response code
     * @return tokenInfo The token info
     */
    function getTokenInfo(
        address token
    ) external returns (int64 responseCode, TokenInfo memory tokenInfo);

    /**
     * @notice Gets fungible token info
     * @param token The token address
     * @return responseCode The response code
     * @return fungibleTokenInfo The fungible token info
     */
    function getFungibleTokenInfo(
        address token
    ) external returns (int64 responseCode, FungibleTokenInfo memory fungibleTokenInfo);

    /**
     * @notice Burns tokens
     * @param token The token to burn
     * @param amount The amount to burn
     * @return responseCode The response code
     * @return newTotalSupply The new total supply
     */
    function burnToken(
        address token,
        int64 amount,
        int64[] memory serialNumbers
    ) external returns (int64 responseCode, int64 newTotalSupply);
}

// Response codes
library HederaResponseCodes {
    int64 constant SUCCESS = 22;
    int64 constant INVALID_TOKEN_ID = 167;
    int64 constant TOKEN_NOT_ASSOCIATED_TO_ACCOUNT = 184;
    int64 constant INSUFFICIENT_TOKEN_BALANCE = 96;
}
