"use client";

import FundCard from "@/components/elements/fund/FundCard";
import Market from "@/components/elements/marketInfo/Market";
import { useGlobalContext } from "@/providers/GlobalContext";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import axios from "axios";
import { API_ENDPOINTS } from "@/config/api";
import { MarketDataType } from "@/types/type";
import { getCountDown } from "@/utils";
import { fetchMarketInfo } from "@/components/hedera_sdk";

export default function FundMarket() {
  const pathname = usePathname();
  const { setActiveTab } = useGlobalContext();
  const [featuredMarket, setFeaturedMarket] = useState<MarketDataType | null>(null);
  const [countdown, setCountdown] = useState("Loading...");
  const [liquidityGoal, setLiquidityGoal] = useState<number | null>(null);
  const [currentLiquidity, setCurrentLiquidity] = useState<number | null>(null);

  useEffect(() => {
    if (pathname === "/fund") {
      setActiveTab("PENDING");
    }
  }, [pathname, setActiveTab]);

  // Fetch the first pending market for the featured card
  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(`${API_ENDPOINTS.MARKET.GET}?page=1&limit=1&marketStatus=PENDING`);
        if (res.data.data && res.data.data.length > 0) {
          setFeaturedMarket(res.data.data[0]);
        }
      } catch (error) {
        console.error("Error fetching featured market:", error);
      }
    })();
  }, []);

  // Update countdown timer
  useEffect(() => {
    if (!featuredMarket) return;
    const interval = setInterval(() => {
      setCountdown(getCountDown(featuredMarket.date));
    }, 1000);
    return () => clearInterval(interval);
  }, [featuredMarket]);

  // Fetch on-chain liquidityGoal for featured market
  useEffect(() => {
    if (!featuredMarket?.market) return;
    (async () => {
      const info = await fetchMarketInfo(featuredMarket.market);
      if (info) {
        setLiquidityGoal(info.liquidityGoal);
        setCurrentLiquidity(info.liquidity);
      }
    })();
  }, [featuredMarket?.market]);

  return (
    <div className="self-stretch sm:px-[40px] px-5 flex flex-col justify-start items-start gap-[50px] overflow-auto">
      {featuredMarket ? (
        <FundCard
          title={featuredMarket.question}
          description={featuredMarket.description || "Fund this market to help it become active!"}
          category={featuredMarket.feedName}
          imageUrl={featuredMarket.imageUrl || "/fund.png"}
          votes={0}
          currentFunding={currentLiquidity}
          liquidityGoal={liquidityGoal}
          expiresIn={countdown}
          marketId={featuredMarket._id}
          marketFieldIndex={featuredMarket.marketField}
        />
      ) : (
        <div className="w-full p-8 bg-[#1e1e1e] rounded-2xl text-center">
          <h2 className="text-white text-2xl font-medium mb-4">No Pending Markets</h2>
          <p className="text-[#838587]">Create a new market at /propose to get started!</p>
        </div>
      )}
      <Market linkBase="/fund" />
    </div>
  );
}
