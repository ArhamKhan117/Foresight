import { Request, Response } from "express";
import CommentModel from "../../model/comment";

export const getComments = async (req: Request, res: Response) => {
  try {
    const { marketId } = req.query;
    if (!marketId) return res.status(400).json({ error: "marketId required" });
    const comments = await CommentModel.find({ marketId: marketId as string })
      .sort({ createdAt: 1 })
      .lean();
    res.status(200).json({ data: comments });
  } catch (error) {
    console.log("Get comments error:", error);
    res.status(500).json({ error: "Failed to fetch comments" });
  }
};

export const addComment = async (req: Request, res: Response) => {
  try {
    const { marketId, wallet, text, parentId } = req.body;
    if (!marketId || !wallet || !text?.trim()) {
      return res.status(400).json({ error: "marketId, wallet, and text required" });
    }
    const comment = new CommentModel({
      marketId,
      wallet,
      text: text.trim(),
      parentId: parentId || null,
    });
    const saved = await comment.save();
    res.status(200).json({ data: saved });
  } catch (error) {
    console.log("Add comment error:", error);
    res.status(500).json({ error: "Failed to add comment" });
  }
};
