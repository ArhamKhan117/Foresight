import MarketModel from "../model/market";
import {
  requestOracleResolution,
  proposeAnswer,
  settleProposal,
  finalizeFromOracle,
  resolveMarket,
  requestMultiOutcomeOracleResolution,
  proposeMultiOutcomeAnswer,
  settleMultiOutcomeProposal,
  finalizeMultiOutcomeFromOracle,
  resolveMultiOutcomeEvent,
  getMultiOutcomeEvent,
  getMultiOutcomeProposal,
  canSettleMultiOutcome,
  isMultiOutcomeOracleResolved,
} from "../hedera_sdk";
import { ethers } from "ethers";
import { PREDICTION_MARKET_CONTRACT, OPTIMISTIC_ORACLE_CONTRACT, MULTI_OUTCOME_CONTRACT, MULTI_OUTCOME_ORACLE_CONTRACT, ADMIN_BOND, ORACLE_YES, ORACLE_NO } from "../hedera_sdk/constants";
import { PREDICTION_MARKET_ABI, OPTIMISTIC_ORACLE_ABI, MULTI_OUTCOME_EVENT_ABI, MULTI_OUTCOME_ORACLE_ABI } from "../hedera_sdk/contracts";
import https from "https";
import { submitHCSMessage } from "./hcsService";

import { fetchTweetData, getMetricValue } from "./twitterService";

const ZERO_HASH = ethers.ZeroHash;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

// Poll interval: 60 seconds
const POLL_INTERVAL = 60_000;

// Cooldown: skip markets that failed recently (5 min cooldown)
const FAIL_COOLDOWN = 5 * 60 * 1000;
const failedMarkets = new Map<string, number>();

// Stale oracle timeout: force-close markets stuck in oracle flow for 48 hours
const STALE_ORACLE_TIMEOUT = 48 * 60 * 60; // 48 hours in seconds

/**
 * Free JSON-RPC provider for READ-ONLY calls (no gas cost).
 */
const getRpcProvider = () => {
  const network = process.env.HEDERA_NETWORK || "testnet";
  const rpcUrl = network === "mainnet"
    ? "https://mainnet.hashio.io/api"
    : "https://testnet.hashio.io/api";
  return new ethers.JsonRpcProvider(rpcUrl);
};

const getReadOnlyMarketContract = () => {
  return new ethers.Contract(PREDICTION_MARKET_CONTRACT, PREDICTION_MARKET_ABI, getRpcProvider());
};

const getReadOnlyOracleContract = () => {
  return new ethers.Contract(OPTIMISTIC_ORACLE_CONTRACT, OPTIMISTIC_ORACLE_ABI, getRpcProvider());
};

/**
 * Retry wrapper for flaky JSON-RPC calls.
 */
const withRetry = async <T>(fn: () => Promise<T>, label: string, retries = 3): Promise<T> => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const code = err?.info?.responseStatus || err?.message || "";
      const isTransient = /502|524|timeout|ECONNRESET|ETIMEDOUT|SERVER_ERROR/i.test(String(code));
      if (isTransient && attempt < retries) {
        const delay = attempt * 2000;
        console.log(`🤖 Auto-resolver: ${label} attempt ${attempt} failed, retrying in ${delay / 1000}s...`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw new Error(`${label}: all retries exhausted`);
};

/**
 * Simple HTTPS GET that returns parsed JSON. No external deps needed.
 * Includes User-Agent header required by CoinGecko.
 */
const httpGet = (url: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    const options = {
      timeout: 10000,
      headers: { "User-Agent": "Foresight-PredictionMarket/1.0" },
    };
    const req = https.get(url, options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        try { resolve(JSON.parse(data)); } catch { reject(new Error("Invalid JSON")); }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("Timeout")); });
  });
};

/**
 * Fetch current price from CoinGecko or DexScreener for a crypto market.
 * Returns the current value (price or market cap) to compare against the target.
 */
