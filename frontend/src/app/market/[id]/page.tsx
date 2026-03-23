"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMetaMask } from "@/providers/MetaMaskProvider";
import {
  buyTokens, sellTokens, fetchMarketInfo, estimateBetCost, estimateSellRefund,
  getUserTokens, getLPInfo, removeLiquidity, claimLPRewards, claimWinnings,
  depositLiquidity, hasClaimedWinnings,
  requestOracleResolution, resolveMarketDirect, finalizeMarketFromOracle,
  proposeAnswer, disputeAnswer, settleProposal, resolveOracleDispute,
  canSettle, canDispute, getProposal, getDisputeTimeRemaining, isOracleResolved,
  fetchMultiOutcomeEventInfo, buyMultiOutcomeTokens,
  sellMultiOutcomeTokens, getMultiOutcomeUserTokens, getMultiOutcomeLPInfo,
  removeMultiOutcomeLiquidity, claimMultiOutcomeLPRewards, claimMultiOutcomeWinnings,
  fundMultiOutcomeEvent, hasMultiOutcomeClaimedWinnings,
  requestMultiOutcomeOracleResolution, resolveMultiOutcomeEventDirect,
  finalizeMultiOutcomeFromOracle, proposeMultiOutcomeAnswer, disputeMultiOutcomeAnswer,
  settleMultiOutcomeProposal, resolveMultiOutcomeOracleDispute,
  canSettleMultiOutcome, canDisputeMultiOutcome, getMultiOutcomeProposal,
  getMultiOutcomeDisputeTimeRemaining, isMultiOutcomeOracleResolved,
} from "@/components/hedera_sdk";
import { ADMIN_ADDRESS } from "@/components/hedera_sdk/constants";
import { errorAlert, successAlert } from "@/components/elements/ToastGroup";
import { marketField } from "@/data/data";
import { getCountDown, elipsKey, timeAgo } from "@/utils";
import { MarketDataType } from "@/types/type";
import ProgressBar from "@/components/elements/marketInfo/ProgressBar";
import PriceChart from "@/components/elements/marketInfo/PriceChart";
import CollapsibleDescription from "@/components/elements/CollapsibleDescription";
import { CiStar } from "react-icons/ci";
import { ImAlarm } from "react-icons/im";
import { FaMinus, FaPlus } from "react-icons/fa";
import axios from "axios";
import { API_ENDPOINTS } from "@/config/api";

const formatNumber = (num: number): string => {
  if (num >= 1e12) return (num / 1e12).toFixed(1) + 'T';
  if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(1) + 'k';
  return num.toString();
};

// Default avatar — Twitter/Instagram-style silhouette
const DEFAULT_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='12' fill='%23333'/%3E%3Ccircle cx='32' cy='24' r='10' fill='%23555'/%3E%3Cellipse cx='32' cy='52' rx='18' ry='14' fill='%23555'/%3E%3C/svg%3E";

const DUMMY_COMMENTS = [
  { _id: "dummy-1", wallet: "0xAhmed45...a1b2", text: "This market is looking bullish!", createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), parentId: null, marketId: "", isDummy: true },
  { _id: "dummy-2", wallet: "0xCryptoGuru...c3d4", text: "I'm going with Yes on this one.", createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), parentId: null, marketId: "", isDummy: true },
  { _id: "dummy-3", wallet: "0xHederaFan...e5f6", text: "Interesting prediction, let's see how it plays out.", createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(), parentId: null, marketId: "", isDummy: true },
];

interface CommentData {
  _id: string;
  marketId: string;
  wallet: string;
  text: string;
  parentId: string | null;
  createdAt: string;
}

interface ActivityData {
  _id: string;
  marketId: string;
  wallet: string;
  action: string;
  amount: number;
  question: string;
  createdAt: string;
}

