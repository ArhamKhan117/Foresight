import { Request, Response } from "express";
import MarketModel from "../../model/market";
import ReferModel from "../../model/referral";
import RecentModel from "../../model/recent";
import PriceHistoryModel from "../../model/priceHistory";
import { buildMarketFilterQuery } from "./utils";
import { createHCSTopic, logMarketCreated, logEventCreated, logFunded, logBetPlaced, submitHCSMessage } from "../../services/hcsService";
import { rewardFORE } from "../../services/htsService";

export const create_market = async (req: Request, res: Response) => {
    try {
        const { 
            marketField,
            apiType,
            question,
            task,
            date,
            value,
            range,
            imageUrl,
            creator,
            feedName,
            feedId,
            description,
            market,
            marketTag,
            // Multi-outcome fields
            marketType,
            eventGroupId,
            eventQuestion,
            outcomeName,
            outcomeIndex,
        } = req.body.data;

        const marketData = new MarketModel({
            marketField,
            apiType,
            task,
            creator,
            question,
            value,
            range,
            date,
            marketStatus: "PENDING",
            imageUrl: imageUrl || "/fund.png",
            feedName,
            feedId: feedId || "",
            description: description || "",
            market: market || `market_${Date.now()}`,
            marketTag: marketTag || "normal",
            marketType: marketType || "binary",
            eventGroupId: eventGroupId || "",
            eventQuestion: eventQuestion || "",
            outcomeName: outcomeName || "",
            outcomeIndex: outcomeIndex || 0,
        });

        const db_result = await marketData.save();
        console.log("Created init market data on db:", db_result.id.toString());

        // Create HCS topic for this market (binary markets only — multi-outcome creates topic in createMultiOutcomeEvent)
        if (!marketType || marketType === "binary") {
            try {
                const topicId = await createHCSTopic(`Foresight Market: ${question.slice(0, 80)}`);
                if (topicId) {
                    await MarketModel.findByIdAndUpdate(db_result._id, { hcsTopicId: topicId });
                    logMarketCreated(topicId, {
                        marketId: db_result.id.toString(),
                        creator,
                        question,
                        marketType: "binary",
                    });
                }
            } catch (e) { console.log("HCS topic creation error:", e); }
        }
        
        res.status(200).json({ message: "Feed registration successful!", result: db_result.id });

        // Fire-and-forget FORE reward for market creation
        rewardFORE(creator, 5).catch(() => {});
    } catch (error) {
        console.log("😒 create market error:", error);
        res.status(500).send("Failed to create market! Please try again later.");
        return;
    }
};

export const betting = async (req: Request, res: Response) => {
    try {
        const { player, market_id, amount, isYes } = req.body;
        // New LMSR fields from frontend SDK result
        const yesPrice = req.body.yesPrice ?? 0.5;
        const noPrice = req.body.noPrice ?? 0.5;
        const cost = req.body.cost ?? 0;
        const fee = req.body.fee ?? 0;
        
        console.log("Betting:", player, market_id, amount, isYes, "cost:", cost, "fee:", fee);
        
        const hbar_amount = cost + fee; // total HBAR spent on this bet
        const result = await MarketModel.findByIdAndUpdate(
            market_id,
            {
                $set: {
                    tokenAPrice: Math.round(yesPrice * 1e8),
                    tokenBPrice: Math.round(noPrice * 1e8),
                },
                $inc: { totalBets: 1 },
                $push: isYes ? { playerA: { player, amount: hbar_amount } } : { playerB: { player, amount: hbar_amount } },
            },
            { new: true }
        );

        setReferralFee(player, hbar_amount);

        // Fire-and-forget FORE reward for betting (only when real bet, not price-update)
        if (amount > 0) rewardFORE(player, 1).catch(() => {});

        // HCS audit log for bet
        try {
            const marketDoc = await MarketModel.findById(market_id);
            if (marketDoc?.hcsTopicId && amount > 0) {
                logBetPlaced(marketDoc.hcsTopicId, {
                    wallet: player,
                    side: isYes ? "YES" : "NO",
                    amount: amount,
                    cost: cost + fee,
                    outcomeName: marketDoc.outcomeName || undefined,
                });
            }
        } catch (e) { console.log("HCS bet log error:", e); }

        // Log price history for chart
        try {
            const marketDoc = await MarketModel.findById(market_id);
            if (marketDoc) {
                // For multi-outcome, save per-outcome using DB _id as key
                const historyKey = marketDoc.marketType === "multi" ? market_id : marketDoc.market;
                await new PriceHistoryModel({
                    marketId: historyKey,
                    yesPrice: yesPrice,
                    noPrice: noPrice,
                }).save();
            }
        } catch (e) { console.log("Price history save error:", e); }

        // Save recent activity
        try {
            const marketDoc = await MarketModel.findById(market_id);
            if (marketDoc) {
                await new RecentModel({
                    marketId: market_id,
                    wallet: player,
                    question: marketDoc.question || "",
                    action: isYes ? "bet_yes" : "bet_no",
                    amount: hbar_amount,
                    imageUrl: marketDoc.imageUrl || "",
                }).save();
            }
        } catch (e) { console.log("Recent activity save error:", e); }

        res.status(200).json(result);
    } catch (error) {
        res.status(500).send("Failed betting!");
        console.log("😒 betting error:", error);
        return;
    }
};