const fetchCurrentValue = async (dbMarket: any): Promise<number | null> => {
  try {
    // Crypto markets (marketField: 0) — API-based resolution
    if (dbMarket.marketField === 0) {
      const apiType = dbMarket.apiType;
      const rawFeedId = dbMarket.feedId || dbMarket.feedName;
      const range = dbMarket.range;

      if (apiType === 0) {
        const feedId = rawFeedId.toLowerCase();
        if (range === 1) {
          const data = await httpGet(`https://api.coingecko.com/api/v3/coins/markets?ids=${feedId}&vs_currency=usd`);
          if (data?.[0]?.market_cap) return data[0].market_cap;
        } else {
          const data = await httpGet(`https://api.coingecko.com/api/v3/simple/price?ids=${feedId}&vs_currencies=usd`);
          if (data?.[feedId]?.usd) return data[feedId].usd;
        }
      } else if (apiType === 1) {
        const data = await httpGet(`https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(rawFeedId)}`);
        if (data?.pairs?.length > 0) {
          const pair = data.pairs[0];
          if (range === 1) {
            return pair.marketCap || pair.fdv || null;
          } else {
            return parseFloat(pair.priceUsd) || null;
          }
        }
      }
      return null;
    }

    // Tweet markets (marketField: 3) — Twitter API resolution
    if (dbMarket.marketField === 3) {
      const tweetId = dbMarket.feedId;
      if (!tweetId) return null;

      const metricMap: Record<number, "VIEWS" | "LIKES" | "RETWEETS" | "COMMENTS"> = {
        0: "VIEWS",
        1: "LIKES",
        2: "RETWEETS",
        3: "COMMENTS",
      };
      const metric = metricMap[dbMarket.apiType];
      if (!metric) return null;

      try {
        const tweetData = await fetchTweetData(tweetId);
        return getMetricValue(tweetData, metric);
      } catch (err) {
        console.log(`🤖 Auto-resolver: failed to fetch tweet metrics for ${tweetId}:`, err);
        return null;
      }
    }

    return null;
  } catch (err) {
    console.log(`🤖 Auto-resolver: failed to fetch price for ${dbMarket.market}:`, err);
    return null;
  }
};

/**
 * Determine Yes/No based on current value vs target value and direction.
 * direction "above": YES if current >= target (default, backward-compatible)
 * direction "below": YES if current <= target
 */
const determineOutcome = (currentValue: number, targetValue: number, direction?: string): 1 | -1 => {
  if (direction === "below") {
    return currentValue <= targetValue ? ORACLE_YES as 1 : ORACLE_NO as -1;
  }
  return currentValue >= targetValue ? ORACLE_YES as 1 : ORACLE_NO as -1;
};

/**
 * Auto-resolution service.
 * Polls ACTIVE markets past resolution date (excluding "demo" tag).
 * Uses FREE JSON-RPC for all reads. Only pays gas for actual write txns.
 * 
 * Full auto-resolution flow for crypto markets:
 *   1. requestOracleResolution — when timer expired, no oracle request yet
 *   2. proposeAnswer — auto-fetches price from API, determines Yes/No, proposes with admin bond
 *   3. settleProposal — when dispute window passed with no dispute
 *   4. finalizeFromOracle — when oracle resolved but market not finalized
 * 
 * Users can still dispute during the dispute window (2hr).
 * Admin resolves disputes manually if they occur.
 */