export default function MarketDetail() {
  const [market, setMarket] = useState<MarketDataType | null>(null);
  const [loading, setLoading] = useState(true);
  const [counter, setCounter] = useState("...");
  const [betAmount, setBetAmount] = useState(1);
  const [sellAmount, setSellAmount] = useState(1);
  const [isBetting, setIsBetting] = useState(false);
  const [isSelling, setIsSelling] = useState(false);
  const [bettingSide, setBettingSide] = useState<boolean | null>(null); // true=Yes, false=No
  const [sellingSide, setSellingSide] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState("Comments");
  const [tradeMode, setTradeMode] = useState<"buy" | "sell">("buy");
  const [onChainInfo, setOnChainInfo] = useState<any>(null);
  const [costEstimate, setCostEstimate] = useState<{ cost: number; fee: number; total: number } | null>(null);
  const [sellEstimate, setSellEstimate] = useState<{ refund: number; fee: number; net: number } | null>(null);
  const [sellSide, setSellSide] = useState<boolean>(true); // true = sell Yes, false = sell No
  const [userTokens, setUserTokens] = useState<{ yesTokens: number; noTokens: number }>({ yesTokens: 0, noTokens: 0 });
  const [lpInfo, setLpInfo] = useState<{ shares: number; totalShares: number; claimed: boolean }>({ shares: 0, totalShares: 0, claimed: false });
  const [lpAmount, setLpAmount] = useState("");
  const [isAddingLP, setIsAddingLP] = useState(false);
  const [winningsClaimed, setWinningsClaimed] = useState(false);
  // Resolution state
  const [oracleRequestId, setOracleRequestId] = useState<string | null>(null);
  const [proposal, setProposal] = useState<any>(null);
  const [canSettleNow, setCanSettleNow] = useState(false);
  const [canDisputeNow, setCanDisputeNow] = useState(false);
  const [disputeCountdown, setDisputeCountdown] = useState(0);
  const [oracleResolved, setOracleResolved] = useState(false);
  const [resolutionLoading, setResolutionLoading] = useState(false);
  const [positionOpen, setPositionOpen] = useState(false);
  const [lpOpen, setLpOpen] = useState(false);
  const [tweetData, setTweetData] = useState<any>(null);
  const [marketComments, setMarketComments] = useState<CommentData[]>([]);
  const [marketActivity, setMarketActivity] = useState<ActivityData[]>([]);
  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [commentLoading, setCommentLoading] = useState(false);
  const [avatarMap, setAvatarMap] = useState<Record<string, string>>({});
  // Multi-outcome state
  const [multiEventInfo, setMultiEventInfo] = useState<any>(null);
  const [selectedOutcomeIndex, setSelectedOutcomeIndex] = useState(0);
  const [siblingMarkets, setSiblingMarkets] = useState<MarketDataType[]>([]);
  const [multiTradeMode, setMultiTradeMode] = useState<"buy" | "sell">("buy");
  const [multiUserTokens, setMultiUserTokens] = useState<{ yesTokens: number; noTokens: number }>({ yesTokens: 0, noTokens: 0 });
  const [multiLpInfo, setMultiLpInfo] = useState<{ shares: number; totalShares: number; claimed: boolean }>({ shares: 0, totalShares: 0, claimed: false });
  const [multiLpAmount, setMultiLpAmount] = useState("");
  const [isMultiAddingLP, setIsMultiAddingLP] = useState(false);
  const [multiSellSide, setMultiSellSide] = useState<boolean>(true);
  const [multiAllPositions, setMultiAllPositions] = useState<{ name: string; yesTokens: number; noTokens: number }[]>([]);
  const [multiWinningsClaimed, setMultiWinningsClaimed] = useState(false);
  // Multi-outcome resolution state
  const [multiOracleRequestId, setMultiOracleRequestId] = useState<string | null>(null);
  const [multiProposal, setMultiProposal] = useState<any>(null);
  const [multiCanSettleNow, setMultiCanSettleNow] = useState(false);
  const [multiCanDisputeNow, setMultiCanDisputeNow] = useState(false);
  const [multiDisputeCountdown, setMultiDisputeCountdown] = useState(0);
  const [multiOracleResolved, setMultiOracleResolved] = useState(false);
  const [multiResolutionLoading, setMultiResolutionLoading] = useState(false);
  const [multiProposeOutcome, setMultiProposeOutcome] = useState<number>(0);
  // HCS Audit Log state
  const [hcsMessages, setHcsMessages] = useState<any[]>([]);
  const [hcsLoading, setHcsLoading] = useState(false);
  const router = useRouter();
  const { isConnected, address, signer } = useMetaMask();
  const param = useParams();
  const marketId = param.id as string;
  const isAdmin = isConnected && address?.toLowerCase() === ADMIN_ADDRESS;
  const isExpired = market ? new Date(market.date).getTime() <= Date.now() : false;

  // Fetch market from API
  useEffect(() => {
    const fetchMarket = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`${API_ENDPOINTS.MARKET.GET}?id=${marketId}`);
        if (res.data.data && res.data.data.length > 0) {
          setMarket(res.data.data[0]);
        } else {
          errorAlert("Market not found");
          router.replace("/markets");
        }
      } catch (error) {
        console.error("Error fetching market:", error);
          router.replace("/markets");
      } finally {
        setLoading(false);
      }
    };
    if (marketId) fetchMarket();
  }, [marketId, router]);

  // Fetch on-chain info (poll every 10s when expired to catch auto-resolution)
  useEffect(() => {
    if (!market?.market) return;
    // Skip binary contract fetch for multi-outcome markets
    if (market.marketType === "multi") return;
    const load = async () => {
      const info = await fetchMarketInfo(market.market);
      if (info) setOnChainInfo(info);
    };
    load();
    const interval = setInterval(load, 10_000);
    return () => clearInterval(interval);
  }, [market?.market, market?.marketType]);

  // Fetch multi-outcome event info
  useEffect(() => {
    if (!market?.eventGroupId || market.marketType !== "multi") return;
    const load = async () => {
      const info = await fetchMultiOutcomeEventInfo(market.eventGroupId!);
      if (info) setMultiEventInfo(info);
    };
    load();
    const interval = setInterval(load, 10_000);
    return () => clearInterval(interval);
  }, [market?.eventGroupId, market?.marketType]);

  // Fetch sibling markets for multi-outcome (to get all outcome DB docs)
  useEffect(() => {
    if (!market?.eventGroupId || market.marketType !== "multi") return;
    const load = async () => {
      try {
        const res = await axios.get(`${API_ENDPOINTS.MARKET.EVENT_GROUP}?eventGroupId=${market.eventGroupId}`);
        if (res.data?.data) setSiblingMarkets(res.data.data);
      } catch {}
    };
    load();
  }, [market?.eventGroupId, market?.marketType]);

  // Fetch user positions
  useEffect(() => {
    if (!market?.market || !address) return;
    const load = async () => {
      const tokens = await getUserTokens(market.market, address);
      setUserTokens(tokens);
      const lp = await getLPInfo(market.market, address);
      setLpInfo(lp);
      const claimed = await hasClaimedWinnings(market.market, address);
      setWinningsClaimed(claimed);
    };
    load();
  }, [market?.market, address]);

  // Fetch multi-outcome user positions + LP
  useEffect(() => {
    if (!market?.eventGroupId || market.marketType !== "multi" || !address) return;
    const load = async () => {
      const tokens = await getMultiOutcomeUserTokens(market.eventGroupId!, selectedOutcomeIndex, address);
      setMultiUserTokens(tokens);
      const lp = await getMultiOutcomeLPInfo(market.eventGroupId!, address);
      setMultiLpInfo(lp);
    };
    load();
  }, [market?.eventGroupId, market?.marketType, address, selectedOutcomeIndex]);

  // Fetch ALL multi-outcome positions (for the unified position panel)
  useEffect(() => {
    if (!market?.eventGroupId || market.marketType !== "multi" || !address || !multiEventInfo) return;
    const load = async () => {
      const positions = await Promise.all(
        (multiEventInfo.outcomes as any[]).map(async (o: any, i: number) => {
          const tokens = await getMultiOutcomeUserTokens(market.eventGroupId!, i, address);
          return { name: o.name, yesTokens: tokens.yesTokens, noTokens: tokens.noTokens };
        })
      );
      setMultiAllPositions(positions);
      // Check if winnings already claimed
      const claimed = await hasMultiOutcomeClaimedWinnings(market.eventGroupId!, address);
      setMultiWinningsClaimed(claimed);
    };
    load();
  }, [market?.eventGroupId, market?.marketType, address, multiEventInfo]);

  // Fetch tweet data for tweet markets
  useEffect(() => {
    if (!market || market.marketField !== 3 || !market.feedId) return;
    const fetchTweet = async () => {
      try {
        const res = await axios.get(`${API_ENDPOINTS.TWITTER.TWEET}/${market.feedId}`);
        if (res.data?.success && res.data?.data) setTweetData(res.data.data);
      } catch (err) {
        console.error("Failed to fetch tweet data:", err);
      }
    };
    fetchTweet();
  }, [market]);

  // Countdown timer
  useEffect(() => {
    if (!market) return;
    const interval = setInterval(() => setCounter(getCountDown(market.date)), 1000);
    return () => clearInterval(interval);
  }, [market]);

  // Fetch comments
  useEffect(() => {
    if (!market?._id) return;
    const fetchComments = async () => {
      try {
        const res = await axios.get(`${API_ENDPOINTS.COMMENT.GET}?marketId=${market._id}`);
        if (res.data?.data) setMarketComments(res.data.data);
      } catch (err) { console.error("Failed to fetch comments:", err); }
    };
    fetchComments();
  }, [market?._id]);

  // Fetch market activity
  useEffect(() => {
    if (!market?._id) return;
    const fetchActivity = async () => {
      try {
        const res = await axios.get(`${API_ENDPOINTS.RECENT.GET}?marketId=${market._id}&limit=50`);
        if (res.data?.data) setMarketActivity(res.data.data);
      } catch (err) { console.error("Failed to fetch activity:", err); }
    };
    fetchActivity();
  }, [market?._id]);

  // Fetch avatars for comment authors + activity wallets
  useEffect(() => {
    const wallets = [...new Set([
      ...marketComments.map(c => c.wallet),
      ...marketActivity.map(a => a.wallet),
    ])];
    if (address) wallets.push(address);
    if (wallets.length === 0) return;
    (async () => {
      try {
        const res = await axios.get(`${API_ENDPOINTS.PROFILE.AVATARS_BATCH}?wallets=${wallets.join(",")}`);
        if (res.data?.data) setAvatarMap(res.data.data);
      } catch (err) { /* ignore */ }
    })();
  }, [marketComments, marketActivity, address]);

  // Fetch HCS audit log when tab is selected + auto-refresh every 30s
  useEffect(() => {
    if (activeTab !== "HCS Audit Log") return;
    const topicId = market?.hcsTopicId;
    if (!topicId) return;
    const fetchHCS = async () => {
      setHcsLoading((prev) => hcsMessages.length === 0 ? true : prev);
      try {
        const res = await fetch(`${API_ENDPOINTS.HCS.MIRROR_NODE}/${topicId}/messages?order=desc&limit=100`);
        const json = await res.json();
        if (json?.messages) {
          const parsed = json.messages.map((m: any) => {
            try {
              const decoded = atob(m.message);
              const data = JSON.parse(decoded);
              return { ...data, consensusTimestamp: m.consensus_timestamp, sequenceNumber: m.sequence_number };
            } catch { return null; }
          }).filter(Boolean);
          setHcsMessages(parsed);
        }
      } catch (err) { console.error("HCS fetch error:", err); }
      setHcsLoading(false);
    };
    fetchHCS();
    const interval = setInterval(fetchHCS, 30000);
    return () => clearInterval(interval);
  }, [activeTab, market?.hcsTopicId]);

  const getAvatar = (wallet: string) => avatarMap[wallet.toLowerCase()] || DEFAULT_AVATAR;

  const postComment = async (parentId?: string) => {
    if (!isConnected || !address) { errorAlert("Connect wallet to comment"); return; }
    const text = newComment.trim();
    if (!text) return;
    setCommentLoading(true);
    try {
      const res = await axios.post(API_ENDPOINTS.COMMENT.ADD, {
        marketId: market?._id, wallet: address, text, parentId: parentId || null,
      });
      if (res.data?.data) setMarketComments((prev) => [...prev, res.data.data]);
      setNewComment("");
      setReplyingTo(null);
    } catch (err) { console.error("Failed to post comment:", err); errorAlert("Failed to post comment"); }
    setCommentLoading(false);
  };

  // Fetch oracle/resolution state (poll every 10s during resolution)
  useEffect(() => {
    if (!onChainInfo || onChainInfo.status === "prepare") return;
    const loadOracle = async () => {
      const reqId = onChainInfo.oracleRequestId;
      setOracleRequestId(reqId);
      if (!reqId) return;
      const prop = await getProposal(reqId);
      setProposal(prop);
      if (prop && prop.proposer !== "0x0000000000000000000000000000000000000000") {
        const [settle, dispute] = await Promise.all([canSettle(reqId), canDispute(reqId)]);
        setCanSettleNow(settle);
        setCanDisputeNow(dispute);
        const remaining = await getDisputeTimeRemaining(reqId);
        setDisputeCountdown(remaining);
        const resolved = await isOracleResolved(reqId);
        setOracleResolved(resolved);
      }
    };
    loadOracle();
    // Poll while market is active (resolution in progress)
    if (onChainInfo.status === "active") {
      const interval = setInterval(loadOracle, 10_000);
      return () => clearInterval(interval);
    }
  }, [onChainInfo]);

  // Dispute countdown ticker
  useEffect(() => {
    if (disputeCountdown <= 0) return;
    const interval = setInterval(() => setDisputeCountdown((p) => Math.max(0, p - 1)), 1000);
    return () => clearInterval(interval);
  }, [disputeCountdown]);

  // Fetch multi-outcome oracle/resolution state
  useEffect(() => {
    if (!multiEventInfo || multiEventInfo.status === "prepare" || market?.marketType !== "multi") return;
    const loadMultiOracle = async () => {
      const reqId = multiEventInfo.oracleRequestId;
      setMultiOracleRequestId(reqId);
      if (!reqId) return;
      const prop = await getMultiOutcomeProposal(reqId);
      setMultiProposal(prop);
      if (prop && prop.proposer !== "0x0000000000000000000000000000000000000000") {
        const [settle, dispute] = await Promise.all([canSettleMultiOutcome(reqId), canDisputeMultiOutcome(reqId)]);
        setMultiCanSettleNow(settle);
        setMultiCanDisputeNow(dispute);
        const remaining = await getMultiOutcomeDisputeTimeRemaining(reqId);
        setMultiDisputeCountdown(remaining);
        const resolved = await isMultiOutcomeOracleResolved(reqId);
        setMultiOracleResolved(resolved);
      }
    };
    loadMultiOracle();
    if (multiEventInfo.status === "active") {
      const interval = setInterval(loadMultiOracle, 10_000);
      return () => clearInterval(interval);
    }
  }, [multiEventInfo, market?.marketType]);

  // Multi-outcome dispute countdown ticker
  useEffect(() => {
    if (multiDisputeCountdown <= 0) return;
    const interval = setInterval(() => setMultiDisputeCountdown((p) => Math.max(0, p - 1)), 1000);
    return () => clearInterval(interval);
  }, [multiDisputeCountdown]);

  // Estimate buy cost
  const updateBuyEstimate = useCallback(async (amount: number, isYes: boolean) => {
    if (!market?.market || amount <= 0) { setCostEstimate(null); return; }
    const est = await estimateBetCost(market.market, amount, isYes);
    setCostEstimate(est);
  }, [market?.market]);

  useEffect(() => {
    if (tradeMode === "buy") updateBuyEstimate(betAmount, true);
  }, [betAmount, updateBuyEstimate, tradeMode]);

  // Estimate sell refund
  const updateSellEstimate = useCallback(async (amount: number, isYes: boolean) => {
    if (!market?.market || amount <= 0) { setSellEstimate(null); return; }
    const est = await estimateSellRefund(market.market, amount, isYes);
    setSellEstimate(est);
  }, [market?.market]);

  useEffect(() => {
    if (tradeMode === "sell") updateSellEstimate(sellAmount, sellSide);
  }, [sellAmount, sellSide, updateSellEstimate, tradeMode]);

  // Use on-chain prices for probability
  const isMulti = market?.marketType === "multi";
  const yesPercent = isMulti
    ? (multiEventInfo?.outcomes?.[selectedOutcomeIndex]?.yesPrice != null
      ? Math.round(multiEventInfo.outcomes[selectedOutcomeIndex].yesPrice * 100)
      : (multiEventInfo?.outcomeCount ? Math.round(100 / multiEventInfo.outcomeCount) : 50))
    : onChainInfo ? Math.round(onChainInfo.yesPrice * 100) : 50;

  const refreshData = async () => {
    if (!market) return;
    const res = await axios.get(`${API_ENDPOINTS.MARKET.GET}?id=${marketId}`);
    if (res.data.data?.[0]) setMarket(res.data.data[0]);
    if (isMulti && market.eventGroupId) {
      const info = await fetchMultiOutcomeEventInfo(market.eventGroupId);
      if (info) {
        setMultiEventInfo(info);
        if (address) {
          const tokens = await getMultiOutcomeUserTokens(market.eventGroupId, selectedOutcomeIndex, address);
          setMultiUserTokens(tokens);
          const lp = await getMultiOutcomeLPInfo(market.eventGroupId, address);
          setMultiLpInfo(prev => ({ ...lp, claimed: prev.claimed || lp.claimed }));
          // Refresh all positions
          const positions = await Promise.all(
            (info.outcomes as any[]).map(async (o: any, i: number) => {
              const t = await getMultiOutcomeUserTokens(market.eventGroupId!, i, address);
              return { name: o.name, yesTokens: t.yesTokens, noTokens: t.noTokens };
            })
          );
          setMultiAllPositions(positions);
          const mClaimed = await hasMultiOutcomeClaimedWinnings(market.eventGroupId, address);
          setMultiWinningsClaimed(prev => prev || mClaimed);
        }
      }
    } else if (market.market) {
      const info = await fetchMarketInfo(market.market);
      if (info) setOnChainInfo(info);
      if (address) {
        const tokens = await getUserTokens(market.market, address);
        setUserTokens(tokens);
        const lp = await getLPInfo(market.market, address);
        setLpInfo(prev => ({ ...lp, claimed: prev.claimed || lp.claimed }));
        const claimed = await hasClaimedWinnings(market.market, address);
        setWinningsClaimed(prev => prev || claimed);
      }
    }
  };

  const onBuy = async (isYes: boolean) => {
    if (!isConnected || !signer || !market) { errorAlert("Please connect wallet!"); return; }
    if (betAmount <= 0) { errorAlert("Enter a valid amount!"); return; }
    setIsBetting(true);
    setBettingSide(isYes);
    try {
      if (isMulti && market.eventGroupId) {
        const result = await buyMultiOutcomeTokens({
          eventId: market.eventGroupId,
          outcomeIndex: selectedOutcomeIndex,
          isYes,
          amount: betAmount,
          signer,
        });
        // Record price history for ALL outcomes (normalization changes all prices)
        try {
          const updatedInfo = await fetchMultiOutcomeEventInfo(market.eventGroupId);
          if (updatedInfo) {
            for (let oi = 0; oi < updatedInfo.outcomes.length; oi++) {
              const outcome = updatedInfo.outcomes[oi];
              const targetMarket = siblingMarkets.find(m => m.outcomeIndex === oi);
              if (targetMarket) {
                await axios.post(API_ENDPOINTS.MARKET.BETTING, {
                  player: address, market_id: targetMarket._id, amount: oi === selectedOutcomeIndex ? betAmount : 0, isYes,
                  yesPrice: outcome.yesPrice, noPrice: outcome.noPrice,
                  cost: oi === selectedOutcomeIndex ? result.cost : 0, fee: 0,
                  txHash: result.txHash,
                });
              }
            }
          }
        } catch {}
        const outcomeName = multiEventInfo?.outcomes?.[selectedOutcomeIndex]?.name || `Outcome ${selectedOutcomeIndex}`;
        successAlert(`Bought ${betAmount} ${isYes ? "Yes" : "No"} on "${outcomeName}"!`, { txHash: result.txHash });
        await refreshData();
      } else {
        const result = await buyTokens({ marketId: market.market, amount: betAmount, isYes, signer });
        await axios.post(API_ENDPOINTS.MARKET.BETTING, {
          player: address, market_id: market._id, amount: betAmount, isYes, ...result,
        });
        successAlert(`Bought ${betAmount} ${isYes ? "Yes" : "No"} token${betAmount > 1 ? "s" : ""}!`, { txHash: result.txHash });
        await refreshData();
      }
    } catch (error: any) {
      console.error("Buy error:", error);
      errorAlert(error.message || "Buy failed!");
    }
    setIsBetting(false);
    setBettingSide(null);
  };

  const onSell = async () => {
    if (!isConnected || !signer || !market) { errorAlert("Please connect wallet!"); return; }
    if (sellAmount <= 0) { errorAlert("Enter a valid amount!"); return; }
    const maxTokens = sellSide ? userTokens.yesTokens : userTokens.noTokens;
    if (sellAmount > maxTokens) { errorAlert(`You only have ${maxTokens} ${sellSide ? "Yes" : "No"} tokens!`); return; }
    setIsSelling(true);
    setSellingSide(sellSide);
    try {
      const result = await sellTokens(market.market, sellSide, sellAmount, signer);
      successAlert(`Sold ${sellAmount} ${sellSide ? "Yes" : "No"} token${sellAmount > 1 ? "s" : ""}!`, { txHash: result.txHash });
      await refreshData();
    } catch (error: any) {
      console.error("Sell error:", error);
      errorAlert(error.message || "Sell failed!");
    }
    setIsSelling(false);
    setSellingSide(null);
  };

  const onRemoveLP = async () => {
    if (!signer || !market) return;
    try {
      const result = await removeLiquidity(market.market, signer);
      successAlert("Liquidity removed!", { txHash: result.txHash });
      await refreshData();
    } catch (error: any) { errorAlert(error.message || "Failed to remove liquidity"); }
  };

  const onClaimLP = async () => {
    if (!signer || !market) return;
    try {
      const result = await claimLPRewards(market.market, signer);
      successAlert("LP rewards claimed!", { txHash: result.txHash });
      await refreshData();
    } catch (error: any) { errorAlert(error.message || "Failed to claim LP rewards"); }
  };

  const onClaimWinnings = async () => {
    if (!signer || !market) return;
    try {
      const result = await claimWinnings(market.market, signer);
      successAlert("Winnings claimed!", { txHash: result.txHash });
      await refreshData();
    } catch (error: any) { errorAlert(error.message || "Failed to claim winnings"); }
  };

  const onAddLP = async () => {
    if (!isConnected || !signer || !market) { errorAlert("Please connect wallet!"); return; }
    const amt = parseFloat(lpAmount);
    if (!amt || amt <= 0) { errorAlert("Enter a valid HBAR amount!"); return; }
    setIsAddingLP(true);
    try {
      const result = await depositLiquidity({ market_id: market.market, amount: amt, accountId: address || "", signer });
      await axios.post(API_ENDPOINTS.MARKET.LIQUIDITY, {
        market_id: market._id, amount: amt, investor: address, active: result.status === "active",
      });
      successAlert(`Added ${amt} HBAR liquidity!`, { txHash: result.txHash });
      setLpAmount("");
      await refreshData();
    } catch (error: any) {
      console.error("Add LP error:", error);
      errorAlert(error.message || "Failed to add liquidity");
    }
    setIsAddingLP(false);
  };

  // ============ Multi-Outcome Sell ============
  const onMultiSell = async () => {
    if (!isConnected || !signer || !market?.eventGroupId) { errorAlert("Please connect wallet!"); return; }
    if (sellAmount <= 0) { errorAlert("Enter a valid amount!"); return; }
    const maxTokens = multiSellSide ? multiUserTokens.yesTokens : multiUserTokens.noTokens;
    if (sellAmount > maxTokens) { errorAlert(`You only have ${maxTokens} ${multiSellSide ? "Yes" : "No"} tokens!`); return; }
    setIsSelling(true);
    setSellingSide(multiSellSide);
    try {
      const result = await sellMultiOutcomeTokens({
        eventId: market.eventGroupId, outcomeIndex: selectedOutcomeIndex,
        isYes: multiSellSide, amount: sellAmount, signer,
      });
      // Record price history for ALL outcomes after sell
      try {
        const updatedInfo = await fetchMultiOutcomeEventInfo(market.eventGroupId);
        if (updatedInfo) {
          for (let oi = 0; oi < updatedInfo.outcomes.length; oi++) {
            const outcome = updatedInfo.outcomes[oi];
            const targetMarket = siblingMarkets.find(m => m.outcomeIndex === oi);
            if (targetMarket) {
              await axios.post(API_ENDPOINTS.MARKET.BETTING, {
                player: address, market_id: targetMarket._id, amount: oi === selectedOutcomeIndex ? sellAmount : 0,
                isYes: multiSellSide,
                yesPrice: outcome.yesPrice, noPrice: outcome.noPrice,
                cost: 0, fee: 0, txHash: result.txHash,
              });
            }
          }
        }
      } catch {}
      const outcomeName = multiEventInfo?.outcomes?.[selectedOutcomeIndex]?.name || `Outcome ${selectedOutcomeIndex}`;
      successAlert(`Sold ${sellAmount} ${multiSellSide ? "Yes" : "No"} on "${outcomeName}"!`, { txHash: result.txHash });
      await refreshData();
    } catch (error: any) { errorAlert(error.message || "Sell failed!"); }
    setIsSelling(false);
    setSellingSide(null);
  };

  // ============ Multi-Outcome LP ============
  const onMultiRemoveLP = async () => {
    if (!signer || !market?.eventGroupId) return;
    try {
      const result = await removeMultiOutcomeLiquidity(market.eventGroupId, signer);
      successAlert("Liquidity removed!", { txHash: result.txHash });
      await refreshData();
    } catch (error: any) { errorAlert(error.message || "Failed to remove liquidity"); }
  };

  const onMultiClaimLP = async () => {
    if (!signer || !market?.eventGroupId) return;
    try {
      const result = await claimMultiOutcomeLPRewards(market.eventGroupId, signer);
      setMultiLpInfo(prev => ({ ...prev, claimed: true }));
      successAlert("LP rewards claimed!", { txHash: result.txHash });
      await refreshData();
    } catch (error: any) { errorAlert(error.message || "Failed to claim LP rewards"); }
  };

  const onMultiClaimWinnings = async () => {
    if (!signer || !market?.eventGroupId) return;
    try {
      const result = await claimMultiOutcomeWinnings(market.eventGroupId, signer);
      setMultiWinningsClaimed(true);
      successAlert("Winnings claimed!", { txHash: result.txHash });
      await refreshData();
    } catch (error: any) { errorAlert(error.message || "Failed to claim winnings"); }
  };

  const onMultiAddLP = async () => {
    if (!isConnected || !signer || !market?.eventGroupId) { errorAlert("Please connect wallet!"); return; }
    const amt = parseFloat(multiLpAmount);
    if (!amt || amt <= 0) { errorAlert("Enter a valid HBAR amount!"); return; }
    setIsMultiAddingLP(true);
    try {
      const result = await fundMultiOutcomeEvent({ eventId: market.eventGroupId, amount: amt, signer });
      successAlert(`Added ${amt} HBAR liquidity!`, { txHash: result.txHash });
      setMultiLpAmount("");
      await refreshData();
    } catch (error: any) { errorAlert(error.message || "Failed to add liquidity"); }
    setIsMultiAddingLP(false);
  };

  // ============ Resolution Handlers ============
  const onRequestOracle = async () => {
    if (!signer || !market) return;
    setResolutionLoading(true);
    try {
      const result = await requestOracleResolution(market.market, signer);
      axios.post(API_ENDPOINTS.MARKET.HCS_LOG, { marketId: market._id, type: "ORACLE_REQUESTED", data: { requestedBy: address } }).catch(() => {});
      successAlert("Oracle resolution requested!", { txHash: result.txHash });
      await refreshData();
    } catch (error: any) { errorAlert(error.message || "Failed to request oracle resolution"); }
    setResolutionLoading(false);
  };

  const onDirectResolve = async (result: boolean) => {
    if (!signer || !market) return;
    setResolutionLoading(true);
    try {
      const res = await resolveMarketDirect(market.market, result, signer);
      await axios.post(API_ENDPOINTS.MARKET.RESOLVE, { market_id: market._id }).catch(() => {});
      axios.post(API_ENDPOINTS.MARKET.HCS_LOG, { marketId: market._id, type: "MARKET_RESOLVED", data: { resolvedBy: address, result: result ? "YES" : "NO" } }).catch(() => {});
      successAlert(`Market resolved as ${result ? "Yes" : "No"}!`, { txHash: res.txHash });
      await refreshData();
    } catch (error: any) { errorAlert(error.message || "Failed to resolve market"); }
    setResolutionLoading(false);
  };

  const onPropose = async (value: 1 | -1) => {
    if (!signer || !oracleRequestId) return;
    setResolutionLoading(true);
    try {
      const result = await proposeAnswer(oracleRequestId, value, signer, isAdmin);
      axios.post(API_ENDPOINTS.MARKET.HCS_LOG, { marketId: market?._id, type: "ORACLE_PROPOSED", data: { proposer: address, proposedValue: value === 1 ? "YES" : "NO" } }).catch(() => {});
      successAlert(`Proposed ${value === 1 ? "Yes" : "No"}! Dispute window open.`, { txHash: result.txHash });
      await refreshData();
    } catch (error: any) { errorAlert(error.message || "Failed to propose answer"); }
    setResolutionLoading(false);
  };

  const onDispute = async () => {
    if (!signer || !oracleRequestId) return;
    setResolutionLoading(true);
    try {
      const result = await disputeAnswer(oracleRequestId, signer, isAdmin);
      axios.post(API_ENDPOINTS.MARKET.HCS_LOG, { marketId: market?._id, type: "ORACLE_DISPUTED", data: { disputedBy: address } }).catch(() => {});
      successAlert("Answer disputed!", { txHash: result.txHash });
      await refreshData();
    } catch (error: any) { errorAlert(error.message || "Failed to dispute"); }
    setResolutionLoading(false);
  };

  const onSettle = async () => {
    if (!signer || !oracleRequestId) return;
    setResolutionLoading(true);
    try {
      const result = await settleProposal(oracleRequestId, signer);
      axios.post(API_ENDPOINTS.MARKET.HCS_LOG, { marketId: market?._id, type: "ORACLE_SETTLED", data: { settledBy: address } }).catch(() => {});
      successAlert("Proposal settled!", { txHash: result.txHash });
      await refreshData();
    } catch (error: any) { errorAlert(error.message || "Failed to settle"); }
    setResolutionLoading(false);
  };

  const onResolveDispute = async (finalValue: 1 | -1) => {
    if (!signer || !oracleRequestId) return;
    setResolutionLoading(true);
    try {
      const result = await resolveOracleDispute(oracleRequestId, finalValue, signer);
      axios.post(API_ENDPOINTS.MARKET.HCS_LOG, { marketId: market?._id, type: "MARKET_RESOLVED", data: { resolvedBy: address, result: finalValue === 1 ? "YES" : "NO", method: "admin_dispute_resolution" } }).catch(() => {});
      successAlert(`Dispute resolved as ${finalValue === 1 ? "Yes" : "No"}!`, { txHash: result.txHash });
      await refreshData();
    } catch (error: any) { errorAlert(error.message || "Failed to resolve dispute"); }
    setResolutionLoading(false);
  };

  const onFinalize = async () => {
    if (!signer || !market) return;
    setResolutionLoading(true);
    try {
      const result = await finalizeMarketFromOracle(market.market, signer);
      await axios.post(API_ENDPOINTS.MARKET.RESOLVE, { market_id: market._id }).catch(() => {});
      axios.post(API_ENDPOINTS.MARKET.HCS_LOG, { marketId: market._id, type: "MARKET_FINALIZED", data: { finalizedBy: address } }).catch(() => {});
      successAlert("Market finalized from oracle!", { txHash: result.txHash });
      await refreshData();
    } catch (error: any) { errorAlert(error.message || "Failed to finalize market"); }
    setResolutionLoading(false);
  };

  // ============ Multi-Outcome Resolution Handlers ============
  const onMultiRequestOracle = async () => {
    if (!signer || !market?.eventGroupId) return;
    setMultiResolutionLoading(true);
    try {
      const result = await requestMultiOutcomeOracleResolution(market.eventGroupId, signer);
      axios.post(API_ENDPOINTS.MARKET.HCS_LOG, { eventGroupId: market.eventGroupId, type: "ORACLE_REQUESTED", data: { requestedBy: address } }).catch(() => {});
      successAlert("Oracle resolution requested!", { txHash: result.txHash });
      await refreshData();
    } catch (error: any) { errorAlert(error.message || "Failed to request oracle resolution"); }
    setMultiResolutionLoading(false);
  };

  const onMultiDirectResolve = async (outcomeIndex: number) => {
    if (!signer || !market?.eventGroupId) return;
    setMultiResolutionLoading(true);
    try {
      const result = await resolveMultiOutcomeEventDirect(market.eventGroupId, outcomeIndex, signer);
      for (const sm of siblingMarkets) {
        await axios.post(API_ENDPOINTS.MARKET.RESOLVE, { market_id: sm._id }).catch(() => {});
      }
      const outcomeName = multiEventInfo?.outcomes?.[outcomeIndex]?.name || `Outcome ${outcomeIndex}`;
      axios.post(API_ENDPOINTS.MARKET.HCS_LOG, { eventGroupId: market.eventGroupId, type: "EVENT_RESOLVED", data: { resolvedBy: address, winner: outcomeName, winnerIndex: outcomeIndex, method: "admin_direct" } }).catch(() => {});
      successAlert(`Event resolved: ${outcomeName} wins!`, { txHash: result.txHash });
      await refreshData();
    } catch (error: any) { errorAlert(error.message || "Failed to resolve event"); }
    setMultiResolutionLoading(false);
  };

  const onMultiPropose = async (outcomeIndex: number) => {
    if (!signer || !multiOracleRequestId) return;
    setMultiResolutionLoading(true);
    try {
      const result = await proposeMultiOutcomeAnswer(multiOracleRequestId, outcomeIndex, signer, isAdmin);
      const outcomeName = multiEventInfo?.outcomes?.[outcomeIndex]?.name || `Outcome ${outcomeIndex}`;
      axios.post(API_ENDPOINTS.MARKET.HCS_LOG, { eventGroupId: market?.eventGroupId, type: "ORACLE_PROPOSED", data: { proposer: address, proposedWinner: outcomeName, proposedIndex: outcomeIndex } }).catch(() => {});
      successAlert(`Proposed "${outcomeName}" as winner! Dispute window open.`, { txHash: result.txHash });
      await refreshData();
    } catch (error: any) { errorAlert(error.message || "Failed to propose answer"); }
    setMultiResolutionLoading(false);
  };

  const onMultiDispute = async () => {
    if (!signer || !multiOracleRequestId) return;
    setMultiResolutionLoading(true);
    try {
      const result = await disputeMultiOutcomeAnswer(multiOracleRequestId, signer, isAdmin);
      axios.post(API_ENDPOINTS.MARKET.HCS_LOG, { eventGroupId: market?.eventGroupId, type: "ORACLE_DISPUTED", data: { disputedBy: address } }).catch(() => {});
      successAlert("Answer disputed!", { txHash: result.txHash });
      await refreshData();
    } catch (error: any) { errorAlert(error.message || "Failed to dispute"); }
    setMultiResolutionLoading(false);
  };

  const onMultiSettle = async () => {
    if (!signer || !multiOracleRequestId) return;
    setMultiResolutionLoading(true);
    try {
      const result = await settleMultiOutcomeProposal(multiOracleRequestId, signer);
      axios.post(API_ENDPOINTS.MARKET.HCS_LOG, { eventGroupId: market?.eventGroupId, type: "ORACLE_SETTLED", data: { settledBy: address } }).catch(() => {});
      successAlert("Proposal settled!", { txHash: result.txHash });
      await refreshData();
    } catch (error: any) { errorAlert(error.message || "Failed to settle"); }
    setMultiResolutionLoading(false);
  };

  const onMultiResolveDispute = async (outcomeIndex: number) => {
    if (!signer || !multiOracleRequestId) return;
    setMultiResolutionLoading(true);
    try {
      const result = await resolveMultiOutcomeOracleDispute(multiOracleRequestId, outcomeIndex, signer);
      const outcomeName = multiEventInfo?.outcomes?.[outcomeIndex]?.name || `Outcome ${outcomeIndex}`;
      axios.post(API_ENDPOINTS.MARKET.HCS_LOG, { eventGroupId: market?.eventGroupId, type: "EVENT_RESOLVED", data: { resolvedBy: address, winner: outcomeName, winnerIndex: outcomeIndex, method: "admin_dispute_resolution" } }).catch(() => {});
      successAlert(`Dispute resolved: "${outcomeName}" wins!`, { txHash: result.txHash });
      await refreshData();
    } catch (error: any) { errorAlert(error.message || "Failed to resolve dispute"); }
    setMultiResolutionLoading(false);
  };

  const onMultiFinalize = async () => {
    if (!signer || !market?.eventGroupId) return;
    setMultiResolutionLoading(true);
    try {
      const result = await finalizeMultiOutcomeFromOracle(market.eventGroupId, signer);
      for (const sm of siblingMarkets) {
        await axios.post(API_ENDPOINTS.MARKET.RESOLVE, { market_id: sm._id }).catch(() => {});
      }
      axios.post(API_ENDPOINTS.MARKET.HCS_LOG, { eventGroupId: market.eventGroupId, type: "EVENT_FINALIZED", data: { finalizedBy: address } }).catch(() => {});
      successAlert("Event finalized from oracle!", { txHash: result.txHash });
      await refreshData();
    } catch (error: any) { errorAlert(error.message || "Failed to finalize event"); }
    setMultiResolutionLoading(false);
  };

  const formatDisputeTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}h ${m}m ${s}s`;
  };

  if (loading) {
    return (
      <div className="self-stretch px-[50px] flex flex-col justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#07b3ff]" />
        <p className="text-[#838587] text-lg mt-4">Loading market...</p>
      </div>
    );
  }

  if (!market) return null;

  // Multi-outcome: wait for on-chain data before rendering anything
  if (isMulti && !multiEventInfo) {
    return (
      <div className="self-stretch px-[50px] flex flex-col justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#07b3ff]" />
        <p className="text-[#838587] text-lg mt-4">Loading market...</p>
      </div>
    );
  }

  return (
    <div className="self-stretch px-[50px] flex flex-col gap-[40px] pb-10" style={{ overflow: "visible" }}>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <div onClick={() => router.push("/markets")} className="text-[#838587] text-lg font-rubic cursor-pointer hover:text-white transition-colors">Markets</div>
        <div className="text-[#838587] text-lg font-rubic">{">"}</div>
        <div className="text-white text-lg font-rubic truncate max-w-[400px]">{isMulti ? (market.eventQuestion || market.question) : market.question}</div>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-start gap-[40px]">
        {/* Left: Market Info */}
        <div className="flex-1 flex flex-col gap-6">
          {/* Header Card */}
          <div className="p-6 bg-[#1e1e1e] rounded-2xl outline-1 outline-offset-[-1px] outline-[#313131] flex flex-col gap-6">
            <div className="flex justify-between items-start">
              <div className="flex flex-col gap-2 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[#07b3ff] text-base font-semibold font-interSemi">
                    {marketField[market.marketField]?.displayName || marketField[market.marketField]?.name || "Market"}
                    {(market.marketField === 1 || market.marketField === 2) && market.feedName && (
                      <span className="text-[#838587] text-xs font-normal ml-1">{`• ${market.feedName}`}</span>
                    )}
                    {market.marketField === 3 && market.feedName && (
                      <span className="text-[#838587] text-xs font-normal ml-1">{`• ${market.feedName.includes("·") ? market.feedName.split("·").pop()?.trim() : market.feedName}`}</span>
                    )}
                  </span>
                  {market.marketTag === "demo" && (
                    <span className="px-2 py-0.5 bg-[#ff6464] rounded text-black text-xs font-bold uppercase">Demo</span>
                  )}
                  {market.marketTag === "test" && (
                    <span className="px-2 py-0.5 bg-[#3fd145] rounded text-black text-xs font-bold uppercase">Test</span>
                  )}
                </div>
                <h1 className="text-white text-3xl font-medium font-rubik leading-tight">
                  {isMulti ? (market.eventQuestion || market.question) : market.question}
                </h1>
              </div>
              <div className="flex gap-2 items-center ml-4">
                {market.imageUrl && <img src={market.imageUrl} alt="" className="w-16 h-16 rounded-xl object-contain" />}
                <CiStar className="text-white text-2xl cursor-pointer hover:text-[#ffd600] transition-colors" />
              </div>
            </div>

            {/* Stats Row */}
            <div className="flex flex-wrap gap-6">
              <div className="flex items-center gap-2 px-3 py-2 bg-[#3fd145]/10 rounded-xl min-w-[180px]">
                <ImAlarm color="#3fd145" size={18} />
                <span className="text-[#3fd145] text-base font-medium font-satoshi tabular-nums">{counter}</span>
              </div>
              <div className="flex flex-col min-w-[100px]">
                <span className="text-[#838587] text-sm font-satoshi">Volume</span>
                <span className="text-white text-base font-semibold font-satoshi tabular-nums">
                  {isMulti && multiEventInfo
                    ? multiEventInfo.outcomes.reduce((sum: number, o: any) => sum + o.totalVolume, 0).toFixed(2)
                    : onChainInfo ? onChainInfo.totalVolume.toFixed(2) : (market.totalInvestment?.toFixed(4) || "0")} HBAR
                </span>
              </div>
              <div className="flex flex-col min-w-[80px]">
                <span className="text-[#838587] text-sm font-satoshi">Total Bets</span>
                <span className="text-white text-base font-semibold font-satoshi tabular-nums">{market.totalBets || 0}</span>
              </div>
              <div className="flex flex-col min-w-[100px]">
                <span className="text-[#838587] text-sm font-satoshi">Creator</span>
                <span className="text-[#07b3ff] text-sm font-satoshi">{elipsKey(market.creator)}</span>
              </div>
            </div>

            {/* Tweet Preview — inline for tweet markets */}
            {market.marketField === 3 && tweetData && (
              <div className="p-3 bg-[#111] rounded-xl border border-[#2a2a2a] flex flex-col gap-3">
                <div className="flex gap-3">
                  {tweetData.authorAvatar && <img src={tweetData.authorAvatar} alt="" className="w-9 h-9 rounded-full flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-white text-xs font-semibold">{tweetData.authorName}</span>
                      <span className="text-[#666] text-[11px]">@{tweetData.authorHandle}</span>
                    </div>
                    <p className="text-[#ccc] text-xs leading-relaxed line-clamp-3">{tweetData.text?.replace(/https?:\/\/t\.co\/\S+/g, "").trim()}</p>
                  </div>
                </div>
                {tweetData.media && tweetData.media.length > 0 && (
                  <div className="rounded-lg overflow-hidden border border-[#2a2a2a]" style={{ maxHeight: "180px" }}>
                    {tweetData.media.length === 1 ? (
                      <div className="relative" style={{ maxHeight: "180px" }}>
                        <img src={tweetData.media[0].previewUrl || tweetData.media[0].url} alt="" className="w-full object-cover" style={{ maxHeight: "180px" }} />
                        {(tweetData.media[0].type === "video" || tweetData.media[0].type === "animated_gif") && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none">
                            <div className="w-9 h-9 rounded-full bg-white/90 flex items-center justify-center">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="#000"><path d="M8 5v14l11-7z"/></svg>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-px" style={{ maxHeight: "180px" }}>
                        {tweetData.media.slice(0, 4).map((m: any, i: number) => (
                          <div key={i} className="relative overflow-hidden" style={{ height: "90px" }}>
                            <img src={m.previewUrl || m.url} alt="" className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <div className="flex gap-3">
                    <span className="text-[#666] text-[10px]">Views: <span className="text-white font-semibold">{formatNumber(tweetData.views)}</span></span>
                    <span className="text-[#666] text-[10px]">Likes: <span className="text-white font-semibold">{formatNumber(tweetData.likes)}</span></span>
                    <span className="text-[#666] text-[10px]">Retweets: <span className="text-white font-semibold">{formatNumber(tweetData.retweets)}</span></span>
                    <span className="text-[#666] text-[10px]">Comments: <span className="text-white font-semibold">{formatNumber(tweetData.comments)}</span></span>
                  </div>
                  {market.feedId && (
                    <a href={`https://x.com/i/status/${market.feedId}`} target="_blank" rel="noopener noreferrer" className="text-[#07b3ff] text-[10px] font-semibold hover:underline">View on X</a>
                  )}
                </div>
              </div>
            )}

            {/* Probability / Outcomes */}
            {isMulti && multiEventInfo ? (
              <div className="flex flex-col gap-3">
                {/* Probability bar — segmented pill blocks */}
                {(() => {
                  const OUTCOME_COLORS = ["#3fd145", "#07b3ff", "#ff6464", "#ffd600", "#c084fc", "#f97316", "#06b6d4", "#ec4899"];
                  const totalBlocks = 50;
                  const outcomesList = multiEventInfo.outcomes as any[];
                  // Calculate block counts — use floor for all, give remainder to largest
                  const rawCounts = outcomesList.map((o: any) => Math.floor((o.yesPrice * 100) / 100 * totalBlocks));
                  let assigned = rawCounts.reduce((a: number, b: number) => a + b, 0);
                  // Distribute remaining blocks to outcomes with highest fractional parts
                  const fractions = outcomesList.map((o: any, i: number) => ({
                    i,
                    frac: ((o.yesPrice * 100) / 100 * totalBlocks) - rawCounts[i],
                  }));
                  fractions.sort((a, b) => b.frac - a.frac);
                  let fi = 0;
                  while (assigned < totalBlocks && fi < fractions.length) {
                    rawCounts[fractions[fi].i]++;
                    assigned++;
                    fi++;
                  }
                  // Ensure no outcome with >0% gets 0 blocks
                  for (let i = 0; i < outcomesList.length; i++) {
                    if (rawCounts[i] === 0 && outcomesList[i].yesPrice > 0) {
                      rawCounts[i] = 1;
                      // Steal from the largest
                      const maxIdx = rawCounts.indexOf(Math.max(...rawCounts));
                      if (maxIdx !== i && rawCounts[maxIdx] > 1) rawCounts[maxIdx]--;
                    }
                  }
                  return (
                    <div className="flex flex-col gap-2">
                      <div className="text-[#838587] text-sm font-semibold font-satoshi">Percent Chance</div>
                      <div className="relative group">
                        <div className="self-stretch p-2.5 bg-[#111111] rounded-xl outline-1 outline-offset-[-1px] outline-[#313131] flex items-center gap-1 cursor-default">
                          <div className="flex-1 flex items-center gap-[3px] h-4">
                            {outcomesList.flatMap((o: any, i: number) =>
                              Array.from({ length: rawCounts[i] }).map((_, b) => {
                                const blockIdx = rawCounts.slice(0, i).reduce((a: number, c: number) => a + c, 0) + b;
                                return (
                                  <div
                                    key={`${i}-${b}`}
                                    className="flex-1 h-full rounded-[100px] animate-pulse"
                                    style={{ backgroundColor: OUTCOME_COLORS[i % OUTCOME_COLORS.length], animationDelay: `${blockIdx * 50}ms` }}
                                  />
                                );
                              })
                            )}
                          </div>
                        </div>
                        <div className="absolute left-0 right-0 top-full mt-2 p-3 bg-[#1a1a1a] border border-[#333] rounded-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-10 flex flex-wrap gap-x-4 gap-y-1.5">
                          {outcomesList.map((o: any, i: number) => (
                            <div key={i} className="flex items-center gap-1.5">
                              <div className="w-2.5 h-2.5 rounded-full" style={{ background: OUTCOME_COLORS[i % OUTCOME_COLORS.length] }} />
                              <span className="text-xs font-semibold font-satoshi" style={{ color: OUTCOME_COLORS[i % OUTCOME_COLORS.length] }}>
                                {o.name} {Math.round(o.yesPrice * 100)}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Clickable outcome selector */}
                <div className="text-[#838587] text-sm font-semibold font-satoshi">Outcomes</div>
                <div className="flex flex-col gap-2">
                  {multiEventInfo.outcomes.map((o: any, i: number) => (
                    <div
                      key={i}
                      onClick={() => setSelectedOutcomeIndex(i)}
                      className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all cursor-pointer ${
                        selectedOutcomeIndex === i
                          ? "bg-[#2a2a2a] border-[#444]"
                          : "bg-[#161616] border-[#262626] hover:border-[#3a3a3a]"
                      }`}
                    >
                      <span className="text-white text-base font-medium truncate flex-1 mr-3">{o.name}</span>
                      <span className={`text-base font-semibold ${selectedOutcomeIndex === i ? "text-white" : "text-white"}`}>
                        {Math.round(o.yesPrice * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
                {/* Multi-outcome on-chain info */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 bg-[#111111] rounded-xl">
                  <div className="flex flex-col">
                    <span className="text-[#838587] text-xs font-satoshi">Liquidity</span>
                    <span className="text-white text-sm font-semibold">{multiEventInfo.liquidity.toFixed(2)} HBAR</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[#838587] text-xs font-satoshi">Outcomes</span>
                    <span className="text-white text-sm font-semibold">{multiEventInfo.outcomeCount}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[#838587] text-xs font-satoshi">Status</span>
                    <span className="text-[#07b3ff] text-sm font-semibold capitalize">{multiEventInfo.status}</span>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-2">
                  <div className="text-[#838587] text-sm font-semibold font-satoshi">Market Probability</div>
                  <ProgressBar yesPercentage={yesPercent} />
                </div>

                {/* On-chain Info */}
                {onChainInfo && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-[#111111] rounded-xl">
                    <div className="flex flex-col">
                      <span className="text-[#838587] text-xs font-satoshi">Yes Price</span>
                      <span className="text-[#3fd145] text-lg font-semibold">{(onChainInfo.yesPrice * 100).toFixed(1)}¢</span>
                    </div>
                <div className="flex flex-col">
                  <span className="text-[#838587] text-xs font-satoshi">No Price</span>
                  <span className="text-[#ff6464] text-lg font-semibold">{(onChainInfo.noPrice * 100).toFixed(1)}¢</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[#838587] text-xs font-satoshi">Liquidity</span>
                  <span className="text-white text-sm font-semibold">{onChainInfo.liquidity.toFixed(2)} HBAR</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[#838587] text-xs font-satoshi">Status</span>
                  <span className="text-[#07b3ff] text-sm font-semibold capitalize">{onChainInfo.status}</span>
                </div>
              </div>
            )}
              </>
            )}

            {/* Price History Chart */}
            <PriceChart
              marketId={isMulti ? market.eventGroupId || market.market : market.market}
              createdAt={market.createdAt}
              multiOutcomeData={isMulti && multiEventInfo ? multiEventInfo.outcomes.map((o: any, i: number) => {
                const sibling = siblingMarkets.find(m => m.outcomeIndex === i);
                return { name: o.name, yesPrice: o.yesPrice, marketId: sibling?._id };
              }) : undefined}
              outcomeCount={isMulti && multiEventInfo ? multiEventInfo.outcomeCount : undefined}
            />

            {/* Description */}
            {market.description && (
              <CollapsibleDescription description={market.description} />
            )}
          </div>

          {/* Comments / Activity Tabs */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              {["Comments", "Activity", "HCS Audit Log"].map((tab) => (
                <div key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2.5 rounded-2xl cursor-pointer transition-all duration-300 ${activeTab === tab ? "bg-[#282828] shadow-[inset_0px_2px_0px_0px_rgba(53,53,53,1.00)] text-white" : "outline-1 outline-offset-[-1px] outline-[#313131] text-[#838587] hover:bg-[#333] hover:text-white"}`}>
                  {tab}
                </div>
              ))}
            </div>

            {activeTab === "Comments" && (
              <div className="bg-[#1e1e1e] rounded-2xl outline-1 outline-offset-[-1px] outline-[#313131] flex flex-col overflow-hidden">
                {/* Comment Input */}
                <div className="p-4 border-b border-[#2a2a2a]">
                  {isConnected ? (
                    <>
                      {replyingTo && (
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[#838587] text-xs font-satoshi">Replying to {elipsKey(marketComments.find(c => c._id === replyingTo)?.wallet || "")}</span>
                          <button onClick={() => setReplyingTo(null)} className="text-[#ff6464] text-xs font-satoshi cursor-pointer hover:underline">Cancel</button>
                        </div>
                      )}
                      <div className="flex gap-3 items-start">
                        <img src={address ? getAvatar(address) : DEFAULT_AVATAR} alt="" className="w-7 h-7 rounded-full border border-[#313131] flex-shrink-0 object-cover mt-0.5" />
                        <textarea
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          placeholder="Add a comment..."
                          rows={1}
                          className="flex-1 bg-[#111] rounded-lg px-3 py-2 text-white text-sm font-satoshi outline-1 outline-[#313131] placeholder:text-[#555] resize-none"
                        />
                        <button
                          onClick={() => postComment(replyingTo || undefined)}
                          disabled={commentLoading || !newComment.trim()}
                          className={`px-3 py-2 bg-[#07b3ff] rounded-lg text-[#111] text-xs font-semibold font-satoshi transition-all hover:bg-[#0697e5] ${commentLoading || !newComment.trim() ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                        >
                          {commentLoading ? "..." : replyingTo ? "Reply" : "Post"}
                        </button>
                      </div>
                    </>
                  ) : (
                    <span className="text-[#838587] text-sm font-satoshi text-center block py-1">Connect wallet to comment</span>
                  )}
                </div>

                {/* Comments List — scrollable */}
                <div className="flex flex-col max-h-[400px] overflow-y-auto">
                  {(() => {
                    const allComments = [...DUMMY_COMMENTS, ...marketComments];
                    const topLevel = allComments.filter(c => !c.parentId);
                    const replies = marketComments.filter(c => c.parentId);
                    return topLevel.map((c, idx) => {
                      const isDummy = "isDummy" in c;
                      const displayWallet = isDummy ? c.wallet : elipsKey(c.wallet);
                      const avatar = isDummy ? DEFAULT_AVATAR : getAvatar(c.wallet);
                      const childReplies = replies.filter(r => r.parentId === c._id);
                      return (
                        <div key={c._id}>
                          {idx > 0 && <div className="border-t border-[#2a2a2a]" />}
                          <div className="px-4 py-3 flex items-start gap-3 hover:bg-[#222] transition-colors">
                            <img src={avatar} alt="" className="w-7 h-7 rounded-full border border-[#313131] flex-shrink-0 object-cover mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-[#07b3ff] text-sm font-medium font-satoshi">{displayWallet}</span>
                                <span className="text-[#555] text-[11px] font-satoshi">{timeAgo(new Date(c.createdAt).getTime())}</span>
                              </div>
                              <p className="text-white text-sm font-satoshi leading-relaxed mt-0.5">{c.text}</p>
                              <button onClick={() => { setReplyingTo(c._id); }} className="text-[#666] text-[11px] font-satoshi cursor-pointer hover:text-white mt-1">Reply</button>
                            </div>
                          </div>
                          {/* Replies */}
                          {childReplies.map((r) => (
                            <div key={r._id} className="px-4 py-2 pl-14 flex items-start gap-3 hover:bg-[#222] transition-colors">
                              <img src={getAvatar(r.wallet)} alt="" className="w-5 h-5 rounded-full border border-[#313131] flex-shrink-0 object-cover mt-0.5" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-[#07b3ff] text-xs font-medium font-satoshi">{elipsKey(r.wallet)}</span>
                                  <span className="text-[#555] text-[10px] font-satoshi">{timeAgo(new Date(r.createdAt).getTime())}</span>
                                </div>
                                <p className="text-white text-xs font-satoshi leading-relaxed mt-0.5">{r.text}</p>
                                <button onClick={() => { setReplyingTo(c._id); }} className="text-[#666] text-[10px] font-satoshi cursor-pointer hover:text-white mt-0.5">Reply</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}

            {activeTab === "Activity" && (
              <div className="bg-[#1e1e1e] rounded-2xl outline-1 outline-offset-[-1px] outline-[#313131] flex flex-col overflow-hidden">
                {marketActivity.length === 0 ? (
                  <div className="p-4">
                    <span className="text-[#838587] text-sm font-satoshi">No recent activity yet.</span>
                  </div>
                ) : (
                  <div className="flex flex-col max-h-[320px] overflow-y-auto">
                    {marketActivity.map((a, idx) => (
                      <div key={a._id}>
                        {idx > 0 && <div className="border-t border-[#2a2a2a]" />}
                        <div className="px-4 py-3 flex items-center gap-3 hover:bg-[#222] transition-colors">
                          <img src={getAvatar(a.wallet)} alt="" className="w-7 h-7 rounded-full border border-[#313131] flex-shrink-0 object-cover" />
                          <span className="text-[#07b3ff] text-sm font-medium font-satoshi">{elipsKey(a.wallet)}</span>
                          <span className={`text-xs font-semibold font-satoshi ${a.action === "bet_yes" ? "text-[#3fd145]" : a.action === "bet_no" ? "text-[#ff6464]" : "text-[#07b3ff]"}`}>
                            {a.action === "bet_yes" ? "Bought Yes" : a.action === "bet_no" ? "Bought No" : "Funded"}
                          </span>
                          <span className="text-white text-xs font-semibold font-satoshi">{a.amount.toFixed(2)} HBAR</span>
                          <span className="text-[#555] text-[11px] font-satoshi ml-auto flex-shrink-0">{timeAgo(new Date(a.createdAt).getTime())}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "HCS Audit Log" && (
              <div className="bg-[#1e1e1e] rounded-2xl outline-1 outline-offset-[-1px] outline-[#313131] flex flex-col overflow-hidden">
                {!market?.hcsTopicId ? (
                  <div className="p-4">
                    <span className="text-[#838587] text-sm font-satoshi">No HCS topic for this market. Markets created before HCS integration don&apos;t have audit logs.</span>
                  </div>
                ) : hcsLoading ? (
                  <div className="p-6 flex items-center justify-center gap-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#07b3ff]" />
                    <span className="text-[#838587] text-sm font-satoshi">Loading audit log from Hedera Mirror Node...</span>
                  </div>
                ) : hcsMessages.length === 0 ? (
                  <div className="p-4">
                    <span className="text-[#838587] text-sm font-satoshi">No messages yet on this topic.</span>
                  </div>
                ) : (
                  <>
                    <div className="px-4 py-3 border-b border-[#2a2a2a] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[#3fd145] text-xs">●</span>
                        <span className="text-white text-sm font-semibold font-satoshi">Topic: {market.hcsTopicId}</span>
                      </div>
                      <a
                        href={`https://hashscan.io/testnet/topic/${market.hcsTopicId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#07b3ff] text-xs font-satoshi hover:underline"
                      >
                        View on HashScan ↗
                      </a>
                    </div>
                    <div className="flex flex-col max-h-[400px] overflow-y-auto">
                      {hcsMessages.map((msg, idx) => {
                        const color = "#9a9a9a";
                        const ts = msg.consensusTimestamp ? new Date(parseFloat(msg.consensusTimestamp) * 1000) : new Date(msg.timestamp);
                        return (
                          <div key={idx}>
                            {idx > 0 && <div className="border-t border-[#2a2a2a]" />}
                            <div className="px-4 py-3 hover:bg-[#222] transition-colors">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-semibold font-satoshi" style={{ color }}>
                                  {msg.type?.replace(/_/g, " ")}
                                </span>
                                <span className="text-[#555] text-[11px] font-satoshi ml-auto">#{msg.sequenceNumber} · {ts.toLocaleString()}</span>
                              </div>
                              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                                {msg.data && Object.entries(msg.data).map(([key, val]) => (
                                  <span key={key} className="text-[11px] font-satoshi">
                                    <span className="text-[#838587]">{key}: </span>
                                    <span className="text-white">{typeof val === "string" && val.startsWith("0x") ? elipsKey(val as string) : String(val)}</span>
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Trading Panel */}
        <div className="w-full lg:w-[400px] flex flex-col gap-6 lg:sticky lg:top-6 lg:self-start">
          {/* Buy / Sell — loading placeholder to prevent layout shift */}
          {!isMulti && !onChainInfo && !isExpired && (
            <div className="p-6 bg-[#1e1e1e] rounded-2xl outline-1 outline-offset-[-1px] outline-[#313131] flex flex-col gap-5 min-h-[300px] items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#07b3ff]" />
              <span className="text-[#838587] text-sm font-satoshi">Loading trading panel...</span>
            </div>
          )}
          {isMulti && !multiEventInfo && !isExpired && (
            <div className="p-6 bg-[#1e1e1e] rounded-2xl outline-1 outline-offset-[-1px] outline-[#313131] flex flex-col gap-5 min-h-[300px] items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#07b3ff]" />
              <span className="text-[#838587] text-sm font-satoshi">Loading trading panel...</span>
            </div>
          )}

          {/* Multi-Outcome Trading Panel */}
          {isMulti && multiEventInfo?.status === "active" && !isExpired && (
            <div className="p-6 bg-[#1e1e1e] rounded-2xl outline-1 outline-offset-[-1px] outline-[#313131] flex flex-col gap-5">
              {/* Buy / Sell tabs */}
              <div className="flex gap-2">
                <button onClick={() => setMultiTradeMode("buy")} className={`flex-1 py-2.5 rounded-xl text-lg font-semibold transition-all ${multiTradeMode === "buy" ? "bg-[#07b3ff] text-[#111]" : "bg-[#111] text-[#838587] hover:text-white"}`}>Buy</button>
                <button onClick={() => setMultiTradeMode("sell")} className={`flex-1 py-2.5 rounded-xl text-lg font-semibold transition-all ${multiTradeMode === "sell" ? "bg-[#07b3ff] text-[#111]" : "bg-[#111] text-[#838587] hover:text-white"}`}>Sell</button>
              </div>
              {/* Outcome selector */}
              <div className="flex flex-col gap-2">
                <span className="text-[#838587] text-sm font-satoshi">Select Outcome</span>
                <div className="flex flex-col gap-1.5">
                  {multiEventInfo.outcomes.map((o: any, i: number) => (
                    <button
                      key={i}
                      onClick={() => setSelectedOutcomeIndex(i)}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        selectedOutcomeIndex === i
                          ? "bg-[#2a2a2a] border border-[#444] text-white"
                          : "bg-[#111] border border-[#2a2a2a] text-[#838587] hover:text-white hover:border-[#3a3a3a]"
                      }`}
                    >
                      <span className="truncate">{o.name}</span>
                      <span className={selectedOutcomeIndex === i ? "text-white font-semibold" : ""}>{Math.round(o.yesPrice * 100)}%</span>
                    </button>
                  ))}
                </div>
              </div>

              {multiTradeMode === "buy" ? (
                <>
                  {/* Token amount */}
                  <div className="flex flex-col gap-2">
                    <span className="text-[#838587] text-sm font-satoshi">Number of Tokens</span>
                    <div className="p-2 bg-[#111111] rounded-xl shadow-[inset_0px_2px_0px_0px_rgba(0,0,0,0.20)] outline-1 outline-offset-[-1px] outline-[#313131] flex items-center gap-3 select-none">
                      <div onClick={() => setBetAmount((p) => Math.max(1, p - 1))} className={`p-3 bg-[#1e1e1e] rounded-xl flex items-center justify-center cursor-pointer transition-all ${betAmount > 1 ? "hover:bg-[#2e2e2e]" : "opacity-50 cursor-not-allowed"}`}><FaMinus className="text-white" /></div>
                      <div className="flex-1 flex justify-center">
                        <input type="number" min={1} value={betAmount} onChange={(e) => { const v = parseInt(e.target.value); setBetAmount(isNaN(v) || v < 1 ? 1 : v); }} className="w-full text-center text-[#838587] text-xl font-medium font-satoshi bg-transparent outline-none" />
                      </div>
                      <div onClick={() => setBetAmount((p) => p + 1)} className="p-3 bg-[#1e1e1e] rounded-xl flex items-center justify-center cursor-pointer hover:bg-[#2e2e2e]"><FaPlus className="text-white" /></div>
                    </div>
                  </div>
                  {/* Buy Yes / No */}
                  <div className="flex flex-col gap-3">
                    <button onClick={() => onBuy(true)} disabled={isBetting} className={`w-full px-4 py-3 bg-[#223a25] outline outline-[#3fd145] rounded-2xl flex justify-center items-center cursor-pointer transition-all hover:bg-[#2a4a2e] ${isBetting && bettingSide === true ? "opacity-50 cursor-not-allowed" : isBetting ? "opacity-30 cursor-not-allowed" : ""}`}>
                      <span className="text-[#3fd145] text-lg font-bold font-satoshi">{isBetting && bettingSide === true ? "Buying..." : `Buy Yes — ${multiEventInfo.outcomes[selectedOutcomeIndex]?.name}`}</span>
                    </button>
                    <button onClick={() => onBuy(false)} disabled={isBetting} className={`w-full px-4 py-3 bg-[#3a2222] outline outline-[#ff6464] rounded-2xl flex justify-center items-center cursor-pointer transition-all hover:bg-[#4a2a2a] ${isBetting && bettingSide === false ? "opacity-50 cursor-not-allowed" : isBetting ? "opacity-30 cursor-not-allowed" : ""}`}>
                      <span className="text-[#ff6464] text-lg font-bold font-satoshi">{isBetting && bettingSide === false ? "Buying..." : `Buy No — ${multiEventInfo.outcomes[selectedOutcomeIndex]?.name}`}</span>
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* Sell side selector */}
                  <div className="flex gap-2">
                    <button onClick={() => setMultiSellSide(true)} className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${multiSellSide ? "bg-[#223a25] text-[#3fd145] outline outline-[#3fd145]" : "bg-[#111] text-[#838587]"}`}>
                      Sell Yes ({multiUserTokens.yesTokens})
                    </button>
                    <button onClick={() => setMultiSellSide(false)} className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${!multiSellSide ? "bg-[#3a2222] text-[#ff6464] outline outline-[#ff6464]" : "bg-[#111] text-[#838587]"}`}>
                      Sell No ({multiUserTokens.noTokens})
                    </button>
                  </div>
                  <div className="flex flex-col gap-2">
                    <span className="text-[#838587] text-sm font-satoshi">Tokens to Sell</span>
                    <div className="p-2 bg-[#111111] rounded-xl shadow-[inset_0px_2px_0px_0px_rgba(0,0,0,0.20)] outline-1 outline-offset-[-1px] outline-[#313131] flex items-center gap-3 select-none">
                      <div onClick={() => setSellAmount((p) => Math.max(1, p - 1))} className={`p-3 bg-[#1e1e1e] rounded-xl flex items-center justify-center cursor-pointer transition-all ${sellAmount > 1 ? "hover:bg-[#2e2e2e]" : "opacity-50 cursor-not-allowed"}`}><FaMinus className="text-white" /></div>
                      <div className="flex-1 flex justify-center">
                        <input type="number" min={1} value={sellAmount} onChange={(e) => { const v = parseInt(e.target.value); setSellAmount(isNaN(v) || v < 1 ? 1 : v); }} className="w-full text-center text-[#838587] text-xl font-medium font-satoshi bg-transparent outline-none" />
                      </div>
                      <div onClick={() => setSellAmount((p) => p + 1)} className="p-3 bg-[#1e1e1e] rounded-xl flex items-center justify-center cursor-pointer hover:bg-[#2e2e2e]"><FaPlus className="text-white" /></div>
                    </div>
                    <button onClick={() => setSellAmount(multiSellSide ? multiUserTokens.yesTokens : multiUserTokens.noTokens)} className="text-[#07b3ff] text-xs font-satoshi text-right cursor-pointer hover:underline">Max</button>
                  </div>
                  <button onClick={onMultiSell} disabled={isSelling} className={`w-full px-4 py-3 bg-[#3a2222] outline outline-[#ff6464] rounded-2xl flex justify-center items-center cursor-pointer transition-all hover:bg-[#4a2a2a] ${isSelling ? "opacity-50 cursor-not-allowed" : ""}`}>
                    <span className="text-[#ff6464] text-lg font-bold font-satoshi">{isSelling ? "Selling..." : `Sell ${sellAmount} ${multiSellSide ? "Yes" : "No"} — ${multiEventInfo.outcomes[selectedOutcomeIndex]?.name}`}</span>
                  </button>
                </>
              )}

              {/* Selected outcome info */}
              <div className="flex flex-col gap-2 pt-2 border-t border-[#313131]">
                <div className="flex justify-between">
                  <span className="text-[#838587] text-sm font-satoshi">Yes Price</span>
                  <span className="text-[#3fd145] text-sm font-semibold font-satoshi">{(multiEventInfo.outcomes[selectedOutcomeIndex]?.yesPrice * 100).toFixed(1)}¢</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#838587] text-sm font-satoshi">No Price</span>
                  <span className="text-[#ff6464] text-sm font-semibold font-satoshi">{(multiEventInfo.outcomes[selectedOutcomeIndex]?.noPrice * 100).toFixed(1)}¢</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#838587] text-sm font-satoshi">Liquidity</span>
                  <span className="text-white text-sm font-satoshi">{multiEventInfo.liquidity.toFixed(2)} HBAR</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#838587] text-sm font-satoshi">Expires</span>
                  <span className="text-white text-sm font-satoshi">{counter}</span>
                </div>
              </div>
            </div>
          )}

          {/* Buy / Sell Toggle + Panel — only show when market is active and not expired */}
          {!isMulti && onChainInfo?.status === "active" && !isExpired && (
          <div className="p-6 bg-[#1e1e1e] rounded-2xl outline-1 outline-offset-[-1px] outline-[#313131] flex flex-col gap-5">
            {/* Buy / Sell tabs */}
            <div className="flex gap-2">
              <button onClick={() => setTradeMode("buy")} className={`flex-1 py-2.5 rounded-xl text-lg font-semibold transition-all ${tradeMode === "buy" ? "bg-[#07b3ff] text-[#111]" : "bg-[#111] text-[#838587] hover:text-white"}`}>Buy</button>
              <button onClick={() => setTradeMode("sell")} className={`flex-1 py-2.5 rounded-xl text-lg font-semibold transition-all ${tradeMode === "sell" ? "bg-[#07b3ff] text-[#111]" : "bg-[#111] text-[#838587] hover:text-white"}`}>Sell</button>
            </div>

            {tradeMode === "buy" ? (
              <>
                <div className="flex flex-col gap-2">
                  <span className="text-[#838587] text-sm font-satoshi">Number of Tokens</span>
                  <div className="p-2 bg-[#111111] rounded-xl shadow-[inset_0px_2px_0px_0px_rgba(0,0,0,0.20)] outline-1 outline-offset-[-1px] outline-[#313131] flex items-center gap-3 select-none">
                    <div onClick={() => setBetAmount((p) => Math.max(1, p - 1))} className={`p-3 bg-[#1e1e1e] rounded-xl flex items-center justify-center cursor-pointer transition-all ${betAmount > 1 ? "hover:bg-[#2e2e2e]" : "opacity-50 cursor-not-allowed"}`}><FaMinus className="text-white" /></div>
                    <div className="flex-1 flex justify-center">
                      <input type="number" min={1} value={betAmount} onChange={(e) => { const v = parseInt(e.target.value); setBetAmount(isNaN(v) || v < 1 ? 1 : v); }} className="w-full text-center text-[#838587] text-xl font-medium font-satoshi bg-transparent outline-none" />
                    </div>
                    <div onClick={() => setBetAmount((p) => p + 1)} className="p-3 bg-[#1e1e1e] rounded-xl flex items-center justify-center cursor-pointer hover:bg-[#2e2e2e]"><FaPlus className="text-white" /></div>
                  </div>
                </div>
                {costEstimate && (
                  <div className="flex flex-col gap-1 p-3 bg-[#111111] rounded-xl">
                    <div className="flex justify-between"><span className="text-[#838587] text-sm font-satoshi">Est. Cost</span><span className="text-white text-sm font-semibold font-satoshi">{costEstimate.cost.toFixed(4)} HBAR</span></div>
                    <div className="flex justify-between"><span className="text-[#838587] text-sm font-satoshi">Fee (2.5%)</span><span className="text-[#838587] text-sm font-satoshi">{costEstimate.fee.toFixed(4)} HBAR</span></div>
                    <div className="border-t border-[#313131] mt-1 pt-1 flex justify-between"><span className="text-[#838587] text-sm font-semibold font-satoshi">Total</span><span className="text-white text-sm font-semibold font-satoshi">{costEstimate.total.toFixed(4)} HBAR</span></div>
                  </div>
                )}
                <div className="flex flex-col gap-3">
                  <button onClick={() => onBuy(true)} disabled={isBetting} className={`w-full px-4 py-3 bg-[#223a25] outline outline-[#3fd145] rounded-2xl flex justify-center items-center cursor-pointer transition-all hover:bg-[#2a4a2e] ${isBetting && bettingSide === true ? "opacity-50 cursor-not-allowed" : isBetting ? "opacity-30 cursor-not-allowed" : ""}`}>
                    <span className="text-[#3fd145] text-lg font-bold font-satoshi">{isBetting && bettingSide === true ? "Buying..." : `Buy Yes — ${betAmount} token${betAmount > 1 ? "s" : ""}`}</span>
                  </button>
                  <button onClick={() => onBuy(false)} disabled={isBetting} className={`w-full px-4 py-3 bg-[#3a2222] outline outline-[#ff6464] rounded-2xl flex justify-center items-center cursor-pointer transition-all hover:bg-[#4a2a2a] ${isBetting && bettingSide === false ? "opacity-50 cursor-not-allowed" : isBetting ? "opacity-30 cursor-not-allowed" : ""}`}>
                    <span className="text-[#ff6464] text-lg font-bold font-satoshi">{isBetting && bettingSide === false ? "Buying..." : `Buy No — ${betAmount} token${betAmount > 1 ? "s" : ""}`}</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Sell side selector */}
                <div className="flex gap-2">
                  <button onClick={() => setSellSide(true)} className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${sellSide ? "bg-[#223a25] text-[#3fd145] outline outline-[#3fd145]" : "bg-[#111] text-[#838587]"}`}>
                    Sell Yes ({userTokens.yesTokens})
                  </button>
                  <button onClick={() => setSellSide(false)} className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${!sellSide ? "bg-[#3a2222] text-[#ff6464] outline outline-[#ff6464]" : "bg-[#111] text-[#838587]"}`}>
                    Sell No ({userTokens.noTokens})
                  </button>
                </div>
                <div className="flex flex-col gap-2">
                  <span className="text-[#838587] text-sm font-satoshi">Tokens to Sell</span>
                  <div className="p-2 bg-[#111111] rounded-xl shadow-[inset_0px_2px_0px_0px_rgba(0,0,0,0.20)] outline-1 outline-offset-[-1px] outline-[#313131] flex items-center gap-3 select-none">
                    <div onClick={() => setSellAmount((p) => Math.max(1, p - 1))} className={`p-3 bg-[#1e1e1e] rounded-xl flex items-center justify-center cursor-pointer transition-all ${sellAmount > 1 ? "hover:bg-[#2e2e2e]" : "opacity-50 cursor-not-allowed"}`}><FaMinus className="text-white" /></div>
                    <div className="flex-1 flex justify-center">
                      <input type="number" min={1} value={sellAmount} onChange={(e) => { const v = parseInt(e.target.value); setSellAmount(isNaN(v) || v < 1 ? 1 : v); }} className="w-full text-center text-[#838587] text-xl font-medium font-satoshi bg-transparent outline-none" />
                    </div>
                    <div onClick={() => setSellAmount((p) => p + 1)} className="p-3 bg-[#1e1e1e] rounded-xl flex items-center justify-center cursor-pointer hover:bg-[#2e2e2e]"><FaPlus className="text-white" /></div>
                  </div>
                  <button onClick={() => setSellAmount(sellSide ? userTokens.yesTokens : userTokens.noTokens)} className="text-[#07b3ff] text-xs font-satoshi text-right cursor-pointer hover:underline">Max</button>
                </div>
                {sellEstimate && (
                  <div className="flex flex-col gap-1 p-3 bg-[#111111] rounded-xl">
                    <div className="flex justify-between"><span className="text-[#838587] text-sm font-satoshi">Refund</span><span className="text-white text-sm font-semibold font-satoshi">{sellEstimate.refund.toFixed(4)} HBAR</span></div>
                    <div className="flex justify-between"><span className="text-[#838587] text-sm font-satoshi">Fee</span><span className="text-[#838587] text-sm font-satoshi">{sellEstimate.fee.toFixed(4)} HBAR</span></div>
                    <div className="border-t border-[#313131] mt-1 pt-1 flex justify-between"><span className="text-[#838587] text-sm font-semibold font-satoshi">You Receive</span><span className="text-[#3fd145] text-sm font-semibold font-satoshi">{sellEstimate.net.toFixed(4)} HBAR</span></div>
                  </div>
                )}
                <button onClick={onSell} disabled={isSelling} className={`w-full px-4 py-3 bg-[#3a2222] outline outline-[#ff6464] rounded-2xl flex justify-center items-center cursor-pointer transition-all hover:bg-[#4a2a2a] ${isSelling ? "opacity-50 cursor-not-allowed" : ""}`}>
                  <span className="text-[#ff6464] text-lg font-bold font-satoshi">{isSelling ? "Selling..." : `Sell ${sellAmount} ${sellSide ? "Yes" : "No"} token${sellAmount > 1 ? "s" : ""}`}</span>
                </button>
              </>
            )}

            {/* Market Info Summary */}
            <div className="flex flex-col gap-2 pt-2 border-t border-[#313131]">
              <div className="flex justify-between">
                <span className="text-[#838587] text-sm font-satoshi">Yes Price</span>
                <span className="text-[#3fd145] text-sm font-semibold font-satoshi">{onChainInfo ? `${(onChainInfo.yesPrice * 100).toFixed(1)}¢` : "50¢"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#838587] text-sm font-satoshi">No Price</span>
                <span className="text-[#ff6464] text-sm font-semibold font-satoshi">{onChainInfo ? `${(onChainInfo.noPrice * 100).toFixed(1)}¢` : "50¢"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#838587] text-sm font-satoshi">Liquidity</span>
                <span className="text-white text-sm font-satoshi">{onChainInfo ? `${onChainInfo.liquidity.toFixed(2)} HBAR` : "..."}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#838587] text-sm font-satoshi">Expires</span>
                <span className="text-white text-sm font-satoshi">{counter}</span>
              </div>
            </div>
          </div>
          )}

          {/* Your Position — single market only */}
          {!isMulti && (
          <div className="bg-[#1e1e1e] rounded-2xl outline-1 outline-offset-[-1px] outline-[#313131] flex flex-col overflow-hidden">
            <div onClick={() => setPositionOpen(!positionOpen)} className="flex justify-between items-center p-5 cursor-pointer hover:bg-[#252525] transition-colors">
              <h3 className="text-white text-lg font-medium font-rubik">Your Position</h3>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#838587" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-200 ${positionOpen ? "rotate-180" : ""}`}><polyline points="6 9 12 15 18 9"/></svg>
            </div>
            {positionOpen && (
            <div className="px-5 pb-5 flex flex-col gap-3">
              {userTokens.yesTokens > 0 && (
                <div className="flex justify-between items-center p-3 rounded-xl bg-[#111]">
                  <div className="flex flex-col">
                    <span className="text-[#3fd145] text-sm font-semibold font-satoshi">Yes Tokens</span>
                    <span className="text-white text-lg font-semibold font-satoshi">{userTokens.yesTokens}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    {onChainInfo?.status === "finished" ? (
                      onChainInfo.result ? (
                        <>
                          <span className="text-[#3fd145] text-xs font-semibold font-satoshi">✓ Won</span>
                          <span className="text-[#3fd145] text-sm font-semibold font-satoshi">{userTokens.yesTokens.toFixed(2)} HBAR</span>
                        </>
                      ) : (
                        <span className="text-[#ff6464] text-xs font-semibold font-satoshi">✗ Lost</span>
                      )
                    ) : (
                      <>
                        <span className="text-[#838587] text-xs font-satoshi">Payout if Yes</span>
                        <span className="text-[#3fd145] text-sm font-semibold font-satoshi">{userTokens.yesTokens.toFixed(2)} HBAR</span>
                      </>
                    )}
                  </div>
                </div>
              )}
              {userTokens.noTokens > 0 && (
                <div className="flex justify-between items-center p-3 rounded-xl bg-[#111]">
                  <div className="flex flex-col">
                    <span className="text-[#ff6464] text-sm font-semibold font-satoshi">No Tokens</span>
                    <span className="text-white text-lg font-semibold font-satoshi">{userTokens.noTokens}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    {onChainInfo?.status === "finished" ? (
                      !onChainInfo.result ? (
                        <>
                          <span className="text-[#3fd145] text-xs font-semibold font-satoshi">✓ Won</span>
                          <span className="text-[#3fd145] text-sm font-semibold font-satoshi">{userTokens.noTokens.toFixed(2)} HBAR</span>
                        </>
                      ) : (
                        <span className="text-[#ff6464] text-xs font-semibold font-satoshi">✗ Lost</span>
                      )
                    ) : (
                      <>
                        <span className="text-[#838587] text-xs font-satoshi">Payout if No</span>
                        <span className="text-[#ff6464] text-sm font-semibold font-satoshi">{userTokens.noTokens.toFixed(2)} HBAR</span>
                      </>
                    )}
                  </div>
                </div>
              )}
              {onChainInfo?.status === "finished" && !winningsClaimed && (
                (onChainInfo.result ? userTokens.yesTokens : userTokens.noTokens) > 0 ? (
                  <button onClick={onClaimWinnings} className="w-full px-4 py-3 bg-[#07b3ff] rounded-2xl text-[#111] text-lg font-bold font-satoshi hover:bg-[#0697e5] transition-all">
                    Claim Winnings
                  </button>
                ) : (
                  <div className="px-3 py-2 bg-[#3a2222]/50 rounded-xl text-center">
                    <span className="text-[#ff6464] text-sm font-semibold font-satoshi">✗ {onChainInfo.result ? "No" : "Yes"} lost — no winnings to claim</span>
                  </div>
                )
              )}
              {onChainInfo?.status === "finished" && winningsClaimed && (
                <div className="px-3 py-2 bg-[#223a25]/50 rounded-xl text-center">
                  <span className="text-[#3fd145] text-sm font-semibold font-satoshi">✓ Winnings Claimed</span>
                </div>
              )}
            </div>
            )}
          </div>
          )}

          {/* Your LP Position */}
          {isConnected && lpInfo.shares > 0 && (
            <div className="bg-[#1e1e1e] rounded-2xl outline-1 outline-offset-[-1px] outline-[#313131] flex flex-col overflow-hidden">
              <div onClick={() => setLpOpen(!lpOpen)} className="flex justify-between items-center p-5 cursor-pointer hover:bg-[#252525] transition-colors">
                <h3 className="text-white text-lg font-medium font-rubik">Your LP Position</h3>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#838587" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-200 ${lpOpen ? "rotate-180" : ""}`}><polyline points="6 9 12 15 18 9"/></svg>
              </div>
              {lpOpen && (
              <div className="px-5 pb-5 flex flex-col gap-3">
              <div className="flex flex-col gap-2 p-3 bg-[#111111] rounded-xl">
                <div className="flex justify-between">
                  <span className="text-[#838587] text-sm font-satoshi">LP Shares</span>
                  <span className="text-white text-sm font-semibold font-satoshi">{lpInfo.shares.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#838587] text-sm font-satoshi">Pool Share</span>
                  <span className="text-[#07b3ff] text-sm font-semibold font-satoshi">{lpInfo.totalShares > 0 ? ((lpInfo.shares / lpInfo.totalShares) * 100).toFixed(2) : "0"}%</span>
                </div>
                {onChainInfo && (
                  <div className="flex justify-between">
                    <span className="text-[#838587] text-sm font-satoshi">Fees Accumulated</span>
                    <span className="text-[#3fd145] text-sm font-semibold font-satoshi">{Number(onChainInfo.accumulatedFees).toFixed(4)} HBAR</span>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  {!lpInfo.claimed && (
                    <>
                      <button onClick={onChainInfo?.status !== "finished" ? onRemoveLP : undefined} className={`flex-1 px-3 py-2 bg-[#3a2222] outline outline-[#ff6464] rounded-xl text-[#ff6464] text-sm font-semibold transition-all ${onChainInfo?.status === "finished" ? "opacity-30 cursor-not-allowed" : "hover:bg-[#4a2a2a] cursor-pointer"}`} disabled={onChainInfo?.status === "finished"}>Remove LP</button>
                      <div className="relative flex-1 group">
                        <button onClick={onChainInfo?.status === "finished" ? onClaimLP : undefined} className={`w-full px-3 py-2 bg-[#223a25] outline outline-[#3fd145] rounded-xl text-[#3fd145] text-sm font-semibold flex items-center justify-center gap-1.5 transition-all ${onChainInfo?.status !== "finished" ? "opacity-30 cursor-not-allowed" : "hover:bg-[#2a4a2e] cursor-pointer"}`} disabled={onChainInfo?.status !== "finished"}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                          Claim LP + Fees
                        </button>
                        {onChainInfo?.status !== "finished" && (
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-[#111] border border-[#313131] rounded-lg text-xs text-[#838587] w-[200px] text-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                            Available after market resolves. Collects your LP deposit + earned trading fees.
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
              {/* Add More Liquidity — only when market is active */}
              {onChainInfo?.status === "active" && (
                <div className="flex flex-col gap-2 pt-3 border-t border-[#313131]">
                  <span className="text-[#838587] text-sm font-satoshi">Add More Liquidity</span>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={0.1}
                      step={0.1}
                      value={lpAmount}
                      onChange={(e) => setLpAmount(e.target.value)}
                      placeholder="HBAR amount"
                      className="flex-1 px-3 py-2 bg-[#111] rounded-xl text-white text-sm font-satoshi outline-1 outline-[#313131] placeholder:text-[#555]"
                    />
                    <button
                      onClick={onAddLP}
                      disabled={isAddingLP}
                      className={`px-4 py-2 bg-[#07b3ff] rounded-xl text-[#111] text-sm font-semibold font-satoshi transition-all hover:bg-[#0697e5] ${isAddingLP ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                    >
                      {isAddingLP ? "Adding..." : "Add LP"}
                    </button>
                  </div>
                </div>
              )}
              </div>
              )}
            </div>
          )}

          {/* Provide Liquidity — shown when user has no LP and market is active and not expired */}
          {isConnected && lpInfo.shares === 0 && onChainInfo?.status === "active" && !isExpired && (
            <div className="p-5 bg-[#1e1e1e] rounded-2xl outline-1 outline-offset-[-1px] outline-[#313131] flex flex-col gap-3">
              <h3 className="text-white text-lg font-medium font-rubik">Provide Liquidity</h3>
              <p className="text-[#838587] text-sm font-satoshi">Earn fees from trades on this market by providing liquidity.</p>
              <div className="flex gap-2">
                <input type="number" min={0.1} step={0.1} value={lpAmount} onChange={(e) => setLpAmount(e.target.value)} placeholder="HBAR amount" className="flex-1 px-3 py-2.5 bg-[#111] rounded-xl text-white text-sm font-satoshi outline-1 outline-[#313131] placeholder:text-[#555]" />
                <button onClick={onAddLP} disabled={isAddingLP} className={`px-5 py-2.5 bg-[#07b3ff] rounded-xl text-[#111] text-sm font-semibold font-satoshi transition-all hover:bg-[#0697e5] ${isAddingLP ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
                  {isAddingLP ? "Adding..." : "Add Liquidity"}
                </button>
              </div>
            </div>
          )}

          {/* Multi-Outcome: Your Position — all outcomes in one panel */}
          {isMulti && isConnected && multiAllPositions.some(p => p.yesTokens > 0 || p.noTokens > 0) && (
            <div className="bg-[#1e1e1e] rounded-2xl outline-1 outline-offset-[-1px] outline-[#313131] flex flex-col overflow-hidden">
              <div onClick={() => setPositionOpen(!positionOpen)} className="flex justify-between items-center p-5 cursor-pointer hover:bg-[#252525] transition-colors">
                <h3 className="text-white text-lg font-medium font-rubik">Your Position</h3>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#838587" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-200 ${positionOpen ? "rotate-180" : ""}`}><polyline points="6 9 12 15 18 9"/></svg>
              </div>
              {positionOpen && (
              <div className="px-5 pb-5 flex flex-col gap-3">
                {multiAllPositions.map((pos, i) => {
                  if (pos.yesTokens === 0 && pos.noTokens === 0) return null;
                  const isFinished = multiEventInfo?.status === "finished";
                  const isWinner = isFinished && multiEventInfo?.winningOutcome === i;
                  const isLoser = isFinished && multiEventInfo?.winningOutcome >= 0 && multiEventInfo?.winningOutcome !== i;
                  return (
                    <div key={i} className={`flex flex-col gap-2 p-3 rounded-xl ${isWinner ? "bg-[#1a2e1a] outline outline-[#3fd145]/30" : isLoser ? "bg-[#111] opacity-50" : "bg-[#111]"}`}>
                      <div className="flex justify-between items-center">
                        <span className="text-[#838587] text-xs font-semibold font-satoshi uppercase tracking-wider">{pos.name}</span>
                        {isWinner && <span className="text-[#3fd145] text-[10px] font-bold font-satoshi">✓ WINNER</span>}
                        {isLoser && <span className="text-[#ff6464] text-[10px] font-bold font-satoshi">✗ LOST</span>}
                      </div>
                      {pos.yesTokens > 0 && (
                        <div className="flex justify-between items-center">
                          <span className={`${isLoser ? "text-[#666]" : "text-[#3fd145]"} text-sm font-semibold font-satoshi`}>Yes × {pos.yesTokens}</span>
                          <span className={`${isLoser ? "text-[#666] line-through" : "text-[#3fd145]"} text-sm font-semibold font-satoshi`}>{pos.yesTokens.toFixed(2)} HBAR</span>
                        </div>
                      )}
                      {pos.noTokens > 0 && (
                        <div className="flex justify-between items-center">
                          <span className={`${isLoser ? "text-[#666]" : "text-[#ff6464]"} text-sm font-semibold font-satoshi`}>No × {pos.noTokens}</span>
                          <span className={`${isLoser ? "text-[#666] line-through" : "text-[#ff6464]"} text-sm font-semibold font-satoshi`}>{pos.noTokens.toFixed(2)} HBAR</span>
                        </div>
                      )}
                    </div>
                  );
                })}
                {multiEventInfo?.status === "finished" && !multiWinningsClaimed && (
                  multiEventInfo.winningOutcome >= 0 && multiAllPositions[multiEventInfo.winningOutcome]?.yesTokens > 0 ? (
                    <button onClick={onMultiClaimWinnings} className="w-full px-4 py-3 bg-[#07b3ff] rounded-2xl text-[#111] text-lg font-bold font-satoshi hover:bg-[#0697e5] transition-all cursor-pointer">
                      Claim Winnings
                    </button>
                  ) : (
                    <div className="px-3 py-2 bg-[#3a2222]/50 rounded-xl text-center">
                      <span className="text-[#ff6464] text-sm font-semibold font-satoshi">✗ No winning tokens to claim</span>
                    </div>
                  )
                )}
                {multiEventInfo?.status === "finished" && multiWinningsClaimed && (
                  <div className="px-3 py-2 bg-[#223a25]/50 rounded-xl text-center">
                    <span className="text-[#3fd145] text-sm font-semibold font-satoshi">✓ Winnings Claimed</span>
                  </div>
                )}
              </div>
              )}
            </div>
          )}

          {/* Multi-Outcome: Your LP Position */}
          {isMulti && isConnected && multiLpInfo.shares > 0 && (
            <div className="bg-[#1e1e1e] rounded-2xl outline-1 outline-offset-[-1px] outline-[#313131] flex flex-col overflow-hidden">
              <div onClick={() => setLpOpen(!lpOpen)} className="flex justify-between items-center p-5 cursor-pointer hover:bg-[#252525] transition-colors">
                <h3 className="text-white text-lg font-medium font-rubik">Your LP Position</h3>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#838587" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-200 ${lpOpen ? "rotate-180" : ""}`}><polyline points="6 9 12 15 18 9"/></svg>
              </div>
              {lpOpen && (
              <div className="px-5 pb-5 flex flex-col gap-3">
                <div className="flex flex-col gap-2 p-3 bg-[#111111] rounded-xl">
                  <div className="flex justify-between">
                    <span className="text-[#838587] text-sm font-satoshi">LP Shares</span>
                    <span className="text-white text-sm font-semibold font-satoshi">{multiLpInfo.shares.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#838587] text-sm font-satoshi">Pool Share</span>
                    <span className="text-[#07b3ff] text-sm font-semibold font-satoshi">{multiLpInfo.totalShares > 0 ? ((multiLpInfo.shares / multiLpInfo.totalShares) * 100).toFixed(2) : "0"}%</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {!multiLpInfo.claimed && (
                    <>
                      <button onClick={multiEventInfo?.status !== "finished" ? onMultiRemoveLP : undefined} className={`flex-1 px-3 py-2 bg-[#3a2222] outline outline-[#ff6464] rounded-xl text-[#ff6464] text-sm font-semibold transition-all ${multiEventInfo?.status === "finished" ? "opacity-30 cursor-not-allowed" : "hover:bg-[#4a2a2a] cursor-pointer"}`} disabled={multiEventInfo?.status === "finished"}>Remove LP</button>
                      <div className="relative flex-1 group">
                        <button onClick={multiEventInfo?.status === "finished" ? onMultiClaimLP : undefined} className={`w-full px-3 py-2 bg-[#223a25] outline outline-[#3fd145] rounded-xl text-[#3fd145] text-sm font-semibold flex items-center justify-center gap-1.5 transition-all ${multiEventInfo?.status !== "finished" ? "opacity-30 cursor-not-allowed" : "hover:bg-[#2a4a2e] cursor-pointer"}`} disabled={multiEventInfo?.status !== "finished"}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                          Claim LP + Fees
                        </button>
                        {multiEventInfo?.status !== "finished" && (
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-[#111] border border-[#313131] rounded-lg text-xs text-[#838587] w-[200px] text-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                            Available after market resolves. Collects your LP deposit + earned trading fees.
                          </div>
                        )}
                      </div>
                    </>
                  )}
                  {multiLpInfo.claimed && (
                    <div className="px-3 py-2 bg-[#223a25]/50 rounded-xl text-center w-full">
                      <span className="text-[#3fd145] text-sm font-semibold font-satoshi">✓ LP Rewards Claimed</span>
                    </div>
                  )}
                </div>
                {/* Add More Liquidity — only when market is active */}
                {multiEventInfo?.status === "active" && (
                  <div className="flex flex-col gap-2 pt-3 border-t border-[#313131]">
                    <span className="text-[#838587] text-sm font-satoshi">Add More Liquidity</span>
                    <div className="flex gap-2">
                      <input type="number" min={0.1} step={0.1} value={multiLpAmount} onChange={(e) => setMultiLpAmount(e.target.value)} placeholder="HBAR amount" className="flex-1 px-3 py-2 bg-[#111] rounded-xl text-white text-sm font-satoshi outline-1 outline-[#313131] placeholder:text-[#555]" />
                      <button onClick={onMultiAddLP} disabled={isMultiAddingLP} className={`px-4 py-2 bg-[#07b3ff] rounded-xl text-[#111] text-sm font-semibold font-satoshi transition-all hover:bg-[#0697e5] ${isMultiAddingLP ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
                        {isMultiAddingLP ? "Adding..." : "Add LP"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
              )}
            </div>
          )}

          {/* Multi-Outcome: Provide Liquidity — shown when user has no LP and market is active */}
          {isMulti && isConnected && multiLpInfo.shares === 0 && multiEventInfo?.status === "active" && !isExpired && (
            <div className="p-5 bg-[#1e1e1e] rounded-2xl outline-1 outline-offset-[-1px] outline-[#313131] flex flex-col gap-3">
              <h3 className="text-white text-lg font-medium font-rubik">Provide Liquidity</h3>
              <p className="text-[#838587] text-sm font-satoshi">Earn fees from trades on this market by providing liquidity.</p>
              <div className="flex gap-2">
                <input type="number" min={0.1} step={0.1} value={multiLpAmount} onChange={(e) => setMultiLpAmount(e.target.value)} placeholder="HBAR amount" className="flex-1 px-3 py-2.5 bg-[#111] rounded-xl text-white text-sm font-satoshi outline-1 outline-[#313131] placeholder:text-[#555]" />
                <button onClick={onMultiAddLP} disabled={isMultiAddingLP} className={`px-5 py-2.5 bg-[#07b3ff] rounded-xl text-[#111] text-sm font-semibold font-satoshi transition-all hover:bg-[#0697e5] ${isMultiAddingLP ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
                  {isMultiAddingLP ? "Adding..." : "Add Liquidity"}
                </button>
              </div>
            </div>
          )}

          {/* ============ MULTI-OUTCOME RESOLUTION PANEL ============ */}
          {isMulti && multiEventInfo?.status === "active" && isExpired && isConnected && (
            <div className="p-6 bg-[#1e1e1e] rounded-2xl outline-1 outline-offset-[-1px] outline-[#313131] flex flex-col gap-5">
              <div className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#07b3ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
                <h3 className="text-white text-lg font-medium font-rubik">Market Resolution</h3>
              </div>
              {/* Phase A: No oracle request yet */}
              {!multiOracleRequestId && (
                <div className="flex flex-col gap-4">
                  {market.marketTag === "demo" ? (
                    <>
                      <p className="text-[#838587] text-sm font-satoshi">This market has expired and is awaiting resolution.</p>
                      <button onClick={onMultiRequestOracle} disabled={multiResolutionLoading} className={`w-full px-4 py-3 bg-[#07b3ff]/10 outline outline-[#07b3ff] rounded-2xl text-[#07b3ff] text-base font-semibold font-satoshi transition-all hover:bg-[#07b3ff]/20 ${multiResolutionLoading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
                        {multiResolutionLoading ? "Requesting..." : "Request Oracle Resolution"}
                      </button>
                    </>
                  ) : (
                    <div className="flex items-center gap-3 p-3 bg-[#111] rounded-xl">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#07b3ff]" />
                      <p className="text-[#838587] text-sm font-satoshi">
                        Resolving — oracle request will be submitted automatically. A proposer can then select the winning outcome.
                      </p>
                    </div>
                  )}
                  {isAdmin && (
                    <div className="flex flex-col gap-2 pt-3 border-t border-[#313131]">
                      <span className="text-[#838587] text-xs font-satoshi uppercase tracking-wider">Admin: Direct Resolve</span>
                      <div className="flex flex-col gap-2">
                        {multiEventInfo.outcomes.map((o: any, i: number) => (
                          <button key={i} onClick={() => onMultiDirectResolve(i)} disabled={multiResolutionLoading} className={`w-full px-3 py-2.5 bg-[#223a25] outline outline-[#3fd145] rounded-xl text-[#3fd145] text-sm font-semibold transition-all ${multiResolutionLoading ? "opacity-50" : "hover:bg-[#2a4a2e] cursor-pointer"}`}>
                            Resolve: {o.name}
                          </button>
                        ))}
                        <button onClick={() => onMultiDirectResolve(-1)} disabled={multiResolutionLoading} className={`w-full px-3 py-2.5 bg-[#3a2222] outline outline-[#ff6464] rounded-xl text-[#ff6464] text-sm font-semibold transition-all ${multiResolutionLoading ? "opacity-50" : "hover:bg-[#4a2a2a] cursor-pointer"}`}>
                          Resolve: No Winner
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {/* Phase B: Oracle requested, no proposal yet */}
              {multiOracleRequestId && multiProposal && multiProposal.proposer === "0x0000000000000000000000000000000000000000" && (
                <div className="flex flex-col gap-4">
                  <p className="text-[#838587] text-sm font-satoshi">Oracle request submitted — select the winning outcome to propose.</p>
                  <div className="p-3 bg-[#111] rounded-xl">
                    <span className="text-[#838587] text-xs font-satoshi">Bond required: </span>
                    <span className="text-white text-xs font-semibold font-satoshi">{isAdmin ? "2 HBAR (admin)" : "10,000 HBAR"}</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    <span className="text-[#838587] text-xs font-satoshi uppercase tracking-wider">Select winning outcome</span>
                    {multiEventInfo.outcomes.map((o: any, i: number) => (
                      <button key={i} onClick={() => onMultiPropose(i)} disabled={multiResolutionLoading} className={`w-full px-3 py-2.5 bg-[#223a25] outline outline-[#3fd145] rounded-xl text-[#3fd145] text-sm font-semibold transition-all ${multiResolutionLoading ? "opacity-50" : "hover:bg-[#2a4a2e] cursor-pointer"}`}>
                        Propose: {o.name}
                      </button>
                    ))}
                    <button onClick={() => onMultiPropose(-1)} disabled={multiResolutionLoading} className={`w-full px-3 py-2.5 bg-[#3a2222] outline outline-[#ff6464] rounded-xl text-[#ff6464] text-sm font-semibold transition-all ${multiResolutionLoading ? "opacity-50" : "hover:bg-[#4a2a2a] cursor-pointer"}`}>
                      Propose: No Winner
                    </button>
                  </div>
                </div>
              )}
              {/* Phase C: Proposal exists, dispute window */}
              {multiOracleRequestId && multiProposal && multiProposal.proposer !== "0x0000000000000000000000000000000000000000" && !multiProposal.settled && !multiProposal.disputed && (
                <div className="flex flex-col gap-4">
                  <div className="p-3 bg-[#111] rounded-xl flex flex-col gap-2">
                    <div className="flex justify-between"><span className="text-[#838587] text-xs font-satoshi">Proposed Winner</span><span className="text-[#3fd145] text-xs font-semibold font-satoshi">{multiProposal.proposedValue >= 0 ? (multiEventInfo?.outcomes?.[multiProposal.proposedValue]?.name || `Outcome ${multiProposal.proposedValue}`) : "No Winner"}</span></div>
                    <div className="flex justify-between"><span className="text-[#838587] text-xs font-satoshi">Bond</span><span className="text-white text-xs font-satoshi">{multiProposal.bondAmount} HBAR</span></div>
                    {multiDisputeCountdown > 0 && <div className="flex justify-between"><span className="text-[#838587] text-xs font-satoshi">Dispute Window</span><span className="text-[#07b3ff] text-xs font-semibold font-satoshi tabular-nums">{formatDisputeTime(multiDisputeCountdown)}</span></div>}
                  </div>
                  {market.marketTag !== "demo" && multiDisputeCountdown > 0 && (
                    <div className="flex items-center gap-3 p-3 bg-[#111] rounded-xl">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#07b3ff]" />
                      <p className="text-[#838587] text-sm font-satoshi">Dispute window is open — will auto-settle once it expires.</p>
                    </div>
                  )}
                  {multiCanDisputeNow && (
                    <div className="flex flex-col gap-2">
                      <p className="text-[#838587] text-xs font-satoshi">Disagree with the proposed outcome? Submit a dispute.</p>
                      <div className="p-2 bg-[#111] rounded-lg"><span className="text-[#838587] text-xs font-satoshi">Dispute bond: </span><span className="text-white text-xs font-semibold font-satoshi">{isAdmin ? "2 HBAR (admin)" : "10,000 HBAR"}</span></div>
                      <button onClick={onMultiDispute} disabled={multiResolutionLoading} className={`w-full px-4 py-2.5 bg-[#3a2222] outline outline-[#ff6464] rounded-xl text-[#ff6464] text-sm font-semibold transition-all ${multiResolutionLoading ? "opacity-50" : "hover:bg-[#4a2a2a] cursor-pointer"}`}>{multiResolutionLoading ? "Disputing..." : "Dispute Answer"}</button>
                    </div>
                  )}
                  {multiCanSettleNow && market.marketTag === "demo" && (
                    <button onClick={onMultiSettle} disabled={multiResolutionLoading} className={`w-full px-4 py-3 bg-[#07b3ff]/10 outline outline-[#07b3ff] rounded-2xl text-[#07b3ff] text-base font-semibold font-satoshi transition-all hover:bg-[#07b3ff]/20 ${multiResolutionLoading ? "opacity-50" : "cursor-pointer"}`}>{multiResolutionLoading ? "Settling..." : "Settle Proposal"}</button>
                  )}
                  {multiCanSettleNow && market.marketTag !== "demo" && (
                    <div className="flex items-center gap-3 p-3 bg-[#111] rounded-xl">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#07b3ff]" />
                      <p className="text-[#838587] text-sm font-satoshi">Dispute window passed. Auto-settling...</p>
                    </div>
                  )}
                </div>
              )}
              {/* Phase D: Disputed */}
              {multiOracleRequestId && multiProposal && multiProposal.disputed && !multiProposal.settled && (
                <div className="flex flex-col gap-4">
                  <div className="p-3 bg-[#111] rounded-xl flex flex-col gap-2">
                    <span className="text-[#ff6464] text-sm font-semibold font-satoshi">Outcome Disputed</span>
                    <div className="flex justify-between"><span className="text-[#838587] text-xs font-satoshi">Proposed</span><span className="text-white text-xs font-satoshi">{multiProposal.proposedValue >= 0 ? (multiEventInfo?.outcomes?.[multiProposal.proposedValue]?.name || `Outcome ${multiProposal.proposedValue}`) : "No Winner"}</span></div>
                    <div className="flex justify-between"><span className="text-[#838587] text-xs font-satoshi">Disputer</span><span className="text-white text-xs font-satoshi">{elipsKey(multiProposal.disputer)}</span></div>
                    <div className="flex justify-between"><span className="text-[#838587] text-xs font-satoshi">Total Bonds</span><span className="text-white text-xs font-semibold font-satoshi">{(multiProposal.bondAmount + multiProposal.disputeBond).toFixed(2)} HBAR</span></div>
                  </div>
                  {isAdmin ? (
                    <div className="flex flex-col gap-2">
                      <span className="text-[#838587] text-xs font-satoshi">Select the correct outcome. The losing party forfeits their bond.</span>
                      <div className="flex flex-col gap-2">
                        {multiEventInfo.outcomes.map((o: any, i: number) => (
                          <button key={i} onClick={() => onMultiResolveDispute(i)} disabled={multiResolutionLoading} className={`w-full px-3 py-2.5 bg-[#223a25] outline outline-[#3fd145] rounded-xl text-[#3fd145] text-sm font-semibold transition-all ${multiResolutionLoading ? "opacity-50" : "hover:bg-[#2a4a2e] cursor-pointer"}`}>
                            {o.name} is correct
                          </button>
                        ))}
                        <button onClick={() => onMultiResolveDispute(-1)} disabled={multiResolutionLoading} className={`w-full px-3 py-2.5 bg-[#3a2222] outline outline-[#ff6464] rounded-xl text-[#ff6464] text-sm font-semibold transition-all ${multiResolutionLoading ? "opacity-50" : "hover:bg-[#4a2a2a] cursor-pointer"}`}>
                          No Winner
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[#838587] text-sm font-satoshi">Awaiting administrator review to resolve this dispute.</p>
                  )}
                </div>
              )}
              {/* Phase E: Oracle resolved, event not finalized */}
              {multiOracleRequestId && multiOracleResolved && multiEventInfo?.status === "active" && (
                <div className="flex flex-col gap-4">
                  {market.marketTag === "demo" ? (
                    <>
                      <p className="text-[#838587] text-sm font-satoshi">Oracle resolution complete. Finalize to enable payouts.</p>
                      <button onClick={onMultiFinalize} disabled={multiResolutionLoading} className={`w-full px-4 py-3 bg-[#07b3ff] rounded-2xl text-[#111] text-lg font-bold font-satoshi transition-all hover:bg-[#0697e5] ${multiResolutionLoading ? "opacity-50" : "cursor-pointer"}`}>{multiResolutionLoading ? "Finalizing..." : "Finalize Market"}</button>
                    </>
                  ) : (
                    <div className="flex items-center gap-3 p-3 bg-[#111] rounded-xl">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#07b3ff]" />
                      <p className="text-[#838587] text-sm font-satoshi">Oracle resolved — event is being finalized automatically.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Multi-Outcome: Event Finished Result */}
          {isMulti && multiEventInfo?.status === "finished" && (
            <div className="p-6 bg-[#1e1e1e] rounded-2xl outline-1 outline-offset-[-1px] outline-[#3fd145]/30 flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3fd145" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                <h3 className="text-[#3fd145] text-lg font-medium font-rubik">Market Resolved</h3>
              </div>
              <div className="p-4 bg-[#111] rounded-xl flex items-center justify-center">
                <span className="text-2xl font-bold font-satoshi text-[#3fd145]">
                  {multiEventInfo.winningOutcome >= 0
                    ? `✓ ${multiEventInfo.outcomes?.[multiEventInfo.winningOutcome]?.name || `Outcome ${multiEventInfo.winningOutcome}`} Won`
                    : "✗ No Winner"}
                </span>
              </div>
            </div>
          )}

          {/* ============ RESOLUTION PANEL ============ */}
          {!isMulti && onChainInfo?.status === "active" && isExpired && isConnected && (
            <div className="p-6 bg-[#1e1e1e] rounded-2xl outline-1 outline-offset-[-1px] outline-[#313131] flex flex-col gap-5">
              <div className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#07b3ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
                <h3 className="text-white text-lg font-medium font-rubik">Market Resolution</h3>
              </div>
              {/* Phase A: No oracle request yet — auto-resolution in progress */}
              {!oracleRequestId && (
                <div className="flex flex-col gap-4">
                  {market.marketTag === "demo" ? (
                    <>
                      <p className="text-[#838587] text-sm font-satoshi">This market has expired and is awaiting resolution.</p>
                      <button onClick={onRequestOracle} disabled={resolutionLoading} className={`w-full px-4 py-3 bg-[#07b3ff]/10 outline outline-[#07b3ff] rounded-2xl text-[#07b3ff] text-base font-semibold font-satoshi transition-all hover:bg-[#07b3ff]/20 ${resolutionLoading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
                        {resolutionLoading ? "Requesting..." : "Request Oracle Resolution"}
                      </button>
                    </>
                  ) : (
                    <div className="flex items-center gap-3 p-3 bg-[#111] rounded-xl">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#07b3ff]" />
                      <p className="text-[#838587] text-sm font-satoshi">
                        {market.marketField !== 0
                          ? "Resolving — oracle request will be submitted automatically. A proposer can then submit the outcome."
                          : "Resolving — the system is processing this market automatically."}
                      </p>
                    </div>
                  )}
                  {isAdmin && (
                    <div className="flex flex-col gap-2 pt-3 border-t border-[#313131]">
                      <span className="text-[#838587] text-xs font-satoshi uppercase tracking-wider">Admin: Direct Resolve</span>
                      <div className="flex gap-2">
                        <button onClick={() => onDirectResolve(true)} disabled={resolutionLoading} className={`flex-1 px-3 py-2.5 bg-[#223a25] outline outline-[#3fd145] rounded-xl text-[#3fd145] text-sm font-semibold transition-all ${resolutionLoading ? "opacity-50" : "hover:bg-[#2a4a2e] cursor-pointer"}`}>Resolve Yes</button>
                        <button onClick={() => onDirectResolve(false)} disabled={resolutionLoading} className={`flex-1 px-3 py-2.5 bg-[#3a2222] outline outline-[#ff6464] rounded-xl text-[#ff6464] text-sm font-semibold transition-all ${resolutionLoading ? "opacity-50" : "hover:bg-[#4a2a2a] cursor-pointer"}`}>Resolve No</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {/* Phase B: Oracle requested, no proposal yet */}
              {oracleRequestId && proposal && proposal.proposer === "0x0000000000000000000000000000000000000000" && (
                <div className="flex flex-col gap-4">
                  {market.marketTag === "demo" || market.marketField !== 0 ? (
                    <>
                      <p className="text-[#838587] text-sm font-satoshi">
                        {market.marketField !== 0
                          ? "Oracle request submitted — awaiting a proposer to submit the outcome."
                          : "Oracle request submitted — submit your proposed outcome below."}
                      </p>
                      <div className="p-3 bg-[#111] rounded-xl">
                        <span className="text-[#838587] text-xs font-satoshi">Bond required: </span>
                        <span className="text-white text-xs font-semibold font-satoshi">{isAdmin ? "2 HBAR (admin)" : "10,000 HBAR"}</span>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => onPropose(1)} disabled={resolutionLoading} className={`flex-1 px-3 py-2.5 bg-[#223a25] outline outline-[#3fd145] rounded-xl text-[#3fd145] text-sm font-semibold transition-all ${resolutionLoading ? "opacity-50" : "hover:bg-[#2a4a2e] cursor-pointer"}`}>Propose Yes</button>
                        <button onClick={() => onPropose(-1)} disabled={resolutionLoading} className={`flex-1 px-3 py-2.5 bg-[#3a2222] outline outline-[#ff6464] rounded-xl text-[#ff6464] text-sm font-semibold transition-all ${resolutionLoading ? "opacity-50" : "hover:bg-[#4a2a2a] cursor-pointer"}`}>Propose No</button>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center gap-3 p-3 bg-[#111] rounded-xl">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#07b3ff]" />
                      <p className="text-[#838587] text-sm font-satoshi">Oracle request submitted — auto-proposing outcome from price data.</p>
                    </div>
                  )}
                  {isAdmin && (
                    <div className="flex flex-col gap-2 pt-3 border-t border-[#313131]">
                      <span className="text-[#838587] text-xs font-satoshi uppercase tracking-wider">Admin: Manual Propose</span>
                      <div className="flex gap-2">
                        <button onClick={() => onPropose(1)} disabled={resolutionLoading} className={`flex-1 px-3 py-2.5 bg-[#223a25] outline outline-[#3fd145] rounded-xl text-[#3fd145] text-sm font-semibold transition-all ${resolutionLoading ? "opacity-50" : "hover:bg-[#2a4a2e] cursor-pointer"}`}>Propose Yes</button>
                        <button onClick={() => onPropose(-1)} disabled={resolutionLoading} className={`flex-1 px-3 py-2.5 bg-[#3a2222] outline outline-[#ff6464] rounded-xl text-[#ff6464] text-sm font-semibold transition-all ${resolutionLoading ? "opacity-50" : "hover:bg-[#4a2a2a] cursor-pointer"}`}>Propose No</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {/* Phase C: Proposal exists, dispute window */}
              {oracleRequestId && proposal && proposal.proposer !== "0x0000000000000000000000000000000000000000" && !proposal.settled && !proposal.disputed && (
                <div className="flex flex-col gap-4">
                  <div className="p-3 bg-[#111] rounded-xl flex flex-col gap-2">
                    <div className="flex justify-between"><span className="text-[#838587] text-xs font-satoshi">Proposed Answer</span><span className={`text-xs font-semibold font-satoshi ${proposal.proposedValue === 1 ? "text-[#3fd145]" : "text-[#ff6464]"}`}>{proposal.proposedValue === 1 ? "Yes" : "No"}</span></div>
                    <div className="flex justify-between"><span className="text-[#838587] text-xs font-satoshi">Bond</span><span className="text-white text-xs font-satoshi">{proposal.bondAmount} HBAR</span></div>
                    {disputeCountdown > 0 && <div className="flex justify-between"><span className="text-[#838587] text-xs font-satoshi">Dispute Window</span><span className="text-[#07b3ff] text-xs font-semibold font-satoshi tabular-nums">{formatDisputeTime(disputeCountdown)}</span></div>}
                  </div>
                  {market.marketTag !== "demo" && disputeCountdown > 0 && (
                    <div className="flex items-center gap-3 p-3 bg-[#111] rounded-xl">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#07b3ff]" />
                      <p className="text-[#838587] text-sm font-satoshi">Dispute window is open — will auto-settle once it expires.</p>
                    </div>
                  )}
                  {canDisputeNow && (
                    <div className="flex flex-col gap-2">
                      <p className="text-[#838587] text-xs font-satoshi">Disagree with the proposed outcome? Submit a dispute.</p>
                      <div className="p-2 bg-[#111] rounded-lg"><span className="text-[#838587] text-xs font-satoshi">Dispute bond: </span><span className="text-white text-xs font-semibold font-satoshi">{isAdmin ? "2 HBAR (admin)" : "10,000 HBAR"}</span></div>
                      <button onClick={onDispute} disabled={resolutionLoading} className={`w-full px-4 py-2.5 bg-[#3a2222] outline outline-[#ff6464] rounded-xl text-[#ff6464] text-sm font-semibold transition-all ${resolutionLoading ? "opacity-50" : "hover:bg-[#4a2a2a] cursor-pointer"}`}>{resolutionLoading ? "Disputing..." : "Dispute Answer"}</button>
                    </div>
                  )}
                  {canSettleNow && market.marketTag === "demo" && (
                    <button onClick={onSettle} disabled={resolutionLoading} className={`w-full px-4 py-3 bg-[#07b3ff]/10 outline outline-[#07b3ff] rounded-2xl text-[#07b3ff] text-base font-semibold font-satoshi transition-all hover:bg-[#07b3ff]/20 ${resolutionLoading ? "opacity-50" : "cursor-pointer"}`}>{resolutionLoading ? "Settling..." : "Settle Proposal"}</button>
                  )}
                  {canSettleNow && market.marketTag !== "demo" && (
                    <div className="flex items-center gap-3 p-3 bg-[#111] rounded-xl">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#07b3ff]" />
                      <p className="text-[#838587] text-sm font-satoshi">Dispute window passed. Auto-settling...</p>
                    </div>
                  )}
                </div>
              )}
              {/* Phase D: Disputed */}
              {oracleRequestId && proposal && proposal.disputed && !proposal.settled && (
                <div className="flex flex-col gap-4">
                  <div className="p-3 bg-[#111] rounded-xl flex flex-col gap-2">
                    <span className="text-[#ff6464] text-sm font-semibold font-satoshi">Outcome Disputed</span>
                    <div className="flex justify-between"><span className="text-[#838587] text-xs font-satoshi">Proposer</span><span className="text-white text-xs font-satoshi">{elipsKey(proposal.proposer)} — {proposal.proposedValue === 1 ? "Yes" : "No"}</span></div>
                    <div className="flex justify-between"><span className="text-[#838587] text-xs font-satoshi">Disputer</span><span className="text-white text-xs font-satoshi">{elipsKey(proposal.disputer)}</span></div>
                    <div className="flex justify-between"><span className="text-[#838587] text-xs font-satoshi">Total Bonds</span><span className="text-white text-xs font-semibold font-satoshi">{(proposal.bondAmount + proposal.disputeBond).toFixed(2)} HBAR</span></div>
                  </div>
                  {isAdmin ? (
                    <div className="flex flex-col gap-2">
                      <span className="text-[#838587] text-xs font-satoshi">Select the correct outcome. The losing party forfeits their bond.</span>
                      <div className="flex gap-2">
                        <button onClick={() => onResolveDispute(1)} disabled={resolutionLoading} className={`flex-1 px-3 py-2.5 bg-[#223a25] outline outline-[#3fd145] rounded-xl text-[#3fd145] text-sm font-semibold transition-all ${resolutionLoading ? "opacity-50" : "hover:bg-[#2a4a2e] cursor-pointer"}`}>Yes is correct</button>
                        <button onClick={() => onResolveDispute(-1)} disabled={resolutionLoading} className={`flex-1 px-3 py-2.5 bg-[#3a2222] outline outline-[#ff6464] rounded-xl text-[#ff6464] text-sm font-semibold transition-all ${resolutionLoading ? "opacity-50" : "hover:bg-[#4a2a2a] cursor-pointer"}`}>No is correct</button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[#838587] text-sm font-satoshi">Awaiting administrator review to resolve this dispute.</p>
                  )}
                </div>
              )}
              {/* Phase E: Oracle resolved, market not finalized */}
              {oracleRequestId && oracleResolved && onChainInfo?.status === "active" && (
                <div className="flex flex-col gap-4">
                  {market.marketTag === "demo" ? (
                    <>
                      <p className="text-[#838587] text-sm font-satoshi">Oracle resolution complete. Finalize to enable payouts.</p>
                      <button onClick={onFinalize} disabled={resolutionLoading} className={`w-full px-4 py-3 bg-[#07b3ff] rounded-2xl text-[#111] text-lg font-bold font-satoshi transition-all hover:bg-[#0697e5] ${resolutionLoading ? "opacity-50" : "cursor-pointer"}`}>{resolutionLoading ? "Finalizing..." : "Finalize Market"}</button>
                    </>
                  ) : (
                    <div className="flex items-center gap-3 p-3 bg-[#111] rounded-xl">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#07b3ff]" />
                      <p className="text-[#838587] text-sm font-satoshi">Oracle resolved — market is being finalized automatically.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Market Finished Result */}
          {!isMulti && onChainInfo?.status === "finished" && (
            <div className="p-6 bg-[#1e1e1e] rounded-2xl outline-1 outline-offset-[-1px] outline-[#3fd145]/30 flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3fd145" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                <h3 className="text-[#3fd145] text-lg font-medium font-rubik">Market Resolved</h3>
              </div>
              <div className="p-4 bg-[#111] rounded-xl flex items-center justify-center">
                <span className={`text-2xl font-bold font-satoshi ${onChainInfo.result ? "text-[#3fd145]" : "text-[#ff6464]"}`}>
                  {onChainInfo.result ? "✓ Yes Won" : "✗ No Won"}
                </span>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
