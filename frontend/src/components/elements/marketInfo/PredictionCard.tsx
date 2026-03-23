"use client";

import React, { useEffect } from "react";
import { FaRegClock, FaRegStar } from "react-icons/fa6";
import { FaCheckCircle } from "react-icons/fa";
import Icon from "../Icons";
import ProgressBar from "./ProgressBar";
import { useState } from "react";
import { elipsKey, getCountDown, formatFeedLabel } from "@/utils";
import { marketField as marketFieldData } from "@/data/data";
import { useGlobalContext } from "@/providers/GlobalContext";
import { marketBetting, getPrices } from "@/components/hedera_sdk";
import { useMetaMask } from "@/providers/MetaMaskProvider";
import { errorAlert, infoAlert } from "../ToastGroup";
import { useRouter } from "next/navigation";
import axios from "axios";
import { MarketDataType } from "@/types/type";
import { motion } from "framer-motion";
import { API_ENDPOINTS } from "@/config/api";

// Define types for the props
interface PredictionCardProps {
  index: number,
  currentPage: number,
  linkBase?: string
}

const PredictionCard: React.FC<PredictionCardProps> = ({
  index,
  currentPage,
  linkBase
}) => {
  const { markets, formatMarketData } = useGlobalContext(); // Use Global Context
  const { isConnected, address, signer } = useMetaMask();
  const router = useRouter()
  const [counter, setCounter] = useState("7d : 6h : 21m : 46s");
  const [yesPercent, setYesPercent] = useState(50);

  // Fetch on-chain prices for accurate probability
  useEffect(() => {
    if (!markets[index]?.market) return;
    const load = async () => {
      const prices = await getPrices(markets[index].market);
      if (prices) setYesPercent(Math.round(prices.yes * 100));
    };
    load();
  }, [markets[index]?.market]);

  useEffect(() => {
    const interval = setInterval(() => {
      let remainTime: string = getCountDown(markets[index].date);
      setCounter(remainTime);
    }, 1000);

    return () => clearInterval(interval);
  }, [])

  const onVote = async (isYes: boolean, token: string) => {
    try {
      if (!isConnected || !signer) {
        errorAlert("Please connect wallet!");
        return
      }
      const result = await marketBetting({
        marketId: markets[index].market,
        amount: 1,
        isYes: isYes,
        signer: signer,
      });

      const res = await axios.post(API_ENDPOINTS.MARKET.BETTING, {
        player: address,
        market_id: markets[index]._id,
        amount: 1,
        isYes,
        currentPage,
        ...result
      });

      if (res.status === 200) {
        infoAlert("Successfully betted!");
        const marketData = await axios.get(`${API_ENDPOINTS.MARKET.GET}?page=${currentPage}&limit=10&marketStatus=ACTIVE&marketField=0`);
        formatMarketData(marketData.data.data);
      }
    } catch (error) {
      console.log(error);
      errorAlert("Betting Failed!")
    }
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.025, boxShadow: "0 8px 32px 0 rgba(7,179,255,0.10)" }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="lg:p-6 p-4 bg-[#1e1e1e] rounded-2xl outline-1 outline-offset-[-1px] shadow-xl/20 outline-[#313131] inline-flex flex-col justify-start items-start lg:gap-6 gap-4 cursor-pointer"
      onClick={() => router.push(`${linkBase || '/market'}/${markets[index]._id}`)}
    >
      <div className="self-stretch flex flex-col justify-start items-start gap-2">
        <div className="self-stretch flex items-start gap-3">
          <img className="lg:w-14 lg:h-14 w-12 h-12 rounded-lg flex-shrink-0 object-contain" src={markets[index].imageUrl} alt={markets[index].feedName} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2 lg:text-base text-xs font-semibold font-Inter leading-normal">
                <span className="text-[#07b3ff]">
                  {(marketFieldData[markets[index].marketField] as any)?.displayName || marketFieldData[markets[index].marketField]?.name || "Crypto"}
                  {(marketFieldData[markets[index].marketField] as any)?.freeText && markets[index].feedName && (
                    <span className="text-[#838587] text-[11px] font-normal ml-1">{`• ${markets[index].feedName}`}</span>
                  )}
                  {(marketFieldData[markets[index].marketField] as any)?.isTweet && markets[index].feedName && (
                    <span className="text-[#838587] text-[11px] font-normal ml-1">{`• ${markets[index].feedName.includes("·") ? markets[index].feedName.split("·").pop()?.trim() : markets[index].feedName}`}</span>
                  )}
                </span>
                {markets[index].marketTag === "demo" && (
                  <span className="px-1.5 py-0.5 bg-[#ff6464] rounded text-black text-[10px] font-bold uppercase">Demo</span>
                )}
                {markets[index].marketTag === "test" && (
                  <span className="px-1.5 py-0.5 bg-[#3fd145] rounded text-black text-[10px] font-bold uppercase">Test</span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="flex items-center gap-1">
                  <div className="w-5 h-5 relative overflow-hidden"><Icon name="Message" /></div>
                  <div className="text-[#838587] text-sm font-semibold font-interSemi leading-tight">{markets[index].comments ?? 0}</div>
                </div>
                <div className="lg:w-5 lg:h-5 w-4 h-4 relative overflow-hidden"><FaRegStar className="text-white" /></div>
              </div>
            </div>
            <div className="text-white lg:text-xl text-lg font-medium font-rubik leading-tight">
              {markets[index].question}
            </div>
          </div>
        </div>
        
        {/* Market Stats */}
        <div className="self-stretch grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <div className="text-[#838587] text-sm font-semibold">Volume</div>
            <div className="text-white text-sm font-semibold">{markets[index].totalInvestment} HBAR</div>
          </div>
          <div className="flex flex-col gap-1">
            <div className="text-[#838587] text-sm font-semibold">{markets[index].marketStatus === "CLOSED" ? "Status" : "Time Remaining"}</div>
            {markets[index].marketStatus === "CLOSED" ? (
              <div className="text-[#838587] text-sm font-semibold flex items-center gap-1">
                <FaCheckCircle className="text-[#838587]" size={12} />
                Resolved
              </div>
            ) : (
              <div className="text-[#3fd145] text-sm font-semibold flex items-center gap-1">
                <FaRegClock className="text-[#3fd145]" />
                {counter}
              </div>
            )}
          </div>
        </div>

        {/* Percent Chance Bar */}
        <div className="self-stretch flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <div className="text-[#838587] text-sm font-semibold">Percent Chance</div>
            <div className="text-white text-sm font-semibold">
              {yesPercent}%
            </div>
          </div>
          <ProgressBar yesPercentage={yesPercent} />
        </div>
      </div>

      {/* Yes/No Buttons — hidden for closed markets */}
      {markets[index].marketStatus !== "CLOSED" && (
        <div className="self-stretch inline-flex justify-start items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex-1 px-4 py-2.5 bg-[#223a25] outline outline-[#3fd145] rounded-2xl cursor-pointer transition-all duration-200 flex justify-center items-center gap-2"
            onClick={(e) => { e.stopPropagation(); onVote(true, markets[index].tokenA); }}
          >
            <span className="w-5 h-5 flex items-center justify-center">
              <Icon name="yes" color="#3fd145" />
            </span>
            <span className="text-[#3fd145] text-lg font-bold font-satoshi leading-7">Yes</span>
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex-1 px-4 py-2.5 bg-[#3a2222] outline outline-[#ff6464] rounded-2xl cursor-pointer transition-all duration-200 flex justify-center items-center gap-2"
            onClick={(e) => { e.stopPropagation(); onVote(false, markets[index].tokenB); }}
          >
            <span className="w-5 h-5 flex items-center justify-center">
              <Icon name="no" color="#ff6464" />
            </span>
            <span className="text-[#ff6464] text-lg font-bold font-satoshi leading-7">No</span>
          </motion.button>
        </div>
      )}
    </motion.div>
  );
};

export default PredictionCard;
