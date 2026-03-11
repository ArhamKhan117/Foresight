import mongoose from "mongoose";

const MarketSchema = new mongoose.Schema({
    marketField: { type: Number, required: true },
    apiType: { type: Number, required: true },
    task: { type: String, default: "" },
    creator: { type: String, required: true },
    market: { type: String, default: "" },              // on-chain market ID string
    question: { type: String, required: true },
    value: { type: Number, default: 0 },
    range: { type: Number, default: 0 },
    direction: { type: String, default: "above" },     // "above" or "below" — resolution comparison direction
    date: { type: String, required: true },
    marketStatus: { type: String, required: true },
    feedName: { type: String, required: true },
    feedId: { type: String, default: "" },             // API-fetchable identifier (CoinGecko coin id or DexScreener token address)
    imageUrl: { type: String, default: "/fund.png" },
    description: { type: String, default: "" },
    isYes: { type: Boolean, default: false },           // resolution result

    // Legacy fields — kept optional for backward compat with old markets
    tokenA: { type: String, default: "" },
    tokenB: { type: String, default: "" },
    initAmount: { type: Number, default: 0 },
    tradingAmountA: { type: Number, default: 0 },
    tradingAmountB: { type: Number, default: 0 },
    tokenAPrice: { type: Number, default: 0 },
    tokenBPrice: { type: Number, default: 0 },
    feedkey: { type: String, default: "" },
    feed: { type: String, default: "" },

    // Bet tracking (DB-side, real positions are on-chain)
    playerA: {
        type:[{
            player: { type: String, required: true },
            amount: { type: Number, required: true }
        }],
        default: []
    },
    playerB: {
        type:[{
            player: { type: String, required: true },
            amount: { type: Number, required: true }
        }],
        default: []
    },
    // LP tracking (DB-side, real LP data is on-chain)
    investors: {
        type: [{
            investor: { type: String, required: true },
            amount: { type: Number, required: true }
        }],
        default: []
    },

    // Hedera contract fields
    contractMarketId: { type: String, default: "" },
    oracleRequestId: { type: String, default: "" },
    htsTokenA: { type: String, default: "" },
    htsTokenB: { type: String, default: "" },

    // HCS (Hedera Consensus Service) audit trail topic
    hcsTopicId: { type: String, default: "" },

    // Bet count (every individual bet transaction)
    totalBets: { type: Number, default: 0 },

    // Market tag: "normal" (default), "demo" (manual resolution), "test" (auto resolution, short timer)
    marketTag: { type: String, default: "normal" },

    // Multi-outcome market fields
    marketType: { type: String, default: "binary", enum: ["binary", "multi"] }, // "binary" = Yes/No, "multi" = multiple outcomes
    eventGroupId: { type: String, default: "" },       // Shared ID linking all outcomes in a multi-outcome event
    eventQuestion: { type: String, default: "" },       // The parent event question (e.g. "Who will win the Super Bowl?")
    outcomeName: { type: String, default: "" },         // This outcome's name (e.g. "Chiefs", "Eagles")
    outcomeIndex: { type: Number, default: 0 },         // Order index within the event

    createdAt: { type: Date, default: Date.now }
});

const MarketModel = mongoose.model("market", MarketSchema);

export default MarketModel;
