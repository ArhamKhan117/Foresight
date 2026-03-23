"use client";

import React from "react";
import { useRouter } from "next/navigation";
import Icon from "../Icons";
import { CiStar } from "react-icons/ci";
import { GiAlarmClock } from "react-icons/gi";

import CollapsibleDescription from "../CollapsibleDescription";
import { formatFeedLabel } from "@/utils";
import { marketField as marketFieldData } from "@/data/data";

interface FundInfoProps {
  title: string;
  description: string;
  category: string;
  imageUrl: string;
  votes: number;
  currentFunding: number | null;
  liquidityGoal: number | null;
  expiresIn: string;
  marketId: string;
  marketFieldIndex?: number;
}

const FundCard: React.FC<FundInfoProps> = ({
  title,
  description,
  category,
  imageUrl,
  votes,
  currentFunding,
  liquidityGoal,
  expiresIn,
  marketId,
  marketFieldIndex,
}) => {
  const router = useRouter();
  const loaded = currentFunding !== null && liquidityGoal !== null;
  const progressBars = 16;
  const filledBars = loaded && liquidityGoal > 0
    ? Math.min(progressBars, Math.floor((currentFunding / liquidityGoal) * progressBars))
    : 0;

  return (
    <div className="sm:p-6 p-4 w-full bg-[#1e1e1e] rounded-2xl outline-1 flex-col lg:flex-row outline-offset-[-1px] outline-[#313131] flex justify-start items-start gap-8">
      <img className="xl:w-[200px] w-[120px] h-[120px] xl:h-[200px] rounded-2xl hidden lg:flex object-contain" src={imageUrl} alt="Fund Image" />
      <div className="flex-1 self-stretch inline-flex flex-col justify-start items-start gap-6">
        <div className="self-stretch inline-flex justify-start items-start gap-2 relative">
          <div className="flex-1 inline-flex flex-col justify-start items-start gap-2">
            <div className="inline-flex justify-start items-center gap-2">
              <div className="inline-flex items-center gap-2">
                <span className="text-[#07b3ff] text-base font-semibold font-interSemi leading-normal">
                  {(marketFieldData[marketFieldIndex ?? 0] as any)?.displayName || marketFieldData[marketFieldIndex ?? 0]?.name || "Crypto"}
                  {(marketFieldData[marketFieldIndex ?? 0] as any)?.freeText && category && (
                    <span className="text-[#838587] text-xs font-normal ml-1">{`• ${category}`}</span>
                  )}
                  {(marketFieldData[marketFieldIndex ?? 0] as any)?.isTweet && category && (
                    <span className="text-[#838587] text-xs font-normal ml-1">{`• ${category.includes("·") ? category.split("·").pop()?.trim() : category}`}</span>
                  )}
                </span>
              </div>
            </div>
            <div className="self-stretch justify-start text-white text-[40px] font-medium font-rubik leading-[48px]">{title}</div>
          </div>
          <div className="flex absolute top-0 right-0 gap-1">
            <div className="cursor-pointer rounded-2xl flex justify-start items-center gap-2">
              <Icon name="Message" size={20} />
              <div className="justify-start text-white text-base font-medium font-satoshi leading-7">{votes}</div>
            </div>
            <div className="cursor-pointer rounded-2xl flex justify-center items-center gap-2">
              <CiStar className="text-white font-extrabold text-[24px]" />
            </div>
          </div>
        </div>
        <div className="self-stretch flex-1 flex flex-col justify-start items-start gap-4">
          <div className="self-stretch flex-1 flex flex-col justify-start items-start gap-2 overflow-hidden">
            <CollapsibleDescription
              description={description}
              label="Description"
              labelClassName="text-[#838587] text-lg font-medium font-satoshi leading-relaxed"
              textClassName="text-white text-lg font-medium font-satoshi leading-relaxed"
            />
          </div>
          <div className="self-stretch inline-flex justify-between items-center">
            <div />
            <div className="text-center justify-start text-[#838587] text-sm font-medium font-satoshi">Note: This event is legally protected</div>
          </div>
        </div>
      </div>
      <div className="p-6 lg:w-auto lg:min-w-[320px] w-full bg-[#111111] rounded-2xl outline-1 outline-offset-[-1px] outline-[#313131] inline-flex flex-col justify-start items-center gap-6">
        <div className="self-stretch flex flex-col justify-start items-start gap-4">
          <div className="self-stretch justify-start text-white text-2xl font-bold font-satoshi capitalize leading-loose">Start funding on this</div>
          <div className="self-stretch p-4 bg-[#1e1e1e] rounded-2xl outline-1 outline-offset-[-1px] outline-[#313131] flex flex-col justify-start items-start gap-4">
            <div className="self-stretch h-[23px] inline-flex justify-between items-center">
              {[...Array(progressBars)].map((_, index) => (
                <div key={index} className={`w-[11px] self-stretch rounded-[100px] ${index < filledBars ? "bg-[#3fd145]" : "bg-[#838587]"}`} />
              ))}
            </div>
            <div className="self-stretch rounded-xl inline-flex justify-between items-center">
              <div className="justify-start">
                <span className="text-[#3fd145] text-lg font-semibold font-interSemi leading-relaxed">{loaded ? currentFunding.toFixed(2) : "—"}</span>
                <span className="text-[#838587] text-lg font-semibold font-interSemi leading-relaxed"> / {loaded ? liquidityGoal : "—"}</span>
              </div>
              <div className="text-right justify-start text-white text-lg font-semibold font-interSemi leading-relaxed">HBAR Raised</div>
            </div>
          </div>
          <div className="self-stretch rounded-xl inline-flex justify-between items-center gap-4">
            <div className="text-right justify-start text-white text-base font-normal font-interSemi leading-relaxed">Expires in</div>
            <div className="px-3 py-2 bg-[#3fd145]/10 rounded-xl flex justify-start items-center gap-2">
              <GiAlarmClock size={19} className="text-[#3fd145] flex-shrink-0" />
              <div className="text-[#3fd145] text-lg font-medium font-satoshi leading-relaxed tabular-nums min-w-[200px]">{expiresIn}</div>
            </div>
          </div>
        </div>
        <div
          onClick={() => router.push(`/fund/${marketId}`)}
          className="self-stretch cursor-pointer px-6 py-3.5 bg-[#07b3ff] rounded-2xl shadow-[inset_0px_3px_0px_0px_rgba(255,255,255,0.16)] inline-flex justify-center items-center gap-2 transition-all duration-300 ease-in-out hover:bg-[#0595d3] hover:scale-102 hover:shadow-lg active:scale-100"
        >
          <div className="text-[#111111] text-xl font-medium font-satoshi leading-7">Fund now</div>
        </div>
      </div>
    </div>
  );
};

export default FundCard;
