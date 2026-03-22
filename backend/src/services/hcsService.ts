import {
  TopicCreateTransaction,
  TopicMessageSubmitTransaction,
} from "@hashgraph/sdk";
import { getHederaClient } from "../hedera_sdk/config";

/**
 * HCS (Hedera Consensus Service) Audit Trail Service
 * Each market/event gets its own HCS topic for immutable logging.
 */

// Message types for audit trail
export type HCSMessageType =
  | "MARKET_CREATED"
  | "EVENT_CREATED"
  | "MARKET_FUNDED"
  | "EVENT_FUNDED"
  | "BET_PLACED"
  | "LP_ADDED"
  | "LP_REMOVED"
  | "ORACLE_REQUESTED"
  | "ORACLE_PROPOSED"
  | "ORACLE_DISPUTED"
  | "ORACLE_SETTLED"
  | "MARKET_RESOLVED"
  | "EVENT_RESOLVED"
  | "MARKET_FINALIZED"
  | "EVENT_FINALIZED"
  | "WINNINGS_CLAIMED"
  | "LP_CLAIMED"
  | "MARKET_FORCE_CLOSED"
  | "EVENT_FORCE_CLOSED";

interface HCSMessage {
  type: HCSMessageType;
  timestamp: number;
  data: Record<string, any>;
}

/**
 * Create a new HCS topic for a market/event.
 * Returns the topic ID string (e.g. "0.0.12345").
 */
export const createHCSTopic = async (memo: string): Promise<string | null> => {
  try {
    const client = getHederaClient();
    const tx = new TopicCreateTransaction().setTopicMemo(memo);
    const response = await tx.execute(client);
    const receipt = await response.getReceipt(client);
    const topicId = receipt.topicId?.toString() || null;
    if (topicId) {
      console.log(`📋 HCS topic created: ${topicId} (${memo})`);
    }
    return topicId;
  } catch (error) {
    console.error("❌ HCS topic creation failed:", error);
    return null;
  }
};

/**
 * Submit a JSON message to an HCS topic.
 * Fire-and-forget — errors are logged but don't break the caller.
 */
export const submitHCSMessage = async (
  topicId: string,
  type: HCSMessageType,
  data: Record<string, any>
): Promise<void> => {
  try {
    const client = getHederaClient();
    const message: HCSMessage = {
      type,
      timestamp: Date.now(),
      data,
    };
    const tx = new TopicMessageSubmitTransaction()
      .setTopicId(topicId)
      .setMessage(JSON.stringify(message));
    await tx.execute(client);
    console.log(`📋 HCS [${topicId}] ${type}: ${JSON.stringify(data).slice(0, 100)}`);
  } catch (error) {
    console.error(`❌ HCS message submit failed [${topicId}] ${type}:`, error);
  }
};

/**
 * Helper: Log market creation
 */
export const logMarketCreated = async (topicId: string, data: {
  marketId: string; creator: string; question: string; marketType: string;
}) => submitHCSMessage(topicId, "MARKET_CREATED", data);

/**
 * Helper: Log multi-outcome event creation
 */
export const logEventCreated = async (topicId: string, data: {
  eventGroupId: string; creator: string; question: string; outcomes: string[];
}) => submitHCSMessage(topicId, "EVENT_CREATED", data);

/**
 * Helper: Log funding
 */
export const logFunded = async (topicId: string, data: {
  wallet: string; amount: number; marketType: string;
}) => submitHCSMessage(topicId, data.marketType === "multi" ? "EVENT_FUNDED" : "MARKET_FUNDED", data);

/**
 * Helper: Log bet
 */
export const logBetPlaced = async (topicId: string, data: {
  wallet: string; side: string; amount: number; cost: number; outcomeName?: string;
}) => submitHCSMessage(topicId, "BET_PLACED", data);

/**
 * Helper: Log oracle events
 */
export const logOracleRequested = async (topicId: string, data: {
  marketId: string; oracleRequestId?: string;
}) => submitHCSMessage(topicId, "ORACLE_REQUESTED", data);

export const logOracleProposed = async (topicId: string, data: {
  proposer: string; proposedValue: number | string;
}) => submitHCSMessage(topicId, "ORACLE_PROPOSED", data);

export const logOracleSettled = async (topicId: string, data: {
  marketId: string;
}) => submitHCSMessage(topicId, "ORACLE_SETTLED", data);

export const logResolved = async (topicId: string, data: {
  marketId: string; result?: string; winner?: string;
}, isMulti: boolean) => submitHCSMessage(topicId, isMulti ? "EVENT_RESOLVED" : "MARKET_RESOLVED", data);

export const logFinalized = async (topicId: string, data: {
  marketId: string;
}, isMulti: boolean) => submitHCSMessage(topicId, isMulti ? "EVENT_FINALIZED" : "MARKET_FINALIZED", data);
