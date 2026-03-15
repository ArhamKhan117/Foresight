/**
 * Twitter API v2 Service
 * Fetches tweet metrics using the official Twitter API with Bearer Token auth.
 */
import https from "https";

const TWITTER_API_BASE = "https://api.x.com/2";

export interface TweetMedia {
  type: "photo" | "video" | "animated_gif";
  url: string;
  previewUrl?: string;
}

export interface TweetMetrics {
  tweetId: string;
  text: string;
  authorHandle: string;
  authorName: string;
  authorAvatar: string;
  views: number;
  likes: number;
  retweets: number;
  comments: number;
  createdAt: string;
  media: TweetMedia[];
}

/**
 * Extract tweet ID from various URL formats (twitter.com, x.com, mobile links)
 */
export function extractTweetId(url: string): string | null {
  const patterns = [
    /(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/,
    /status\/(\d+)/,
    /^(\d+)$/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * HTTPS GET with Bearer Token auth for Twitter API v2
 */
function twitterGet(path: string, bearerToken: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = `${TWITTER_API_BASE}${path}`;
    const options = {
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        "User-Agent": "Foresight-PredictionMarket/1.0",
      },
      timeout: 10000,
    };
    const req = https.get(url, options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`Twitter API ${res.statusCode}: ${data}`));
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error("Invalid JSON from Twitter API"));
        }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Twitter API timeout"));
    });
  });
}

/**
 * Fetch tweet data + public metrics from Twitter API v2
 */
export async function fetchTweetData(tweetId: string): Promise<TweetMetrics> {
  const bearerToken = process.env.TWITTER_BEARER_TOKEN;
  if (!bearerToken) {
    throw new Error("TWITTER_BEARER_TOKEN not configured");
  }

  const path = `/tweets/${tweetId}?tweet.fields=public_metrics,created_at,text,attachments&expansions=author_id,attachments.media_keys&user.fields=name,username,profile_image_url&media.fields=type,url,preview_image_url`;
  const response = await twitterGet(path, bearerToken);

  if (!response.data) {
    throw new Error(`Tweet ${tweetId} not found`);
  }

  const tweet = response.data;
  const author = response.includes?.users?.[0];
  const metrics = tweet.public_metrics || {};

  // Parse media from includes
  const mediaItems: TweetMedia[] = [];
  if (response.includes?.media) {
    for (const m of response.includes.media) {
      mediaItems.push({
        type: m.type === "video" ? "video" : m.type === "animated_gif" ? "animated_gif" : "photo",
        url: m.url || m.preview_image_url || "",
        previewUrl: m.preview_image_url || m.url || "",
      });
    }
  }

  return {
    tweetId: tweet.id,
    text: tweet.text || "",
    authorHandle: author?.username || "unknown",
    authorName: author?.name || "Unknown",
    authorAvatar: (author?.profile_image_url || "").replace("_normal", "_400x400"),
    views: metrics.impression_count || 0,
    likes: metrics.like_count || 0,
    retweets: metrics.retweet_count || 0,
    comments: metrics.reply_count || 0,
    createdAt: tweet.created_at || "",
    media: mediaItems,
  };
}

/**
 * Get a specific metric value from tweet data
 */
export function getMetricValue(
  data: TweetMetrics,
  metric: "VIEWS" | "LIKES" | "RETWEETS" | "COMMENTS"
): number {
  switch (metric) {
    case "VIEWS": return data.views;
    case "LIKES": return data.likes;
    case "RETWEETS": return data.retweets;
    case "COMMENTS": return data.comments;
  }
}
