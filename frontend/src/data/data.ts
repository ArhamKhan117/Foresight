import { IconName } from "@/components/elements/Icons/Icons";
import type { Metadata } from "next";

export const marketCarouselItems = [
  {
    category: "Cryptocurrency",
    title: "Will Bitcoin hit 120k by the end of the month?",
    bgImage: "https://assets.coingecko.com/coins/images/1/large/bitcoin.png",
    mainImage: "https://assets.coingecko.com/coins/images/1/small/bitcoin.png",
    overlayImage: "https://assets.coingecko.com/coins/images/1/thumb/bitcoin.png",
    volume: "$2.5M",
    timeLeft: "3d 12h",
    yesPercentage: 68,
    comments: 245
  },
  {
    category: "Sports Betting",
    title: "Which NFL team will win the Super Bowl in 2025?",
    bgImage: "https://upload.wikimedia.org/wikipedia/en/thumb/a/a2/National_Football_League_logo.svg/1200px-National_Football_League_logo.svg.png",
    mainImage: "https://upload.wikimedia.org/wikipedia/en/thumb/a/a2/National_Football_League_logo.svg/1200px-National_Football_League_logo.svg.png",
    overlayImage: "https://upload.wikimedia.org/wikipedia/en/thumb/a/a2/National_Football_League_logo.svg/1200px-National_Football_League_logo.svg.png",
    volume: "$1.8M",
    timeLeft: "5d 8h",
    yesPercentage: 45,
    comments: 189
  },
  {
    category: "Crypto",
    title: "Will Ethereum reach $5,000 before 2025?",
    bgImage: "https://assets.coingecko.com/coins/images/279/large/ethereum.png",
    mainImage: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
    overlayImage: "https://assets.coingecko.com/coins/images/279/thumb/ethereum.png",
    volume: "$3.2M",
    timeLeft: "2d 15h",
    yesPercentage: 72,
    comments: 312
  },
  {
    category: "Crypto",
    title: "Will Hedera reach $1 in 2026?",
    bgImage: "https://assets.coingecko.com/coins/images/3688/large/hbar.png",
    mainImage: "https://assets.coingecko.com/coins/images/3688/small/hbar.png",
    overlayImage: "https://assets.coingecko.com/coins/images/3688/thumb/hbar.png",
    volume: "$1.5M",
    timeLeft: "4d 6h",
    yesPercentage: 55,
    comments: 178
  },
  {
    category: "Sports Betting",
    title: "Will Manchester City win the Champions League?",
    bgImage: "https://resources.premierleague.com/premierleague/badges/50/t43.png",
    mainImage: "https://resources.premierleague.com/premierleague/badges/50/t43.png",
    overlayImage: "https://resources.premierleague.com/premierleague/badges/50/t43.png",
    volume: "$2.1M",
    timeLeft: "6d 9h",
    yesPercentage: 62,
    comments: 234
  }
];

export const categories = [
  { name: "Trending", active: true, icon: "Trending" as IconName, color: "#07b3ff" },
  { name: "Sports", active: false, icon: "Sports" as IconName, color: "#838587" },
  { name: "Crypto", active: false, icon: "Crypto" as IconName, color: "#838587" },
  { name: "News", active: false, icon: "News" as IconName, color: "#838587" },
  { name: "Tweets", active: false, icon: "Tweets" as IconName, color: "#838587" },
  { name: "Closed", active: false, icon: "Closed" as IconName, color: "#838587" },
];

import { API_URL } from "../config/api";

export const url = API_URL + "/";

export const metadata: Metadata = {
  title: "Hedera Prediction Market",
  description: "Decentralized Prediction Market on Hedera",
};

export const ranges = [
  "Small",
  "Exact",
  "Near",
  "Bigger"
];

export const marketField = [
  {
    name: "Coin Prediction Market",
    displayName: "Crypto",
    freeText: false,
    content: [
      {
        api_name: "CoinGecko",
        needed_data: [
          {
            name: "feedName",
            placeholder: "Search token (e.g. Bitcoin, ETH...)"
          }
        ],
        task: (index: number, rang: number) => "null",
        api_link: (...args: any[]) => args[1] ? `https://api.coingecko.com/api/v3/coins/markets?ids=${args[0]}&vs_currency=usd` : `https://api.coingecko.com/api/v3/simple/price?ids=${args[0]}&vs_currencies=usd`,
        market_keyword: (...args: string[]) => `id: ${args[0]}, vs_currency: usd`,
      },
      {
        api_name: "Dexscreener",
        needed_data: [
          {
            name: "feedName",
            placeholder: "Search token name or ticker..."
          }
        ],
        task: (index: number, rang: number) => rang ? `$.pairs[${index}].marketCap` : `$.pairs[${index}].priceUsd`,
        api_link: (...args: any[]) => `https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(args[0])}`,
        market_keyword: (...args: string[]) => `token: ${args[0]}`,
      }
    ]
  },
  {
    name: "Sports Prediction Market",
    displayName: "Sports",
    freeText: true,
    content: [
      { api_name: "NBA" },
      { api_name: "NFL" },
      { api_name: "MLB" },
      { api_name: "Soccer" },
      { api_name: "MMA" },
      { api_name: "Other" },
    ]
  },
  {
    name: "News Prediction Market",
    displayName: "News",
    freeText: true,
    content: [
      { api_name: "Politics" },
      { api_name: "Tech" },
      { api_name: "World" },
      { api_name: "Economy" },
      { api_name: "Other" },
    ]
  },
  {
    name: "Tweet Prediction Market",
    displayName: "Tweets",
    freeText: false,
    isTweet: true,
    content: [
      { api_name: "Views", metric: "VIEWS", presets: [100000, 500000, 1000000, 5000000] },
      { api_name: "Likes", metric: "LIKES", presets: [5000, 10000, 50000, 100000] },
      { api_name: "Retweets", metric: "RETWEETS", presets: [1000, 5000, 10000, 50000] },
      { api_name: "Comments", metric: "COMMENTS", presets: [500, 1000, 5000, 10000] },
    ]
  }
];

// Market config for Polymarket-style LMSR on Hedera
// Pricing is handled by LMSR on-chain, no tokenAmount/tokenPrice needed
export const marketConfig = {
  defaultLiquidityGoal: 100, // 100 HBAR default
};
