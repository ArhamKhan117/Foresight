import { withdraw, settleProposal, canSettle, resolveMarket } from "../../hedera_sdk";
import MarketModel from "../../model/market";

export const execute = async () => {
    try {
        // Find init markets and expire them
        await expireInitData();
        
        // Find pending markets and expire them
        await expirePendingData();
        
        // Find markets ready for settlement and process them
        await processSettlements();
        
        // Find finalized markets and airdrop rewards
        await airdropReward();
    } catch (error) {
        console.log("😒 bot error:", error);
    }
};

/**
 * Delete INIT markets older than 1 day
 */
const expireInitData = async () => {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const result = await MarketModel.deleteMany({
        marketStatus: 'INIT',
        createdAt: { $lt: oneDayAgo.toISOString() }
    });
    
    if (result.deletedCount > 0) {
        console.log(`🗑️ Deleted ${result.deletedCount} expired INIT markets`);
    }
};

/**
 * Process PENDING markets older than 7 days - refund investors
 */
const expirePendingData = async () => {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const pendingMarkets = await MarketModel.find({
        marketStatus: 'PENDING',
        createdAt: { $lt: oneWeekAgo.toISOString() },
    });

    for (const market of pendingMarkets) {
        try {
            // Refund each investor
            for (const investor of market.investors) {
                await withdraw({
                    marketId: market.contractMarketId || market._id.toString(),
                    receiver: investor.investor,
                    amount: investor.amount
                });
                console.log(`💰 Refunded ${investor.amount} to ${investor.investor}`);
            }
            
            // Update market status
            await MarketModel.findByIdAndUpdate(market._id, {
                $set: { marketStatus: 'EXPIRED' }
            });
        } catch (error) {
            console.log(`❌ Error processing expired market ${market._id}:`, error);
        }
    }
};

/**
 * Process markets that can be settled via OptimisticOracle
 */
const processSettlements = async () => {
    const activeMarkets = await MarketModel.find({
        marketStatus: 'ACTIVE',
        oracleRequestId: { $ne: "" }
    });

    for (const market of activeMarkets) {
        try {
            if (market.oracleRequestId) {
                const canSettleNow = await canSettle(market.oracleRequestId);
                
                if (canSettleNow) {
                    // Settle the proposal
                    await settleProposal(market.oracleRequestId);
                    console.log(`✅ Settled proposal for market ${market._id}`);
                    
                    // Finalize the market via resolveMarket
                    await resolveMarket(market.contractMarketId || market._id.toString(), true);
                    
                    // Update DB
                    await MarketModel.findByIdAndUpdate(market._id, {
                        $set: { marketStatus: 'CLOSED' }
                    });
                    console.log(`✅ Finalized market ${market._id}`);
                }
            }
        } catch (error) {
            console.log(`❌ Error processing settlement for market ${market._id}:`, error);
        }
    }
};

/**
 * Process closed markets and calculate rewards
 */
const airdropReward = async () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;

    const result = await MarketModel.find({
        date: { $lte: todayStr },
        marketStatus: 'ACTIVE',
        $or: [   
            { "playerA.0": { $exists: true } },
            { "playerB.0": { $exists: true } }
        ]
    });

    for (const market of result) {
        try {
            // Markets past their resolution date need oracle resolution
            // This is handled by the oracle flow, not automatic
            console.log(`📅 Market ${market._id} is past resolution date, awaiting oracle`);
        } catch (error) {
            console.log(`❌ Error processing market ${market._id}:`, error);
        }
    }
};