export const startAutoResolver = () => {
  console.log("🤖 Auto-resolver started (polling every 60s, reads are free via JSON-RPC)");

  setInterval(async () => {
    try {
      const expiredMarkets = await MarketModel.find({
        marketStatus: "ACTIVE",
        marketTag: { $ne: "demo" },
      });

      if (expiredMarkets.length === 0) return;

      const marketContract = getReadOnlyMarketContract();
      const oracleContract = getReadOnlyOracleContract();

      for (const dbMarket of expiredMarkets) {
        if (!dbMarket.market) continue;

        // Skip if in cooldown from recent failure
        const lastFail = failedMarkets.get(dbMarket.market);
        if (lastFail && Date.now() - lastFail < FAIL_COOLDOWN) continue;

        try {
          // FREE read: get market from chain
          const onChain = await withRetry(
            () => marketContract.getMarket(dbMarket.market),
            `getMarket(${dbMarket.market})`
          );
          const status = Number(onChain.marketStatus);

          // Already finished on-chain → just update DB
          if (status === 2) {
            if (dbMarket.marketStatus !== "CLOSED") {
              await MarketModel.findByIdAndUpdate(dbMarket._id, { marketStatus: "CLOSED" });
              console.log(`🤖 Auto-resolver: marked ${dbMarket.market} as CLOSED in DB`);
            }
            continue;
          }

          // Not active → skip
          if (status !== 1) continue;

          // Check if resolution date has passed
          const resolutionDate = Number(onChain.resolutionDate);
          if (resolutionDate > Math.floor(Date.now() / 1000)) continue;

          const oracleRequestId = onChain.oracleRequestId;

          // Stale oracle check: if resolution date was 48+ hours ago and still active, force-close
          const secondsSinceExpiry = Math.floor(Date.now() / 1000) - resolutionDate;
          if (secondsSinceExpiry >= STALE_ORACLE_TIMEOUT && oracleRequestId !== ZERO_HASH) {
            console.log(`🤖 Auto-resolver: market ${dbMarket.market} stuck in oracle for ${Math.floor(secondsSinceExpiry / 3600)}h — force-closing as NO`);
            const result = await resolveMarket(dbMarket.market, false);
            if (result.success) {
              await MarketModel.findByIdAndUpdate(dbMarket._id, { marketStatus: "CLOSED" });
              console.log(`🤖 Auto-resolver: ${dbMarket.market} force-closed (stale oracle)`);
              if (dbMarket.hcsTopicId) {
                submitHCSMessage(dbMarket.hcsTopicId, "MARKET_FORCE_CLOSED", {
                  marketId: dbMarket.market, reason: "Oracle stale for 48+ hours", resolvedAs: "NO",
                });
              }
            }
            continue;
          }

          // Step 1: No oracle request yet → request it (WRITE — costs gas)
          if (oracleRequestId === ZERO_HASH) {
            console.log(`🤖 Auto-resolver: requesting oracle for ${dbMarket.market}`);
            const result = await requestOracleResolution(dbMarket.market);
            if (!result.success) throw new Error("requestOracleResolution failed");
            // HCS log
            if (dbMarket.hcsTopicId) {
              submitHCSMessage(dbMarket.hcsTopicId, "ORACLE_REQUESTED", { marketId: dbMarket.market });
            }
            continue;
          }

          // FREE read: get proposal state
          const proposal = await withRetry(
            () => oracleContract.getProposal(oracleRequestId),
            `getProposal(${dbMarket.market})`
          );
          const proposer = proposal.proposer;
          const disputed = proposal.disputed;
          const settled = proposal.settled;

          // Step 2: No proposal yet → auto-propose based on API price data
          if (proposer === ZERO_ADDRESS) {
            // Auto-propose for crypto markets (marketField: 0) and tweet markets (marketField: 3)
            if (dbMarket.marketField === 0 || dbMarket.marketField === 3) {
              const feedId = dbMarket.feedId || dbMarket.feedName;
              console.log(`🤖 Auto-resolver: fetching ${dbMarket.marketField === 3 ? "tweet metrics" : "price"} for ${dbMarket.market} (apiType: ${dbMarket.apiType}, feedId: ${feedId}, range: ${dbMarket.range}, target: ${dbMarket.value})`);
              const currentValue = await fetchCurrentValue(dbMarket);
              if (currentValue !== null) {
                const outcome = determineOutcome(currentValue, dbMarket.value, dbMarket.direction);
                console.log(`🤖 Auto-resolver: proposing ${outcome === 1 ? "YES" : "NO"} for ${dbMarket.market} (current: ${currentValue}, target: ${dbMarket.value})`);
                const result = await proposeAnswer(oracleRequestId, outcome, ADMIN_BOND);
                if (!result.success) {
                  const errMsg = String(result.error);
                  if (errMsg.includes("DUPLICATE_TRANSACTION")) {
                    console.log(`🤖 Auto-resolver: duplicate transaction for ${dbMarket.market}, proposal already submitted`);
                  } else {
                    throw new Error("proposeAnswer failed");
                  }
                } else if (dbMarket.hcsTopicId) {
                  submitHCSMessage(dbMarket.hcsTopicId, "ORACLE_PROPOSED", {
                    proposer: "auto-resolver", proposedValue: outcome === 1 ? "YES" : "NO",
                    currentValue, targetValue: dbMarket.value,
                  });
                }
              } else {
                console.log(`🤖 Auto-resolver: could not fetch value for ${dbMarket.market}, skipping propose`);
              }
            } else {
              // Non-crypto markets: skip, needs human proposal
              console.log(`🤖 Auto-resolver: non-crypto market ${dbMarket.market}, waiting for human proposal`);
            }
            continue;
          }

          // Step 3: Proposal exists, not settled, not disputed → check if settleable
          if (!settled && !disputed) {
            const settleable = await withRetry(
              () => oracleContract.canSettle(oracleRequestId),
              `canSettle(${dbMarket.market})`
            );
            if (settleable) {
              console.log(`🤖 Auto-resolver: settling proposal for ${dbMarket.market}`);
              const result = await settleProposal(oracleRequestId);
              if (!result.success) throw new Error("settleProposal failed");
              if (dbMarket.hcsTopicId) {
                submitHCSMessage(dbMarket.hcsTopicId, "ORACLE_SETTLED", { marketId: dbMarket.market });
              }
            }
            continue;
          }

          // Disputed but not settled → needs admin judgment, skip
          if (disputed && !settled) continue;

          // Step 4: Settled → check if oracle resolved, then finalize
          const resolved = await withRetry(
            () => oracleContract.isResolved(oracleRequestId),
            `isResolved(${dbMarket.market})`
          );
          if (resolved && status === 1) {
            console.log(`🤖 Auto-resolver: finalizing market ${dbMarket.market}`);
            const result = await finalizeFromOracle(dbMarket.market);
            if (!result.success) throw new Error("finalizeFromOracle failed");
            await MarketModel.findByIdAndUpdate(dbMarket._id, { marketStatus: "CLOSED" });
            console.log(`🤖 Auto-resolver: ${dbMarket.market} finalized and CLOSED`);
            if (dbMarket.hcsTopicId) {
              // Read the final result from the proposal to include winner
              let winnerValue = "unknown";
              try {
                const finalProposal = await withRetry(
                  () => oracleContract.getProposal(oracleRequestId),
                  `getFinalProposal(${dbMarket.market})`
                );
                winnerValue = Number(finalProposal.value) === 1 ? "YES" : "NO";
              } catch (e) { /* ignore */ }
              submitHCSMessage(dbMarket.hcsTopicId, "MARKET_FINALIZED", { marketId: dbMarket.market, result: winnerValue });
            }
          }

          // Clear any previous failure cooldown on success
          failedMarkets.delete(dbMarket.market);
        } catch (err) {
          failedMarkets.set(dbMarket.market, Date.now());
          console.error(`🤖 Auto-resolver error for ${dbMarket.market} (cooldown 5min):`, err);
        }
      }

      // ============ Multi-Outcome Markets ============
      const expiredMultiMarkets = await MarketModel.find({
        marketStatus: "ACTIVE",
        marketType: "multi",
        marketTag: { $ne: "demo" },
      });

      if (expiredMultiMarkets.length > 0 && MULTI_OUTCOME_CONTRACT && MULTI_OUTCOME_ORACLE_CONTRACT) {
        const multiEventContract = new ethers.Contract(MULTI_OUTCOME_CONTRACT, MULTI_OUTCOME_EVENT_ABI, getRpcProvider());
        const multiOracleContract = new ethers.Contract(MULTI_OUTCOME_ORACLE_CONTRACT, MULTI_OUTCOME_ORACLE_ABI, getRpcProvider());

        // Group by eventGroupId to avoid processing the same event multiple times
        const processedEvents = new Set<string>();

        for (const dbMarket of expiredMultiMarkets) {
          const eventGroupId = dbMarket.eventGroupId;
          if (!eventGroupId || processedEvents.has(eventGroupId)) continue;
          processedEvents.add(eventGroupId);

          const lastFail = failedMarkets.get(eventGroupId);
          if (lastFail && Date.now() - lastFail < FAIL_COOLDOWN) continue;

          try {
            // Read event from chain using bracket notation (ethers v6 collision)
            const onChain = await withRetry(
              () => multiEventContract["getEvent(string)"](eventGroupId),
              `getMultiEvent(${eventGroupId})`
            );
            const status = Number(onChain.status);

            // Get HCS topic from any outcome in this event group
            const anyOutcome = expiredMultiMarkets.find(m => m.eventGroupId === eventGroupId);
            const hcsTopicId = anyOutcome?.hcsTopicId || "";

            // Already finished → update DB
            if (status === 2) {
              await MarketModel.updateMany(
                { eventGroupId, marketStatus: { $ne: "CLOSED" } },
                { marketStatus: "CLOSED" }
              );
              console.log(`🤖 Auto-resolver: multi-outcome ${eventGroupId} marked CLOSED in DB`);
              continue;
            }

            if (status !== 1) continue;

            // Check resolution date
            const resolutionDate = Number(onChain.resolutionDate);
            if (resolutionDate > Math.floor(Date.now() / 1000)) continue;

            const oracleRequestId = onChain.oracleRequestId;

            // Stale oracle check: if resolution date was 48+ hours ago and still active, force-close as No Winner
            const secondsSinceExpiry = Math.floor(Date.now() / 1000) - resolutionDate;
            if (secondsSinceExpiry >= STALE_ORACLE_TIMEOUT && oracleRequestId !== ZERO_HASH) {
              console.log(`🤖 Auto-resolver: multi-outcome ${eventGroupId} stuck in oracle for ${Math.floor(secondsSinceExpiry / 3600)}h — force-closing as No Winner`);
              const result = await resolveMultiOutcomeEvent(eventGroupId, -1);
              if (result.success) {
                await MarketModel.updateMany({ eventGroupId }, { marketStatus: "CLOSED" });
                console.log(`🤖 Auto-resolver: multi-outcome ${eventGroupId} force-closed (stale oracle)`);
                if (hcsTopicId) {
                  submitHCSMessage(hcsTopicId, "EVENT_FORCE_CLOSED", {
                    eventGroupId, reason: "Oracle stale for 48+ hours", resolvedAs: "No Winner",
                  });
                }
              }
              continue;
            }

            // Step 1: No oracle request yet → request it
            if (oracleRequestId === ZERO_HASH) {
              console.log(`🤖 Auto-resolver: requesting multi-outcome oracle for ${eventGroupId}`);
              const result = await requestMultiOutcomeOracleResolution(eventGroupId);
              if (!result.success) throw new Error("requestMultiOutcomeOracleResolution failed");
              if (hcsTopicId) {
                submitHCSMessage(hcsTopicId, "ORACLE_REQUESTED", { eventGroupId });
              }
              continue;
            }

            // Read proposal state from multi-outcome oracle
            const proposal = await withRetry(
              () => multiOracleContract.getProposal(oracleRequestId),
              `getMultiProposal(${eventGroupId})`
            );
            const proposer = proposal.proposer;
            const disputed = proposal.disputed;
            const settled = proposal.settled;

            // Step 2: No proposal yet → for multi-outcome, needs manual/admin proposal
            // (No auto-propose for multi-outcome since we can't determine winner from API)
            if (proposer === ZERO_ADDRESS) {
              console.log(`🤖 Auto-resolver: multi-outcome ${eventGroupId} awaiting human proposal`);
              continue;
            }

            // Step 3: Proposal exists, not settled, not disputed → check if settleable
            if (!settled && !disputed) {
              const settleable = await withRetry(
                () => multiOracleContract.canSettle(oracleRequestId),
                `canSettleMulti(${eventGroupId})`
              );
              if (settleable) {
                console.log(`🤖 Auto-resolver: settling multi-outcome proposal for ${eventGroupId}`);
                const result = await settleMultiOutcomeProposal(oracleRequestId);
                if (!result.success) throw new Error("settleMultiOutcomeProposal failed");
                if (hcsTopicId) {
                  submitHCSMessage(hcsTopicId, "ORACLE_SETTLED", { eventGroupId });
                }
              }
              continue;
            }

            // Disputed but not settled → needs admin judgment
            if (disputed && !settled) continue;

            // Step 4: Settled → finalize
            const resolved = await withRetry(
              () => multiOracleContract.isResolved(oracleRequestId),
              `isResolvedMulti(${eventGroupId})`
            );
            if (resolved && status === 1) {
              console.log(`🤖 Auto-resolver: finalizing multi-outcome ${eventGroupId}`);
              const result = await finalizeMultiOutcomeFromOracle(eventGroupId);
              if (!result.success) throw new Error("finalizeMultiOutcomeFromOracle failed");
              await MarketModel.updateMany(
                { eventGroupId },
                { marketStatus: "CLOSED" }
              );
              console.log(`🤖 Auto-resolver: multi-outcome ${eventGroupId} finalized and CLOSED`);
              if (hcsTopicId) {
                // Read the winning outcome from the proposal
                let winnerName = "unknown";
                let winnerIndex = -1;
                try {
                  const finalProposal = await withRetry(
                    () => multiOracleContract.getProposal(oracleRequestId),
                    `getFinalMultiProposal(${eventGroupId})`
                  );
                  winnerIndex = Number(finalProposal.value);
                  if (!isNaN(winnerIndex) && winnerIndex >= 0) {
                    const winnerDoc = await MarketModel.findOne({ eventGroupId, outcomeIndex: winnerIndex });
                    winnerName = winnerDoc?.outcomeName || `Outcome ${winnerIndex}`;
                  }
                } catch (e) { /* ignore — still log finalize */ }
                submitHCSMessage(hcsTopicId, "EVENT_FINALIZED", { eventGroupId, winner: winnerName, winnerIndex });
              }
            }

            failedMarkets.delete(eventGroupId);
          } catch (err) {
            failedMarkets.set(eventGroupId, Date.now());
            console.error(`🤖 Auto-resolver error for multi-outcome ${eventGroupId} (cooldown 5min):`, err);
          }
        }
      }
    } catch (err) {
      console.error("🤖 Auto-resolver poll error:", err);
    }

    // ============ Expired PENDING Markets ============
    // Close pending markets whose resolution date has passed (no point keeping them)
    try {
      const now = new Date();
      const pendingMarkets = await MarketModel.find({ marketStatus: "PENDING" });
      for (const pm of pendingMarkets) {
        const resDate = new Date(pm.date);
        if (resDate <= now) {
          await MarketModel.findByIdAndUpdate(pm._id, { marketStatus: "CLOSED" });
          console.log(`🤖 Auto-resolver: PENDING market ${pm.market || pm.eventGroupId || pm._id} expired — closed`);
          // Close siblings for multi-outcome
          if (pm.eventGroupId) {
            await MarketModel.updateMany(
              { eventGroupId: pm.eventGroupId, marketStatus: "PENDING" },
              { marketStatus: "CLOSED" }
            );
          }
        }
      }
    } catch (err) {
      console.error("🤖 Auto-resolver: error closing expired PENDING markets:", err);
    }
  }, POLL_INTERVAL);
};