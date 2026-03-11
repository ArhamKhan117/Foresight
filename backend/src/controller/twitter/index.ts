import { Request, Response } from "express";
import { fetchTweetData, extractTweetId } from "../../services/twitterService";

/**
 * GET /api/twitter/tweet/:tweetId
 * Fetch tweet data + metrics from Twitter API v2
 * Accepts either a raw tweet ID or a full tweet URL
 */
export const getTweet = async (req: Request, res: Response) => {
  try {
    const input = String(req.params.tweetId);
    const tweetId = extractTweetId(input) || input;

    if (!tweetId || !/^\d+$/.test(String(tweetId))) {
      return res.status(400).json({ error: "Invalid tweet ID or URL" });
    }

    const data = await fetchTweetData(String(tweetId));
    return res.json({ success: true, data });
  } catch (err: any) {
    console.error("Twitter API error:", err.message);
    return res.status(500).json({ error: err.message || "Failed to fetch tweet" });
  }
};