export const additionalInfo = async (req: Request, res: Response) => {
    try {
        const { id, market, tokenA, tokenB, feedAddress, contractMarketId, htsTokenA, htsTokenB } = req.body.data;
        
        const result = await MarketModel.updateOne(
            { _id: id },
            {
                $set: { 
                    market: market, 
                    tokenA: tokenA, 
                    tokenB: tokenB, 
                    marketStatus: "PENDING", 
                    feedkey: feedAddress,
                    contractMarketId: contractMarketId || "",
                    htsTokenA: htsTokenA || "",
                    htsTokenB: htsTokenB || ""
                },
            }
        );
        res.status(200).json({ result: "success" });
    } catch (error) {
        console.log("😒 add info error:", error);
        res.status(500).send("Failed to update info! Please try again later.");
        return;
    }
};

export const getMarketData = async (req: Request, res: Response) => {
    try {
        const { marketStatus, page = 1, limit = 10, id } = req.query;
        
        // If id is provided, fetch single market by _id
        if (id) {
            const market = await MarketModel.aggregate([
                { $match: { _id: new (require('mongoose').Types.ObjectId)(id as string) } },
                {
                    $addFields: {
                        playerACount: { $sum: "$playerA.amount" },
                        playerBCount: { $sum: "$playerB.amount" },
                        totalInvestment: { $sum: "$investors.amount" }
                    }
                },
                {
                    $project: {
                        playerA: 0,
                        playerB: 0,
                        investors: 0
                    }
                }
            ]);
            
            if (market.length === 0) {
                return res.status(404).json({ error: 'Market not found' });
            }
            
            return res.json({ data: market });
        }
        
        const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    
        const match: any = {};
        if (marketStatus) {
            match.marketStatus = marketStatus;
        }
        if (req.query.marketField !== undefined && req.query.marketField !== "") {
            match.marketField = parseInt(req.query.marketField as string);
        }
    
        const results = await MarketModel.aggregate([
            { $match: match },
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: parseInt(limit as string) },
            {
                $addFields: {
                    playerACount: { $sum: "$playerA.amount" },
                    playerBCount: { $sum: "$playerB.amount" },
                    totalInvestment: { $sum: "$investors.amount" }
                }
            },
            {
                $project: {
                    playerA: 0,
                    playerB: 0,
                    investors: 0
                }
            }
        ]);
    
        const total = await MarketModel.countDocuments(match);
        
        res.json({
            data: results,
            total,
            page: +page,
            totalPages: Math.ceil(total / +limit),
        });
    } catch (err) {
        console.log("😒 get market data error:", err);
        res.status(500).json({ error: 'Server error' });
    }
};

export const addLiquidity = async (req: Request, res: Response) => {
    try {
        const { market_id, amount, investor, active } = req.body;
        console.log("status:", active);
        
        const liquidity_result = await MarketModel.findOneAndUpdate(
            { _id: market_id },
            {
                $set: {
                    marketStatus: active ? "ACTIVE" : "PENDING"
                },
                $push: {
                    investors: {
                        investor,
                        amount,
                    },
                },
            }
        );

        setReferralFee(investor, amount);

        // Fire-and-forget FORE reward for liquidity (2 FORE per HBAR, capped at 50)
        const foreReward = Math.min(amount * 2, 50);
        rewardFORE(investor, foreReward).catch(() => {});

        // HCS audit log for funding
        try {
            const marketDoc = await MarketModel.findById(market_id);
            if (marketDoc?.hcsTopicId) {
                logFunded(marketDoc.hcsTopicId, { wallet: investor, amount, marketType: "binary" });
            }
        } catch (e) { console.log("HCS fund log error:", e); }

        // Save recent activity
        try {
            const marketDoc = await MarketModel.findById(market_id);
            if (marketDoc) {
                await new RecentModel({
                    marketId: market_id,
                    wallet: investor,
                    question: marketDoc.question || "",
                    action: "funded",
                    amount: amount,
                    imageUrl: marketDoc.imageUrl || "",
                }).save();
            }
        } catch (e) { console.log("Recent activity save error:", e); }

        res.status(200).json({ result: "success" });
    } catch (error) {
        console.log("😒 error:", error);
        res.status(500).send("Failed to add liquidity! Please try again later.");
        return;
    }
};

