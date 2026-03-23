"use client";

import React, { useEffect, useState } from "react";
import { FaRegStar } from "react-icons/fa6";
import Icon from "../Icons";
import { GiAlarmClock } from "react-icons/gi";
import { useRouter } from "next/navigation";
import { getCountDown } from "@/utils";
import { marketField as marketFieldData } from "@/data/data";
import { motion } from "framer-motion";
import { fetchMultiOutcomeEventInfo } from "@/components/hedera_sdk";
import { MarketDataType } from "@/types/type";
import axios from "axios";
import { API_ENDPOINTS } from "@/config/api";

interface MultiOutcomePendingCardProps {
  eventGroupId: string;
  eventQuestion: string;
  imageUrl: string;
  feedName: string;
  date: string;
  marketFieldIndex: number;
  linkBase?: string;
}

interface OutcomeDisplay {
  _id: string;
  name: string;
  yesPercent: number;
}

const MultiOutcomePendingCard: React.FC<MultiOutcomePendingCardProps> = ({
  eventGroupId,
  eventQuestion,
  imageUrl,
  feedName,
  date,
  marketFieldIndex,
  linkBase,
}) => {
  const router = useRouter();
  const [counter, setCounter] = useState("...");
  const [liquidityGoal, setLiquidityGoal] = useState<number | null>(null);
  const [currentLiquidity, setCurrentLiquidity] = useState<number | null>(null);
  const [outcomesDisplay, setOutcomesDisplay] = useState<OutcomeDisplay[]>([]);
  const [firstMarketId, setFirstMarketId] = useState<string>("");
  const isExpired = new Date(date).getTime() <= Date.now();

  useEffect(() => {
    const interval = setInterval(() => {
      setCounter(getCountDown(date));
    }, 1000);
    return () => clearInterval(interval);
  }, [date]);

  // Fetch on-chain event info + DB outcomes
  useEffect(() => {
    const load = async () => {
      try {
        // DB outcomes for IDs
        const dbRes = await axios.get(
          `${API_ENDPOINTS.MARKET.EVENT_GROUP}?eventGroupId=${eventGroupId}`
        );
        const dbMarkets: MarketDataType[] = dbRes.data.data || [];
        if (dbMarkets.length > 0) setFirstMarketId(dbMarkets[0]._id);

        // Try new contract
        const info = await fetchMultiOutcomeEventInfo(eventGroupId);
        if (info) {
          setLiquidityGoal(info.liquidityGoal);
          setCurrentLiquidity(info.liquidity);
          setOutcomesDisplay(
            info.outcomes.map((o: any, i: number) => ({
              _id: dbMarkets[i]?._id || `${eventGroupId}_${i}`,
              name: o.name,
              yesPercent: Math.round(o.yesPrice * 100),
            }))
          );
        } else {
          // Fallback: just use DB data, normalize to 1/N
          const equalShare = dbMarkets.length > 0 ? Math.round(100 / dbMarkets.length) : 50;
          setOutcomesDisplay(
            dbMarkets.map((m) => ({
              _id: m._id,
              name: m.outcomeName || m.question,
              yesPercent: equalShare,
            }))
          );
          // Use DB totalInvestment as fallback for funding display
          if (dbMarkets.length > 0) {
            const totalFunding = dbMarkets.reduce((sum, m) => sum + (m.totalInvestment || 0), 0);
            if (totalFunding > 0) {
              setCurrentLiquidity(totalFunding);
            }
          }
        }
      } catch (e) {
        console.error("Error loading multi-outcome pending card:", e);
      }
    };
    load();
  }, [eventGroupId]);

  const loaded = liquidityGoal !== null;
  const displayLiquidity = currentLiquidity ?? 0;
  const displayGoal = liquidityGoal ?? 0;
  const percent = loaded && displayGoal > 0 ? Math.min(1, displayLiquidity / displayGoal) : 0;
  const filledSegments = Math.round(percent * 20);

  const handleClick = () => {
    router.push(`${linkBase || "/fund"}/${firstMarketId || eventGroupId}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.025, boxShadow: "0 8px 32px 0 rgba(7,179,255,0.10)" }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="lg:p-6 p-4 bg-[#1e1e1e] rounded-2xl outline-1 outline-offset-[-1px] shadow-xl/20 outline-[#313131] flex flex-col justify-start items-start lg:gap-5 gap-4 cursor-pointer h-full"
      onClick={handleClick}
    >
      {/* Header: Image + Category + Question */}
      <div className="self-stretch flex items-start gap-3">
        <img
          className="lg:w-14 lg:h-14 w-12 h-12 rounded-lg flex-shrink-0 object-contain"
          src={imageUrl}
          alt={feedName}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 lg:text-base text-xs font-semibold font-Inter leading-normal">
              <span className="text-[#07b3ff]">
                {(marketFieldData[marketFieldIndex] as any)?.displayName || marketFieldData[marketFieldIndex]?.name || "Crypto"}
                <span className="text-[#838587] text-[11px] font-normal ml-1">• Multi-Outcome</span>
              </span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="flex items-center gap-1">
                <div className="w-5 h-5 relative overflow-hidden"><Icon name="Message" /></div>
                <div className="text-[#838587] text-sm font-semibold font-interSemi leading-tight">0</div>
              </div>
              <div className="lg:w-5 lg:h-5 w-4 h-4 relative overflow-hidden"><FaRegStar className="text-white" /></div>
            </div>
          </div>
          <div className="text-white lg:text-xl text-lg font-medium font-rubik leading-tight">
            {eventQuestion}
          </div>
        </div>
      </div>

      {/* Outcomes list — show top 2, collapse rest */}
      <div className="self-stretch flex flex-col gap-2">
        {outcomesDisplay.slice(0, 2).map((o) => (
          <div
            key={o._id}
            className="flex items-center justify-between px-3 py-2 bg-[#161616] rounded-xl border border-[#262626]"
          >
            <span className="text-white text-sm font-medium truncate flex-1 mr-3">{o.name}</span>
            <span className="text-[#838587] text-sm font-semibold">{o.yesPercent}%</span>
          </div>
        ))}
        {outcomesDisplay.length > 2 && (
          <span className="text-[#07b3ff] text-xs font-medium px-1">
            +{outcomesDisplay.length - 2} more outcome{outcomesDisplay.length - 2 > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Funding + Time stats */}
      <div className="self-stretch flex justify-between items-start gap-4">
        <div className="flex flex-col gap-1 w-1/2">
          <div className="text-[#838587] text-sm font-semibold">Funding</div>
          <div className="text-white text-sm font-semibold">
            {loaded ? `${displayLiquidity.toFixed(2)} / ${displayGoal} HBAR` : "— / — HBAR"}
          </div>
        </div>
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
          <div className="mt-2 flex items-center gap-2 w-full max-w-[180px]">
            <span className="text-[#3fd145] text-xs font-semibold min-w-[38px] text-right">
              {Math.min(100, Math.floor(percent * 100))}%
            </span>
            <div className="flex-1 flex items-center gap-[3px] h-[12px]">
              {Array.from({ length: 20 }).map((_, idx) => {
                const isFilled = idx < filledSegments;
                let fillColor = "#555555";
                if (isFilled) {
                  if (percent <= 0.33) fillColor = "#ff6464";
                  else if (percent <= 0.69) fillColor = "#ffd600";
                  else fillColor = "#3fd145";
                }
                return (
                  <div
                    key={idx}
                    className="h-full w-full max-w-[7px] rounded-[2px]"
                    style={{ background: fillColor }}
                  />
                );
              })}
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
          onClick={handleClick}
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

export default MultiOutcomePendingCard;
