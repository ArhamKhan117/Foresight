"use client";

import React, { useEffect, useState } from "react";
import { FaRegStar } from "react-icons/fa6";
import Icon from "../Icons";
import { GiAlarmClock } from "react-icons/gi";
import { useRouter } from "next/navigation";
import { elipsKey, getCountDown, formatFeedLabel } from "@/utils";
import { marketField as marketFieldData } from "@/data/data";
import { motion } from "framer-motion";
import { fetchMarketInfo } from "@/components/hedera_sdk";

interface PendingCardProps {
  category: string;
  question: string;
  volume: number;
  timeLeft: string;
  comments: number;
  imageUrl: string;
  index: number;
  marketId: string;
  onChainMarketId?: string; // the string market ID for on-chain lookup
  marketFieldIndex?: number; // 0=Crypto, 1=Sports, 2=News
}

const PendingCard: React.FC<PendingCardProps> = ({
  index,
  category,
  question,
  comments,
  imageUrl,
  volume,
  timeLeft,
  marketId,
  onChainMarketId,
  marketFieldIndex,
}) => {
  const router = useRouter();
  const [counter, setCounter] = useState("7d : 6h : 21m : 46s");
  const [liquidityGoal, setLiquidityGoal] = useState<number | null>(null);
  const [currentLiquidity, setCurrentLiquidity] = useState<number | null>(null);
  const isExpired = new Date(timeLeft).getTime() <= Date.now();

  useEffect(() => {
    const interval = setInterval(() => {
      setCounter(getCountDown(timeLeft));
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLeft]);

  // Fetch on-chain liquidityGoal
  useEffect(() => {
    if (!onChainMarketId) return;
    (async () => {
      const info = await fetchMarketInfo(onChainMarketId);
      if (info) {
        setLiquidityGoal(info.liquidityGoal);
        setCurrentLiquidity(info.liquidity);
      }
    })();
  }, [onChainMarketId]);

  const loaded = liquidityGoal !== null;
  const displayLiquidity = currentLiquidity ?? 0;
  const displayGoal = liquidityGoal ?? 0;
  const percent = loaded && displayGoal > 0 ? Math.min(1, displayLiquidity / displayGoal) : 0;
  const filledSegments = Math.round(percent * 20);

  const handleDetailClick = () => {
    router.push(`/fund/${marketId}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.025, boxShadow: "0 8px 32px 0 rgba(7,179,255,0.10)" }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="lg:p-6 p-4 bg-[#1e1e1e] rounded-2xl outline-1 outline-offset-[-1px] shadow-xl/20 outline-[#313131] flex flex-col justify-start items-start lg:gap-6 gap-4 cursor-pointer h-full"
      onClick={handleDetailClick}
    >
      <div className="self-stretch flex-1 flex flex-col justify-start items-start gap-4">
        <div className="self-stretch flex items-start gap-3">
          <img className="lg:w-14 lg:h-14 w-12 h-12 rounded-lg flex-shrink-0 object-cover" src={imageUrl} alt={category} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2 lg:text-base text-xs font-semibold font-Inter leading-normal">
                <span className="text-[#07b3ff]">
                  {(marketFieldData[marketFieldIndex ?? 0] as any)?.displayName || marketFieldData[marketFieldIndex ?? 0]?.name || "Crypto"}
                  {(marketFieldData[marketFieldIndex ?? 0] as any)?.freeText && category && (
                    <span className="text-[#838587] text-[11px] font-normal ml-1">{`• ${category}`}</span>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="flex items-center gap-1">
                  <div className="w-5 h-5 relative overflow-hidden"><Icon name="Message" /></div>
                  <div className="text-[#838587] text-sm font-semibold font-interSemi leading-tight">{comments}</div>
                </div>
                <div className="lg:w-5 lg:h-5 w-4 h-4 relative overflow-hidden"><FaRegStar className="text-white" /></div>
              </div>
            </div>
            <div className="text-white lg:text-xl text-lg font-medium font-rubik leading-tight">
              {question}
            </div>
          </div>
        </div>
        {/* Market Stats */}
        <div className="self-stretch flex justify-between items-start gap-4">
          {/* Left: Funding info */}
          <div className="flex flex-col gap-1 w-1/2">
            <div className="text-[#838587] text-sm font-semibold">Funding</div>
            <div className="text-white text-sm font-semibold">{loaded ? `${displayLiquidity.toFixed(2)} / ${displayGoal} HBAR` : "— / — HBAR"}</div>
            <div className="text-[#838587] text-xs font-semibold"></div>
          </div>
          {/* Right: Time Remaining and Progress Bar */}
          <div className="flex flex-col gap-1 items-end w-full">
            <div className="text-[#838587] text-sm font-semibold">Time Remaining</div>
            {isExpired ? (
              <div className="text-[#ff6464] text-sm font-semibold flex items-center gap-1">
                <GiAlarmClock className="text-[#ff6464]" />
                Expired
              </div>
            ) : (
              <div className="text-[#3fd145] text-sm font-semibold flex items-center gap-1">
                <GiAlarmClock className="text-[#3fd145]" />
                {counter}
              </div>
            )}
            {/* Progress Bar */}
            <div className="mt-2 flex items-center gap-2 w-full max-w-[180px]">
              <span className="text-[#3fd145] text-xs font-semibold min-w-[38px] text-right">
                {Math.min(100, Math.floor(percent * 100))}%
              </span>
              <div className="flex-1 flex items-center gap-[3px] h-[12px]">
                {Array.from({ length: 20 }).map((_, index) => {
                  const isFilled = index < filledSegments;
                  let fillColor = '#555555';
                  if (isFilled) {
                    if (percent <= 0.33) fillColor = '#ff6464';
                    else if (percent <= 0.69) fillColor = '#ffd600';
                    else fillColor = '#3fd145';
                  }
                  return (
                    <div
                      key={index}
                      className="h-full w-full max-w-[7px] rounded-[2px]"
                      style={{ background: fillColor }}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Fund Button */}
      {isExpired ? (
        <div className="self-stretch mt-auto px-4 py-2.5 bg-[#2a2a2a] rounded-2xl flex justify-center items-center gap-2">
          <span className="text-[#838587] text-lg font-bold font-satoshi leading-7">Expired</span>
        </div>
      ) : (
        <button
          className="self-stretch mt-auto px-4 py-2.5 bg-[#182c3a] outline outline-[#3fa9f5] rounded-2xl cursor-pointer hover:bg-[#20405a] transition-all duration-200 flex justify-center items-center gap-2"
          onClick={handleDetailClick}
        >
          <span className="w-5 h-5 flex items-center justify-center">
            <Icon name="FundMarket" color="#3fa9f5" />
          </span>
          <span className="text-[#3fa9f5] text-lg font-bold font-satoshi leading-7">Fund now</span>
        </button>
      )}
    </motion.div>
  );
};

export default PendingCard;
