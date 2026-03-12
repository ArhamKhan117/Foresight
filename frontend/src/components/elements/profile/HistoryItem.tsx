"use client";

import { useMetaMask } from "@/providers/MetaMaskProvider";
import { getUserTokens, getPrices } from "@/components/hedera_sdk";
import { cachedFetch } from "@/utils/cache";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const statusColors: Record<string, string> = {
  ACTIVE: "bg-[#07b3ff]/10 text-[#07b3ff]",
  PENDING: "bg-[#ffd600]/10 text-[#ffd600]",
  CLOSED: "bg-[#838587]/10 text-[#838587]",
};

const HistoryItem = (param: any) => {
  const { address } = useMetaMask();
  const router = useRouter();
  const [percentage, setPercentage] = useState(0);
  const [answer, setAnswer] = useState("Yes");
  const [amount, setAmount] = useState(0);
  const [onChainTokens, setOnChainTokens] = useState<{ yesTokens: number; noTokens: number } | null>(null);
  const [pnl, setPnl] = useState<number | null>(null);

  const computePnl = (tokens: { yesTokens: number; noTokens: number }, prices: { yes: number; no: number }, cost: number) => {
    let currentValue = 0;
    if (param.marketStatus === "CLOSED") {
      const yesWon = param.isYes === true || param.isYes === "true";
      currentValue = yesWon ? tokens.yesTokens : tokens.noTokens;
    } else {
      currentValue = tokens.yesTokens * prices.yes + tokens.noTokens * prices.no;
    }
    setPnl(currentValue - cost);
  };

  useEffect(() => {
    let playerList = param.playerA?.find((p: any) => p.player === address);
    let totalPlayAmount = 0;
    if (playerList) {
      totalPlayAmount = param.playerA.reduce((sum: any, i: any) => sum + i.amount, 0);
    } else {
      playerList = param.playerB?.find((p: any) => p.player === address);
      totalPlayAmount = param.playerB?.reduce((sum: any, i: any) => sum + i.amount, 0) || 0;
      setAnswer("No");
    }
    if (!playerList) return;
    setPercentage(totalPlayAmount > 0 ? (playerList.amount / totalPlayAmount) * 100 : 0);
    const cost = playerList.amount;
    setAmount(cost);

    if (param.market && address) {
      const tokensKey = `tokens:${param.market}:${address}`;
      const pricesKey = `prices:${param.market}`;
      let latestTokens: any = null;
      let latestPrices: any = null;

      const tryCompute = () => {
        if (latestTokens && latestPrices) {
          setOnChainTokens(latestTokens);
          computePnl(latestTokens, latestPrices, cost);
        }
      };

      cachedFetch(tokensKey, () => getUserTokens(param.market, address), (t) => { latestTokens = t; tryCompute(); });
      cachedFetch(pricesKey, () => getPrices(param.market), (p) => { latestPrices = p; tryCompute(); });
    }
  }, [address]);

  const pnlColor = pnl !== null ? (pnl >= 0 ? "text-[#3fd145]" : "text-[#ff6464]") : "";
  const pnlText = pnl !== null ? `${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)} HBAR` : null;

  return (
    <div
      className="p-5 bg-[#1e1e1e] rounded-xl border border-[#2a2a2a] flex flex-col sm:flex-row items-start gap-4 cursor-pointer transition-all duration-200 hover:bg-[#252525] hover:border-[#383838]"
      onClick={() => param._id && router.push(`/market/${param._id}`)}
    >
      <img className="w-12 h-12 rounded-lg object-cover flex-shrink-0" src={param.imageUrl || "https://placehold.co/48x48"} alt="" />
      <div className="flex-1 flex flex-col gap-2 min-w-0">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <p className="text-white text-base font-medium font-satoshi leading-snug">{param.question}</p>
          <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex-shrink-0 ${statusColors[param.marketStatus] || statusColors.ACTIVE}`}>
            {param.marketStatus}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <span className="text-[#666] font-satoshi">Position:</span>
            <span className={`font-semibold font-satoshi ${answer === "Yes" ? "text-[#3fd145]" : "text-[#ff6464]"}`}>{answer}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[#666] font-satoshi">Share:</span>
            <span className="text-white font-semibold font-satoshi">{percentage.toFixed(1)}%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[#666] font-satoshi">Cost:</span>
            <span className="text-white font-semibold font-satoshi">{Number(amount).toFixed(2)} HBAR</span>
          </div>
          {pnlText && (
            <div className="flex items-center gap-1.5">
              <span className="text-[#666] font-satoshi">P&L:</span>
              <span className={`font-semibold font-satoshi ${pnlColor}`}>{pnlText}</span>
            </div>
          )}
        </div>
        {onChainTokens && (onChainTokens.yesTokens > 0 || onChainTokens.noTokens > 0) && (
          <div className="flex gap-4 text-xs">
            {onChainTokens.yesTokens > 0 && (
              <div className="flex gap-1">
                <span className="text-[#666] font-satoshi">Yes Tokens:</span>
                <span className="text-[#3fd145] font-semibold font-satoshi">{onChainTokens.yesTokens.toFixed(2)}</span>
              </div>
            )}
            {onChainTokens.noTokens > 0 && (
              <div className="flex gap-1">
                <span className="text-[#666] font-satoshi">No Tokens:</span>
                <span className="text-[#ff6464] font-semibold font-satoshi">{onChainTokens.noTokens.toFixed(2)}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoryItem;