export const setReferralFee = async (wallet: string, amount: number) => {
    try {
        const refer = await ReferModel.findOne({ wallet });

        if (refer) {
            let fee = 0;
            if (refer.wallet_refered !== "") {
                switch (refer.referredLevel) {
                    case 0:
                        fee = refer.fee + amount * 0.005 * 0.7;
                        break;
                    case 1:
                        fee = refer.fee + amount * 0.005 * 0.2;
                        break;
                    case 2:
                        fee = refer.fee + amount * 0.005 * 0.1;
                        break;
                    default:
                        fee = 0;
                        break;
                }
            }

            refer.fee = fee;
            refer.save();
        }
    } catch (error) {
        console.log("set referral fee error:", error);
    }
};

export const getFilteredMarket = async (req: Request, res: Response) => {
    try {
        const {
            volumeMin,
            volumeMax,
            expiryStart,
            expiryEnd,
            yesProbMin,
            yesProbMax,
            noProbMin,
            noProbMax,
        } = req.body;

        const query = buildMarketFilterQuery({
            volumeMin,
            volumeMax,
            expiryStart,
            expiryEnd,
            yesProbMin,
            yesProbMax,
            noProbMin,
            noProbMax,
        });

        const result = await MarketModel.find(query);

        res.status(200).send({ data: result });
    } catch (error) {
        console.log("😒 error:", error);
        return res.status(500).send("Failed to filter market! Please try again later.");
    }
};

export const resolveMarket = async (req: Request, res: Response) => {
    try {
        const { market_id } = req.body;
        if (!market_id) return res.status(400).json({ error: "market_id required" });
        
        // HCS audit log for resolution
        try {
            const marketDoc = await MarketModel.findById(market_id);
            if (marketDoc?.hcsTopicId) {
                const { submitHCSMessage } = await import("../../services/hcsService");
                submitHCSMessage(marketDoc.hcsTopicId, "MARKET_RESOLVED", {
                    marketId: market_id,
                    resolvedBy: "admin",
                });
            }
        } catch (e) { console.log("HCS resolve log error:", e); }

        await MarketModel.findByIdAndUpdate(market_id, { $set: { marketStatus: "CLOSED" } });
        res.status(200).json({ result: "success" });
    } catch (error) {
        console.log("😒 resolve market error:", error);
        res.status(500).send("Failed to resolve market!");
    }
};

export const recentActivity = async (req: Request, res: Response) => {
    try {
        const limit = parseInt(req.query.limit as string) || 20;
        const filter: any = {};
        if (req.query.marketId) filter.marketId = req.query.marketId;
        const recents = await RecentModel.find(filter).sort({ createdAt: -1 }).limit(limit);
        res.status(200).json({ data: recents });
    } catch (error) {
        console.log("Recent activity error:", error);
        res.status(500).json({ error: "Failed to fetch recent activity" });
    }
};

export const getPriceHistory = async (req: Request, res: Response) => {
    try {
        const { marketId } = req.query;
        if (!marketId) return res.status(400).json({ error: "marketId required" });

        const history = await PriceHistoryModel.find({ marketId: marketId as string })
            .sort({ timestamp: 1 })
            .lean();

        res.status(200).json({ data: history });
    } catch (error) {
        console.log("Price history error:", error);
        res.status(500).json({ error: "Failed to fetch price history" });
    }
};

// Get all outcomes for a multi-outcome event group
export const getEventGroup = async (req: Request, res: Response) => {
    try {
        const { eventGroupId } = req.query;
        if (!eventGroupId) return res.status(400).json({ error: "eventGroupId required" });

        const outcomes = await MarketModel.aggregate([
            { $match: { eventGroupId: eventGroupId as string } },
            { $sort: { outcomeIndex: 1 } },
            {
                $addFields: {
                    playerACount: { $sum: "$playerA.amount" },
                    playerBCount: { $sum: "$playerB.amount" },
                    totalInvestment: { $sum: "$investors.amount" }
                }
            },
            {
                $project: {
                    playerA: 0,
                    playerB: 0,
                    investors: 0
                }
            }
        ]);

        res.status(200).json({ data: outcomes });
    } catch (error) {
        console.log("Event group error:", error);
        res.status(500).json({ error: "Failed to fetch event group" });
    }
};

