import mongoose from "mongoose";

const Recent = new mongoose.Schema({
    marketId: { type: String, required: true },
    wallet: { type: String, required: true },
    question: { type: String, default: "" },
    action: { type: String, enum: ["bet_yes", "bet_no", "funded"], required: true },
    amount: { type: Number, default: 0 },
    imageUrl: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now },
});

const RecentModel = mongoose.model("recent", Recent);

export default RecentModel;
