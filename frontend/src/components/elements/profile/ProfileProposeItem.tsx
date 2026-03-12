"use client";

import { getCountDown } from "@/utils";
import React, { useEffect, useState } from "react";
import { GiAlarmClock } from "react-icons/gi";

const statusColors: Record<string, string> = {
  PENDING: "bg-[#ffd600]/10 text-[#ffd600]",
  ACTIVE: "bg-[#07b3ff]/10 text-[#07b3ff]",
  CLOSED: "bg-[#838587]/10 text-[#838587]",
};

const ProfileProposeItem = (param: any) => {
  const [counter, setCounter] = useState(() => getCountDown(param.date));
  const [fund, setFund] = useState(0);

  useEffect(() => {
    const totalAmount = param.investors?.reduce((sum: any, i: any) => sum + i.amount, 0) || 0;
    setFund(totalAmount);
    const interval = setInterval(() => {
      setCounter(getCountDown(param.date));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const liquidityGoal = param.liquidityGoal || 100;
  const progressPct = Math.min((fund / liquidityGoal) * 100, 100);

  return (
    <div className="p-6 bg-[#1e1e1e] rounded-xl border border-[#2a2a2a] flex flex-col sm:flex-row items-start gap-5">
      <img className="w-14 h-14 rounded-lg object-cover flex-shrink-0" src={param.imageUrl || "https://placehold.co/56x56"} alt="" />
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        {/* Status + Question */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${statusColors[param.marketStatus] || statusColors.PENDING}`}>
            {param.marketStatus}
          </span>
        </div>
        <p className="text-white text-lg font-medium font-satoshi leading-relaxed">{param.question}</p>

        {/* Time Left */}
        <div className="flex flex-col gap-1">
          <span className="text-[#666] text-xs font-satoshi">Time Left</span>
          <div className="px-3 py-1.5 bg-[#111] rounded-lg flex items-center gap-2 w-fit border border-[#2a2a2a]">
            <GiAlarmClock size={14} className="text-[#07b3ff]" />
            <span className="text-[#07b3ff] text-xs font-semibold font-satoshi">{counter}</span>
          </div>
        </div>

        {/* Funding Progress */}
        <div className="flex flex-col gap-2">
          <span className="text-[#666] text-xs font-satoshi">Funding Progress</span>
          <div className="w-full max-w-[280px] h-2 bg-[#2a2a2a] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#3fd145] to-[#07b3ff] rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-[#3fd145] font-semibold font-satoshi">{Number(fund).toFixed(2)} HBAR</span>
            <span className="text-[#666] font-satoshi">/ {liquidityGoal} HBAR</span>
            <span className="text-[#666] text-xs font-satoshi ml-auto">({progressPct.toFixed(0)}%)</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileProposeItem;