// Create multi-outcome event (all outcomes in one API call)
export const createMultiOutcomeEvent = async (req: Request, res: Response) => {
    try {
        const {
            eventGroupId,
            eventQuestion,
            outcomeNames,
            marketField,
            apiType,
            date,
            imageUrl,
            creator,
            feedName,
            feedId,
            description,
            marketTag,
        } = req.body;

        // Create ONE HCS topic for the entire multi-outcome event
        let hcsTopicId = "";
        try {
            const topicId = await createHCSTopic(`Foresight Event: ${eventQuestion.slice(0, 80)}`);
            if (topicId) {
                hcsTopicId = topicId;
                logEventCreated(topicId, {
                    eventGroupId,
                    creator,
                    question: eventQuestion,
                    outcomes: outcomeNames,
                });
            }
        } catch (e) { console.log("HCS event topic creation error:", e); }

        const results = [];
        for (let i = 0; i < outcomeNames.length; i++) {
            const outcomeName = outcomeNames[i];
            const marketData = new MarketModel({
                marketField,
                apiType,
                task: "",
                creator,
                question: `${eventQuestion} — ${outcomeName}`,
                value: 0,
                range: 0,
                date,
                marketStatus: "PENDING",
                imageUrl: imageUrl || "/fund.png",
                feedName,
                feedId: feedId || "",
                description: description || "",
                market: eventGroupId, // All outcomes share the same on-chain eventId
                marketTag: marketTag || "normal",
                marketType: "multi",
                eventGroupId,
                eventQuestion,
                outcomeName,
                outcomeIndex: i,
                hcsTopicId,
            });
            const saved = await marketData.save();
            results.push(saved.id);
        }

        console.log(`Created multi-outcome event ${eventGroupId} with ${outcomeNames.length} outcomes`);
        res.status(200).json({ message: "Multi-outcome event created!", results });

        // Fire-and-forget FORE reward for event creation
        rewardFORE(creator, 5).catch(() => {});
    } catch (error) {
        console.log("😒 create multi-outcome event error:", error);
        res.status(500).send("Failed to create multi-outcome event!");
    }
};

// Fund multi-outcome event (updates all outcomes in the group)
export const fundMultiOutcomeEvent = async (req: Request, res: Response) => {
    try {
        const { eventGroupId, amount, investor, active } = req.body;

        // Update all outcomes in this event group
        const updateResult = await MarketModel.updateMany(
            { eventGroupId },
            {
                $set: {
                    marketStatus: active ? "ACTIVE" : "PENDING"
                },
                $push: {
                    investors: { investor, amount: amount }
                }
            }
        );

        setReferralFee(investor, amount);

        // Fire-and-forget FORE reward for event funding (2 FORE per HBAR, capped at 50)
        const foreReward = Math.min(amount * 2, 50);
        rewardFORE(investor, foreReward).catch(() => {});

        // HCS audit log for event funding
        try {
            const firstOutcome = await MarketModel.findOne({ eventGroupId });
            if (firstOutcome?.hcsTopicId) {
                logFunded(firstOutcome.hcsTopicId, { wallet: investor, amount, marketType: "multi" });
            }
        } catch (e) { console.log("HCS fund event log error:", e); }

        // Save recent activity
        try {
            const firstOutcome = await MarketModel.findOne({ eventGroupId });
            if (firstOutcome) {
                await new RecentModel({
                    marketId: firstOutcome._id,
                    wallet: investor,
                    question: firstOutcome.eventQuestion || firstOutcome.question,
                    action: "funded",
                    amount,
                    imageUrl: firstOutcome.imageUrl || "",
                }).save();
            }
        } catch (e) { console.log("Recent activity save error:", e); }

        console.log(`Funded event ${eventGroupId}: ${updateResult.modifiedCount} outcomes updated`);
        res.status(200).json({ result: "success", updated: updateResult.modifiedCount });
    } catch (error) {
        console.log("😒 fund event error:", error);
        res.status(500).send("Failed to fund event!");
    }
};

// Generic HCS audit log endpoint — frontend calls this after oracle/resolution actions
export const logHCSEvent = async (req: Request, res: Response) => {
    try {
        const { marketId, eventGroupId, type, data } = req.body;

        let topicId = "";
        if (eventGroupId) {
            const doc = await MarketModel.findOne({ eventGroupId });
            topicId = doc?.hcsTopicId || "";
        } else if (marketId) {
            const doc = await MarketModel.findById(marketId);
            topicId = doc?.hcsTopicId || "";
        }

        if (!topicId) {
            return res.status(200).json({ result: "no_topic" });
        }

        await submitHCSMessage(topicId, type, data || {});
        res.status(200).json({ result: "logged" });
    } catch (error) {
        console.log("HCS log endpoint error:", error);
        res.status(200).json({ result: "error" });
    }
};
