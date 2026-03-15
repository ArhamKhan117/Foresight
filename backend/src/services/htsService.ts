import {
  TokenCreateTransaction,
  TokenType,
  TokenSupplyType,
  TokenMintTransaction,
  TransferTransaction,
  TokenId,
  AccountId,
} from "@hashgraph/sdk";
import { getHederaClient, getOperatorId, getOperatorKey } from "../hedera_sdk/config";

let FORE_TOKEN_ID: string = process.env.FORE_TOKEN_ID || "";

/**
 * Get the FORE token ID
 */
export const getForeTokenId = (): string => FORE_TOKEN_ID;

/**
 * Initialize the FORE reward token.
 * If FORE_TOKEN_ID is set in env, use it. Otherwise create a new one.
 */
export const initializeForeToken = async (): Promise<string> => {
  if (FORE_TOKEN_ID) {
    console.log(`🪙 FORE token already configured: ${FORE_TOKEN_ID}`);
    return FORE_TOKEN_ID;
  }

  try {
    const client = getHederaClient();
    const operatorId = getOperatorId();
    const operatorKey = getOperatorKey();

    const tx = new TokenCreateTransaction()
      .setTokenName("Foresight Reward")
      .setTokenSymbol("FORE")
      .setDecimals(2)
      .setInitialSupply(0)
      .setTokenType(TokenType.FungibleCommon)
      .setSupplyType(TokenSupplyType.Infinite)
      .setTreasuryAccountId(operatorId)
      .setSupplyKey(operatorKey)
      .setAdminKey(operatorKey);

    const response = await tx.execute(client);
    const receipt = await response.getReceipt(client);
    FORE_TOKEN_ID = receipt.tokenId?.toString() || "";

    console.log(`🪙 FORE token created: ${FORE_TOKEN_ID}`);
    console.log(`   ⚠️  Add to .env: FORE_TOKEN_ID=${FORE_TOKEN_ID}`);
    return FORE_TOKEN_ID;
  } catch (error) {
    console.error("❌ FORE token creation failed:", error);
    return "";
  }
};

/**
 * Mint FORE tokens to treasury, then transfer to a user.
 * Fire-and-forget — errors are logged but don't break the caller.
 * @param accountId Hedera account ID (e.g. "0.0.12345") or EVM address
 * @param amount Amount in whole tokens (e.g. 5 = 5.00 FORE)
 */
export const rewardFORE = async (accountId: string, amount: number): Promise<void> => {
  if (!FORE_TOKEN_ID || !accountId || amount <= 0) return;

  try {
    const client = getHederaClient();
    const operatorId = getOperatorId();
    const tokenId = TokenId.fromString(FORE_TOKEN_ID);
    const scaledAmount = Math.round(amount * 100); // 2 decimals

    // Step 1: Mint to treasury
    const mintTx = new TokenMintTransaction()
      .setTokenId(tokenId)
      .setAmount(scaledAmount);
    const mintResponse = await mintTx.execute(client);
    await mintResponse.getReceipt(client);

    // Step 2: Transfer from treasury to user (skip if recipient IS the operator/treasury)
    let recipientId: AccountId;
    try {
      if (accountId.startsWith("0x")) {
        recipientId = AccountId.fromEvmAddress(0, 0, accountId);
      } else {
        recipientId = AccountId.fromString(accountId);
      }
    } catch {
      console.log(`🪙 FORE: invalid account ${accountId}, skipping`);
      return;
    }

    if (recipientId.toString() === operatorId.toString()) {
      // Tokens already minted to treasury (which is the operator) — no transfer needed
      console.log(`🪙 FORE: minted ${amount} FORE to operator (self)`);
      return;
    }

    const transferTx = new TransferTransaction()
      .addTokenTransfer(tokenId, operatorId, -scaledAmount)
      .addTokenTransfer(tokenId, recipientId, scaledAmount);
    const transferResponse = await transferTx.execute(client);
    await transferResponse.getReceipt(client);

    console.log(`🪙 FORE: rewarded ${amount} FORE to ${accountId}`);
  } catch (error: any) {
    const msg = String(error?.message || error);
    if (msg.includes("TOKEN_NOT_ASSOCIATED")) {
      // User hasn't associated — skip silently
      console.log(`🪙 FORE: ${accountId} not associated, skipping reward`);
    } else {
      console.error(`🪙 FORE reward failed for ${accountId}:`, msg.slice(0, 120));
    }
  }
};
