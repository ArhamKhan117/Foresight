"use client";

import React, { useState } from "react";
import Market from "@/components/elements/marketInfo/Market";
import RecentList from "@/components/elements/marketInfo/RecentList";
import MarketCarousel from "@/components/elements/carousel/MarketCarousel";
import { useGlobalContext } from "@/providers/GlobalContext";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

export default function Home() {
  const pathname = usePathname();
  const { setActiveTab } = useGlobalContext();
  const [showRecentActivity, setShowRecentActivity] = useState(true);

  useEffect(() => {
    if (pathname === "/markets") {
      setActiveTab("ACTIVE");
    }
  }, [pathname, setActiveTab]);

  return (
    <div className="self-stretch sm:px-[42px] px-5 flex flex-col justify-start items-start gap-[50px] overflow-auto">
      <div className="self-stretch relative">
        <MarketCarousel />
      </div>
      <div className="self-stretch flex flex-col 2xl:flex-row justify-start items-start gap-6">
        <div className={`w-full min-w-0 ${showRecentActivity ? 'flex-1' : ''}`}>
          <Market showRecentActivity={showRecentActivity} onToggleRecentActivity={() => setShowRecentActivity(!showRecentActivity)} />
        </div>
        {showRecentActivity && (
          <div className="2xl:w-[420px] 2xl:flex-shrink-0 w-full flex flex-col justify-start items-start gap-4 p-5 rounded-2xl bg-[#1a1a1a] border border-[#2a2a2a] 2xl:self-start 2xl:sticky 2xl:top-0 2xl:max-h-[calc(100vh-120px)] 2xl:overflow-y-auto">
            <div className="self-stretch flex justify-between items-center">
              <div className="text-white text-xl font-semibold font-rubik leading-7">
                Recent Activity
              </div>
              <div className="text-[#838587] text-xs font-medium">Live</div>
            </div>
            <div className="w-full h-px bg-[#2a2a2a]" />
            <RecentList />
          </div>
        )}
      </div>
    </div>
  );
}
