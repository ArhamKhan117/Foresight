import React, { useEffect, useState } from 'react';
import RecentItem from './RecentItem';
import axios from 'axios';
import { API_ENDPOINTS } from '@/config/api';

interface RecentData {
  wallet: string;
  question: string;
  action: "bet_yes" | "bet_no" | "funded";
  amount: number;
  imageUrl: string;
  createdAt: string;
}

const demoItems = [
  { question: "Will Bitcoin hit $150k by end of 2026?", timeAgo: "5m", userName: "CryptoWhale", action: "bought", price: "25 HBAR", imageSrc: "", status: "yes" as const, marketImage: "https://assets.coingecko.com/coins/images/1/small/bitcoin.png" },
  { question: "Will the NFL season break viewership records?", timeAgo: "12m", userName: "DeFiDegen", action: "bought", price: "50 HBAR", imageSrc: "", status: "no" as const, marketImage: "https://upload.wikimedia.org/wikipedia/en/thumb/a/a2/National_Football_League_logo.svg/1200px-National_Football_League_logo.svg.png" },
  { question: "Will Hedera reach $1 in 2026?", timeAgo: "18m", userName: "HBARMaxi", action: "added liquidity", price: "100 HBAR", imageSrc: "", status: "funded" as const, marketImage: "https://assets.coingecko.com/coins/images/3688/small/hbar.png" },
];

// Generate a deterministic color from a wallet address
const walletColor = (addr: string): string => {
  let hash = 0;
  for (let i = 0; i < addr.length; i++) hash = addr.charCodeAt(i) + ((hash << 5) - hash);
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 65%, 55%)`;
};

const truncateWallet = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

const timeAgo = (dateStr: string): string => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
};

const RecentList: React.FC = () => {
  const [realItems, setRealItems] = useState<RecentData[]>([]);

  useEffect(() => {
    const fetchRecent = async () => {
      try {
        const res = await axios.get(`${API_ENDPOINTS.RECENT.GET}?limit=15`);
        if (res.data?.data) setRealItems(res.data.data);
      } catch { /* silent */ }
    };
    fetchRecent();
    const interval = setInterval(fetchRecent, 30000);
    return () => clearInterval(interval);
  }, []);

  const mappedReal = realItems.map((item) => ({
    question: item.question || "Prediction Market",
    timeAgo: timeAgo(item.createdAt),
    userName: truncateWallet(item.wallet),
    action: item.action === "funded" ? "added liquidity" : "bought",
    price: `${item.amount.toFixed(1)} HBAR`,
    imageSrc: "", // will use avatar
    status: (item.action === "bet_yes" ? "yes" : item.action === "bet_no" ? "no" : "funded") as "yes" | "no" | "funded",
    walletColor: walletColor(item.wallet),
    marketImage: item.imageUrl,
  }));

  // Show real items first, then pad with demo items if needed
  const allItems = [...mappedReal, ...demoItems.map(d => ({ ...d, walletColor: "" }))].slice(0, 15);

  return (
    <div className="self-stretch rounded-2xl flex flex-col justify-start items-start gap-2">
      {allItems.map((item, index) => (
        <RecentItem key={index} {...item} />
      ))}
    </div>
  );
};

export default RecentList;
