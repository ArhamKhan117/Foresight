import { Request, Response } from "express";
import MarketModel from "../../model/market";
import ReferModel from "../../model/referral";
import UserProfileModel from "../../model/userProfile";
import { getMarketFromChain } from "../../hedera_sdk";

export const getProfileData = async (req: Request, res: Response) => {
    try {
        const { wallet } = req.query;
        
        const results = await MarketModel.find({
            $or: [
                { creator: wallet },
                { "playerA.player": wallet },
                { "playerB.player": wallet },
                { "investors.investor": wallet } 
            ]
        });

        const referrals = await ReferModel.find({
            wallet_refered: wallet
        });

        // Active bets
        const activeBet = results.filter((val) => val.marketStatus === "ACTIVE").length;
        
        // Betting history
        const bettingHistory = results.filter((val) => 
            val.playerA.some(p => p.player === wallet) || 
            val.playerB.some(p => p.player === wallet)
        );
        const totalBet = bettingHistory.length;
        
        // Earnings from bets — sum up HBAR spent on bets from DB
        // Real P&L depends on on-chain token holdings + market outcome,
        // which the frontend fetches directly via getUserTokens()
        let earnedBet = 0;
        for (const market of bettingHistory) {
            const userBetA = market.playerA.filter(p => p.player === wallet).reduce((s, p) => s + p.amount, 0);
            const userBetB = market.playerB.filter(p => p.player === wallet).reduce((s, p) => s + p.amount, 0);
            earnedBet += userBetA + userBetB;
        }

        // Funded markets
        const investList = results.filter((val) => 
            val.investors.some(i => i.investor === wallet)
        );
        
        // Total liquidity provided (from DB records)
        let totalLiquidityProvided = 0;
        for (const m of investList) {
            const userInvest = m.investors.filter(i => i.investor === wallet);
            totalLiquidityProvided += userInvest.reduce((s, i) => s + i.amount, 0);
        }

        // Earned fees from liquidity — try to get from on-chain data
        // For each funded market, fetch accumulatedFees and calculate user's share
        let earnedFeeLiquidity = 0;
        for (const m of investList) {
            try {
                if (!m.market) continue;
                const onChain = await getMarketFromChain(m.market);
                if (!onChain) continue;

                const totalLPShares = Number(onChain.totalLPShares);
                if (totalLPShares === 0) continue;

                // User's share of the pool based on DB investment proportion
                const totalInvested = m.investors.reduce((s: number, i: any) => s + i.amount, 0);
                const userInvested = m.investors.filter((i: any) => i.investor === wallet).reduce((s: number, i: any) => s + i.amount, 0);
                if (totalInvested === 0) continue;

                const userShareRatio = userInvested / totalInvested;
                const accFees = Number(onChain.accumulatedFees) / 1e8; // stored in tinybars, convert to HBAR
                earnedFeeLiquidity += accFees * userShareRatio;
            } catch (e) {
                // If on-chain fetch fails, skip this market
                continue;
            }
        }

        const proposedMarket = results.filter((val) => val.creator === wallet);
        const totalProposedMarket = proposedMarket.length;
        const totalreferrals = referrals.length;
        
        res.status(200).send({ 
            totalProfileValue: totalLiquidityProvided + earnedFeeLiquidity,
            activeBet, 
            totalBet, 
            totalLiquidityProvided, 
            earnedFeeLiquidity,     // now in HBAR (not tinybars)
            earnedBet,              // total HBAR spent on bets
            totalProposedMarket, 
            totalreferrals, 
            bettingHistory, 
            fundedMarkets: investList, 
            proposedMarket 
        });
    } catch (error) {
        console.log("😒 error:", error);
        res.status(500).send("Something went wrong fetching profile Data!");
    }
};


export const getAvatar = async (req: Request, res: Response) => {
    try {
        const { wallet } = req.query;
        if (!wallet) return res.status(400).json({ error: "wallet required" });
        const profile = await UserProfileModel.findOne({ wallet: (wallet as string).toLowerCase() }).lean();
        res.status(200).json({ data: { avatarUrl: profile?.avatarUrl || "" } });
    } catch (error) {
        console.log("Get avatar error:", error);
        res.status(500).json({ error: "Failed to fetch avatar" });
    }
};

export const setAvatar = async (req: Request, res: Response) => {
    try {
        const { wallet, avatarUrl } = req.body;
        if (!wallet || !avatarUrl) return res.status(400).json({ error: "wallet and avatarUrl required" });
        await UserProfileModel.findOneAndUpdate(
            { wallet: wallet.toLowerCase() },
            { avatarUrl, updatedAt: new Date() },
            { upsert: true }
        );
        res.status(200).json({ success: true });
    } catch (error) {
        console.log("Set avatar error:", error);
        res.status(500).json({ error: "Failed to set avatar" });
    }
};

export const getAvatarsBatch = async (req: Request, res: Response) => {
    try {
        const { wallets } = req.query;
        if (!wallets) return res.status(400).json({ error: "wallets required" });
        const walletList = (wallets as string).split(",").map(w => w.toLowerCase());
        const profiles = await UserProfileModel.find({ wallet: { $in: walletList } }).lean();
        const map: Record<string, string> = {};
        for (const p of profiles) map[p.wallet] = p.avatarUrl;
        res.status(200).json({ data: map });
    } catch (error) {
        console.log("Get avatars batch error:", error);
        res.status(500).json({ error: "Failed to fetch avatars" });
    }
};
