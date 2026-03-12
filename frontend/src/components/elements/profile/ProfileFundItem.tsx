"use client";

import { useMetaMask } from "@/providers/MetaMaskProvider";
import { getLPInfo, fetchMarketInfo } from "@/components/hedera_sdk";
import { cachedFetch } from "@/utils/cache";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const statusColors: Record<string, string> = {
  ACTIVE: "bg-[#07b3ff]/10 text-[#07b3ff]",
  PENDING: "bg-[#ffd600]/10 text-[#ffd600]",
  CLOSED: "bg-[#838587]/10 text-[#838587]",
};

const ProfileFundItem = (param: any) => {
  const [betAmount, setBetAmount] = useState(0);
  const [percentage, setPercentage] = useState(0);
  const [onChainLP, setOnChainLP] = useState<{ shares: number; totalShares: number; claimed: boolean } | null>(null);
  const [feeEarnings, setFeeEarnings] = useState<number | null>(null);
  const { address } = useMetaMask();
  const router = useRouter();

  useEffect(() => {
    const userFund = param.investors?.find((f: any) => f.investor === address);
    const totalAmount = param.investors?.reduce((sum: any, i: any) => sum + i.amount, 0) || 0;
    setBetAmount(userFund?.amount || 0);
    setPercentage(totalAmount > 0 ? ((userFund?.amount || 0) / totalAmount) * 100 : 0);

    if (param.market && address) {
      const lpKey = `lp:${param.market}:${address}`;
      const marketKey = `marketInfo:${param.market}`;
      let latestLP: any = null;
      let latestMarket: any = null;

      const tryComputeFees = () => {
        if (latestLP && latestMarket && latestLP.totalShares > 0) {
          const ratio = latestLP.shares / latestLP.totalShares;
          setFeeEarnings(latestMarket.accumulatedFees * ratio);
        }
      };

      cachedFetch(lpKey, () => getLPInfo(param.market, address), (lp) => {
        latestLP = lp;
        setOnChainLP(lp);
        tryComputeFees();
      });
      cachedFetch(marketKey, () => fetchMarketInfo(param.market), (mi) => {
        latestMarket = mi;
        tryComputeFees();
      });
    }
  }, [address]);

  return (
    <div
      className="p-5 bg-[#1e1e1e] rounded-xl border border-[#2a2a2a] flex flex-col sm:flex-row items-start gap-4 cursor-pointer transition-all duration-200 hover:bg-[#252525] hover:border-[#383838]"
      onClick={() => param._id && router.push(`/market/${param._id}`)}
    >
      <img className="w-12 h-12 rounded-lg object-cover flex-shrink-0" src={param.imageUrl || "https://placehold.co/48x48"} alt="" />
      <div className="flex-1 flex flex-col gap-2 min-w-0">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <p className="text-white text-base font-medium font-satoshi leading-snug">{param.question}</p>
          <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex-shrink-0 ${statusColors[param.marketStatus] || statusColors.PENDING}`}>
            {param.marketStatus}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <span className="text-[#666] font-satoshi">Your Share:</span>
            <span className="text-[#3fd145] font-semibold font-satoshi">{percentage.toFixed(1)}%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[#666] font-satoshi">Amount:</span>
            <span className="text-white font-semibold font-satoshi">{Number(betAmount).toFixed(2)} HBAR</span>
          </div>
        </div>
        {onChainLP && onChainLP.shares > 0 && (
          <div className="flex flex-wrap gap-4 text-xs">
            <div className="flex gap-1">
              <span className="text-[#666] font-satoshi">LP Shares:</span>
              <span className="text-white font-semibold font-satoshi">{onChainLP.shares.toLocaleString()}</span>
            </div>
            <div className="flex gap-1">
              <span className="text-[#666] font-satoshi">Pool:</span>
              <span className="text-[#07b3ff] font-semibold font-satoshi">
                {onChainLP.totalShares > 0 ? ((onChainLP.shares / onChainLP.totalShares) * 100).toFixed(1) : "0"}%
              </span>
            </div>
            <div className="flex gap-1">
              <span className="text-[#666] font-satoshi">Status:</span>
              <span className={`font-semibold font-satoshi ${onChainLP.claimed ? "text-[#838587]" : "text-[#3fd145]"}`}>
                {onChainLP.claimed ? "Claimed" : "Unclaimed"}
              </span>
            </div>
            <div className="flex gap-1">
              <span className="text-[#666] font-satoshi">Fees Earned:</span>
              <span className="text-white font-semibold font-satoshi">{feeEarnings !== null ? feeEarnings.toFixed(2) : "0.00"} HBAR</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileFundItem;
