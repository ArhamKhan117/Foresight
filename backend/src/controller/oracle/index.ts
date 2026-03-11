import { Request, Response } from "express";
import {
    resolveMarket,
    proposeAnswer,
    disputeAnswer,
    settleProposal,
    resolveDispute,
    canSettle,
    canDispute,
    getProposal,
    getRequiredBond,
} from "../../hedera_sdk";
import MarketModel from "../../model/market";
import { ADMIN_BOND, USER_BOND } from "../../hedera_sdk/constants";

/**
 * Request oracle resolution for a market
 */
export const requestResolution = async (req: Request, res: Response) => {
    try {
        const { marketId } = req.body;
        
        const market = await MarketModel.findById(marketId);
        if (!market) {
            return res.status(404).json({ error: "Market not found" });
        }

        const result = await resolveMarket(market.contractMarketId || marketId, true);
        
        if (result.success) {
            res.status(200).json({ message: "Oracle resolution requested successfully" });
        } else {
            res.status(500).json({ error: "Failed to request oracle resolution" });
        }
    } catch (error) {
        console.log("😒 request resolution error:", error);
        res.status(500).json({ error: "Failed to request oracle resolution" });
    }
};

/**
 * Propose an answer to the oracle
 */
export const propose = async (req: Request, res: Response) => {
    try {
        const { questionId, value, isAdmin } = req.body;
        
        if (value !== 1 && value !== -1) {
            return res.status(400).json({ error: "Value must be 1 (YES) or -1 (NO)" });
        }

        const bondAmount = isAdmin ? ADMIN_BOND : USER_BOND;
        const result = await proposeAnswer(questionId, value, bondAmount);
        
        if (result.success) {
            res.status(200).json({ 
                message: "Answer proposed successfully",
                bondAmount: bondAmount
            });
        } else {
            res.status(500).json({ error: "Failed to propose answer" });
        }
    } catch (error) {
        console.log("😒 propose answer error:", error);
        res.status(500).json({ error: "Failed to propose answer" });
    }
};

/**
 * Dispute a proposed answer
 */
export const dispute = async (req: Request, res: Response) => {
    try {
        const { questionId, isAdmin } = req.body;
        
        // Check if can dispute
        const canDisputeNow = await canDispute(questionId);
        if (!canDisputeNow) {
            return res.status(400).json({ error: "Cannot dispute at this time" });
        }

        const bondAmount = isAdmin ? ADMIN_BOND : USER_BOND;
        const result = await disputeAnswer(questionId, bondAmount);
        
        if (result.success) {
            res.status(200).json({ 
                message: "Answer disputed successfully",
                bondAmount: bondAmount
            });
        } else {
            res.status(500).json({ error: "Failed to dispute answer" });
        }
    } catch (error) {
        console.log("😒 dispute answer error:", error);
        res.status(500).json({ error: "Failed to dispute answer" });
    }
};

/**
 * Settle an undisputed proposal
 */
export const settle = async (req: Request, res: Response) => {
    try {
        const { questionId } = req.body;
        
        // Check if can settle
        const canSettleNow = await canSettle(questionId);
        if (!canSettleNow) {
            return res.status(400).json({ error: "Cannot settle at this time" });
        }

        const result = await settleProposal(questionId);
        
        if (result.success) {
            res.status(200).json({ message: "Proposal settled successfully" });
        } else {
            res.status(500).json({ error: "Failed to settle proposal" });
        }
    } catch (error) {
        console.log("😒 settle proposal error:", error);
        res.status(500).json({ error: "Failed to settle proposal" });
    }
};

/**
 * Resolve a disputed proposal (admin only)
 */
export const resolve = async (req: Request, res: Response) => {
    try {
        const { questionId, finalValue } = req.body;
        
        if (finalValue !== 1 && finalValue !== -1) {
            return res.status(400).json({ error: "Final value must be 1 (YES) or -1 (NO)" });
        }

        const result = await resolveDispute(questionId, finalValue);
        
        if (result.success) {
            res.status(200).json({ message: "Dispute resolved successfully" });
        } else {
            res.status(500).json({ error: "Failed to resolve dispute" });
        }
    } catch (error) {
        console.log("😒 resolve dispute error:", error);
        res.status(500).json({ error: "Failed to resolve dispute" });
    }
};

/**
 * Finalize market from oracle result
 */
export const finalize = async (req: Request, res: Response) => {
    try {
        const { marketId } = req.body;
        
        const market = await MarketModel.findById(marketId);
        if (!market) {
            return res.status(404).json({ error: "Market not found" });
        }

        const result = await resolveMarket(market.contractMarketId || marketId, true);
        
        if (result.success) {
            // Update market status in DB
            await MarketModel.findByIdAndUpdate(marketId, {
                $set: { marketStatus: "CLOSED" }
            });
            
            res.status(200).json({ message: "Market finalized successfully" });
        } else {
            res.status(500).json({ error: "Failed to finalize market" });
        }
    } catch (error) {
        console.log("😒 finalize market error:", error);
        res.status(500).json({ error: "Failed to finalize market" });
    }
};

/**
 * Get oracle status for a question
 */
export const getOracleStatus = async (req: Request, res: Response) => {
    try {
        const questionId = req.params.questionId as string;
        
        const proposal = await getProposal(questionId);
        const canSettleNow = await canSettle(questionId);
        const canDisputeNow = await canDispute(questionId);
        
        res.status(200).json({
            proposal,
            canSettle: canSettleNow,
            canDispute: canDisputeNow,
        });
    } catch (error) {
        console.log("😒 get oracle status error:", error);
        res.status(500).json({ error: "Failed to get oracle status" });
    }
};

/**
 * Get required bond for caller
 */
export const getBondAmount = async (req: Request, res: Response) => {
    try {
        const address = req.params.address as string;
        
        const bond = await getRequiredBond(address);
        
        res.status(200).json({
            bondAmount: bond,
            bondHbar: bond / 10 ** 8
        });
    } catch (error) {
        console.log("😒 get bond amount error:", error);
        res.status(500).json({ error: "Failed to get bond amount" });
    }
};

/**
 * Legacy feed registration (kept for compatibility)
 */
export const registFeed = async (req: Request, res: Response) => {
    try {
        const { feedName, dataLink, task } = req.body.data;
        // For Hedera, we use OptimisticOracle instead of external feeds
        res.status(200).json({ message: "Feed registration successful!" });
    } catch (error) {
        console.log("😒 error:", error);
        res.status(500).send("Something went wrong fee registration!");
    }
};
