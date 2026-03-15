"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { FaRegClock, FaRegStar } from "react-icons/fa6";
import { MarketDataType } from "@/types/type";
import { getPrices, fetchMultiOutcomeEventInfo } from "@/components/hedera_sdk";
import { getCountDown } from "@/utils";
import { marketField as marketFieldData } from "@/data/data";
import Icon from "../Icons";
import axios from "axios";
import { API_ENDPOINTS } from "@/config/api";

interface MultiOutcomeCardProps {
  eventGroupId: string;
  eventQuestion: string;
  imageUrl: string;
  feedName: string;
  linkBase?: string;
  compact?: boolean;
  date?: string;
  marketFieldIndex?: number;
}

interface OutcomeData {
  _id: string;
  market: string;
  outcomeName: string;
  yesPercent: number;
  totalInvestment: number;
}

const OUTCOME_COLORS = ["#3fd145", "#07b3ff", "#ff6464", "#ffd600", "#c084fc", "#f97316", "#06b6d4", "#ec4899"];

const MultiOutcomeCard: React.FC<MultiOutcomeCardProps> = ({
  eventGroupId,
  eventQuestion,
  imageUrl,
  feedName,
  linkBase,
  compact = false,
  date,
  marketFieldIndex = 0,
}) => {
  const router = useRouter();
  const [outcomes, setOutcomes] = useState<OutcomeData[]>([]);
  const [totalVolume, setTotalVolume] = useState(0);
  const [counter, setCounter] = useState("...");

  // Countdown timer (only for full view)
  useEffect(() => {
    if (!date || compact) return;
    const interval = setInterval(() => {
      setCounter(getCountDown(date));
    }, 1000);
    return () => clearInterval(interval);
  }, [date, compact]);

  useEffect(() => {
    const fetchOutcomes = async () => {
      try {
        const eventInfo = await fetchMultiOutcomeEventInfo(eventGroupId);
        if (eventInfo && eventInfo.outcomes.length > 0) {
          const outcomeData: OutcomeData[] = [];
          let vol = 0;
          const dbRes = await axios.get(
            `${API_ENDPOINTS.MARKET.EVENT_GROUP}?eventGroupId=${eventGroupId}`
          );
          const dbMarkets: MarketDataType[] = dbRes.data.data || [];

          for (let i = 0; i < eventInfo.outcomes.length; i++) {
            const o = eventInfo.outcomes[i];
            const dbMatch = dbMarkets.find(m => m.outcomeIndex === i);
            outcomeData.push({
              _id: dbMatch?._id || `${eventGroupId}_${i}`,
              market: eventGroupId,
              outcomeName: o.name,
              yesPercent: Math.round(o.yesPrice * 100),
              totalInvestment: o.totalVolume,
            });
            vol += o.totalVolume;
          }
          setOutcomes(outcomeData);
          setTotalVolume(vol > 0 ? vol : eventInfo.liquidity);
          return;
        }

        // Fallback: old per-outcome approach
        const res = await axios.get(
          `${API_ENDPOINTS.MARKET.EVENT_GROUP}?eventGroupId=${eventGroupId}`
        );
        const markets: MarketDataType[] = res.data.data;
        const outcomeData: OutcomeData[] = [];
        let vol = 0;
        let anyTraded = false;

        for (const m of markets) {
          let yesPercent = 50;
          if (m.market) {
            try {
              const prices = await getPrices(m.market);
              if (prices) {
                yesPercent = Math.round(prices.yes * 100);
                if (Math.abs(prices.yes - 0.5) > 0.001) anyTraded = true;
              }
            } catch {}
          }
          outcomeData.push({
            _id: m._id,
            market: m.market,
            outcomeName: m.outcomeName || m.question,
            yesPercent,
            totalInvestment: m.totalInvestment || 0,
          });
          vol += m.totalInvestment || 0;
        }

        if (!anyTraded && outcomeData.length > 0) {
          const equalShare = Math.round(100 / outcomeData.length);
          for (const o of outcomeData) o.yesPercent = equalShare;
        }

        setOutcomes(outcomeData);
        setTotalVolume(vol);
      } catch (err) {
        console.error("Error fetching event group:", err);
      }
    };
    fetchOutcomes();
  }, [eventGroupId]);

  if (outcomes.length === 0) return null;

  const visibleOutcomes = outcomes.slice(0, 2);
  const hiddenCount = outcomes.length - 2;

  return (
    <motion.div
      initial={{ opacity: 0, y: compact ? 12 : 32 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{
        scale: compact ? 1.015 : 1.025,
        boxShadow: "0 8px 32px 0 rgba(7,179,255,0.10)",
      }}
      transition={{ duration: compact ? 0.25 : 0.4, ease: "easeOut" }}
      className={`bg-[#1e1e1e] rounded-2xl outline-1 outline-offset-[-1px] shadow-xl/20 outline-[#313131] inline-flex flex-col justify-start items-start cursor-pointer h-fit ${
        compact ? "p-4 gap-3" : "lg:p-6 p-4 lg:gap-6 gap-4"
      }`}
      onClick={() => router.push(`${linkBase || '/market'}/${outcomes[0]._id}`)}
    >
      {/* Header: Image + Category + Question */}
      <div className="self-stretch flex items-start gap-3">
        <img
          className={`rounded-lg flex-shrink-0 object-cover ${compact ? "w-8 h-8" : "lg:w-14 lg:h-14 w-10 h-10"}`}
          src={imageUrl}
          alt={feedName}
        />
        <div className="flex-1 min-w-0">
          {compact ? (
            <div className="text-[#07b3ff] text-xs font-semibold mb-1">{feedName}</div>
          ) : (
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2 lg:text-base text-xs font-semibold font-Inter leading-normal">
                <span className="text-[#07b3ff]">
                  {(marketFieldData[marketFieldIndex] as any)?.displayName || marketFieldData[marketFieldIndex]?.name || "Market"}
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
          )}
          <div className={`text-white font-medium font-rubik leading-tight ${compact ? "text-[13px] line-clamp-2" : "lg:text-xl text-base"}`}>
            {eventQuestion}
          </div>
        </div>
      </div>

      {/* Stats row — full view only */}
      {!compact && (
        <div className="self-stretch grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <div className="text-[#838587] text-sm font-semibold">Volume</div>
            <div className="text-white text-sm font-semibold">{totalVolume.toFixed(1)} HBAR</div>
          </div>
          <div className="flex flex-col gap-1">
            <div className="text-[#838587] text-sm font-semibold">Time Remaining</div>
            <div className="text-[#3fd145] text-sm font-semibold flex items-center gap-1">
              <FaRegClock className="text-[#3fd145]" />
              {counter}
            </div>
          </div>
        </div>
      )}

      {/* Multi-outcome probability bar — full view only */}
      {!compact && outcomes.length > 0 && (() => {
        const totalBlocks = 50;
        const blocks: { color: string; idx: number }[] = [];
        let blockOffset = 0;
        for (let i = 0; i < outcomes.length; i++) {
          const count = i === outcomes.length - 1
            ? totalBlocks - blockOffset
            : Math.round((outcomes[i].yesPercent / 100) * totalBlocks);
          for (let b = 0; b < count && blockOffset + b < totalBlocks; b++) {
            blocks.push({ color: OUTCOME_COLORS[i % OUTCOME_COLORS.length], idx: blockOffset + b });
          }
          blockOffset += count;
        }
        // Find leading outcome
        const lead = outcomes.reduce((a, b) => a.yesPercent >= b.yesPercent ? a : b, outcomes[0]);
        const leadIdx = outcomes.indexOf(lead);
        return (
          <div className="self-stretch flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <div className="text-[#838587] text-sm font-semibold">Percent Chance</div>
              <div className="text-white text-sm font-semibold">{lead.yesPercent}%</div>
            </div>
            <div className="self-stretch flex-1 p-2.5 bg-[#111111] rounded-xl outline-1 outline-offset-[-1px] outline-[#313131] inline-flex justify-start items-center gap-1">
              <div className="w-8 justify-start text-sm font-semibold font-interSemi leading-tight animate-pulse" style={{ color: OUTCOME_COLORS[leadIdx % OUTCOME_COLORS.length] }}>
                {lead.yesPercent}%
              </div>
              <div className="flex-1 self-stretch flex justify-start items-center gap-[3px]">
                {blocks.map((b) => (
                  <div
                    key={b.idx}
                    className="flex-1 self-stretch rounded-[100px] animate-pulse"
                    style={{ backgroundColor: b.color, animationDelay: `${b.idx * 50}ms` }}
                  />
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Outcomes list */}
      <div className="self-stretch flex flex-col gap-2">
        {visibleOutcomes.map((outcome) => (
          <div
            key={outcome._id}
            className={`flex items-center justify-between bg-[#161616] rounded-xl border border-[#262626] hover:border-[#3a3a3a] transition-colors ${
              compact ? "px-3 py-2" : "px-4 py-3"
            }`}
            onClick={(e) => {
              e.stopPropagation();
              router.push(`${linkBase || '/market'}/${outcome._id}`);
            }}
          >
            <span className={`text-white font-medium truncate flex-1 mr-3 ${compact ? "text-sm" : "text-base"}`}>
              {outcome.outcomeName}
            </span>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className={`text-white font-semibold ${compact ? "text-sm" : "text-base"}`}>
                {outcome.yesPercent}%
              </span>
              <div className="flex gap-1">
                <button
                  className={`bg-[#223a25] rounded-lg text-[#3fd145] font-bold ${compact ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs"}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`${linkBase || '/market'}/${outcome._id}`);
                  }}
                >
                  Yes
                </button>
                <button
                  className={`bg-[#3a2222] rounded-lg text-[#ff6464] font-bold ${compact ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs"}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`${linkBase || '/market'}/${outcome._id}`);
                  }}
                >
                  No
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer: more outcomes + volume */}
      <div className="self-stretch flex items-center justify-between">
        {hiddenCount > 0 ? (
          <span className="text-[#07b3ff] text-xs font-medium">
            +{hiddenCount} more outcome{hiddenCount > 1 ? "s" : ""}
          </span>
        ) : (
          <span />
        )}
        {compact && (
          <span className="text-[#838587] text-xs font-medium">
            {totalVolume.toFixed(1)} HBAR Vol.
          </span>
        )}
      </div>
    </motion.div>
  );
};

export default MultiOutcomeCard;
