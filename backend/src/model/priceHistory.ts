import mongoose from "mongoose";

const PriceHistorySchema = new mongoose.Schema({
  marketId: { type: String, required: true, index: true },
  yesPrice: { type: Number, required: true },
  noPrice: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now, index: true },
});

// Compound index for efficient queries
PriceHistorySchema.index({ marketId: 1, timestamp: 1 });

const PriceHistoryModel = mongoose.model("priceHistory", PriceHistorySchema);

export default PriceHistoryModel;
