"use client";

import React, { useEffect, useState } from "react";
import { useGlobalContext } from "@/providers/GlobalContext";
import { getPrices } from "@/components/hedera_sdk";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { marketField as marketFieldData } from "@/data/data";

interface CompactPredictionCardProps {
  index: number;
  linkBase?: string;
}

const CompactPredictionCard: React.FC<CompactPredictionCardProps> = ({ index, linkBase }) => {
  const { markets } = useGlobalContext();
  const router = useRouter();
  const [yesPercent, setYesPercent] = useState(50);

  useEffect(() => {
    if (!markets[index]?.market) return;
    const load = async () => {
      const prices = await getPrices(markets[index].market);
      if (prices) setYesPercent(Math.round(prices.yes * 100));
    };
    load();
  }, [markets[index]?.market]);

  const noPercent = 100 - yesPercent;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.015, boxShadow: "0 4px 20px 0 rgba(7,179,255,0.06)" }}
      transition={{ duration: 0.25 }}
      className="bg-[#1e1e1e] rounded-xl border border-[#2a2a2a] p-4 cursor-pointer flex flex-col gap-3 hover:border-[#3a3a3a] transition-colors h-fit"
      onClick={() => router.push(`${linkBase || '/market'}/${markets[index]._id}`)}
    >
      {/* Top: Image + Category + Question */}
      <div className="flex items-start gap-3">
        <img
          className="w-8 h-8 rounded-lg flex-shrink-0 object-cover"
          src={markets[index].imageUrl}
          alt={markets[index].feedName}
        />
        <div className="flex-1 min-w-0">
          <div className="text-[#07b3ff] text-xs font-semibold mb-1">
            {(marketFieldData[markets[index].marketField] as any)?.displayName || marketFieldData[markets[index].marketField]?.name || "Market"}
          </div>
          <p className="text-white text-[13px] font-medium font-rubik leading-[1.35] line-clamp-2">
            {markets[index].question}
          </p>
        </div>
      </div>

      {/* Yes / No buttons row */}
      <div className="flex items-center gap-2">
        <button
          className="flex-1 py-1.5 bg-[#223a25] rounded-lg text-[#3fd145] text-xs font-bold text-center"
          onClick={(e) => e.stopPropagation()}
        >
          Yes {yesPercent}¢
        </button>
        <button
          className="flex-1 py-1.5 bg-[#3a2222] rounded-lg text-[#ff6464] text-xs font-bold text-center"
          onClick={(e) => e.stopPropagation()}
        >
          No {noPercent}¢
        </button>
      </div>

      {/* Bottom: Volume */}
      <div className="text-[#838587] text-[11px] font-medium">
        {markets[index].totalInvestment} HBAR Vol.
      </div>
    </motion.div>
  );
};

export default CompactPredictionCard;
