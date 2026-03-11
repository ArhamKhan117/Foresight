import mongoose from "mongoose";

const CommentSchema = new mongoose.Schema({
  marketId: { type: String, required: true, index: true },
  wallet: { type: String, required: true },
  text: { type: String, required: true },
  parentId: { type: String, default: null }, // null = top-level, otherwise reply to this comment _id
  createdAt: { type: Date, default: Date.now },
});

CommentSchema.index({ marketId: 1, createdAt: -1 });

const CommentModel = mongoose.model("comment", CommentSchema);

export default CommentModel;
