"use client";
import FundNavbar from "@/components/elements/fund/FundNavbar";
import SolCounter from "@/components/elements/fund/SolCounter";
import Icon from "@/components/elements/Icons";
import { CiStar } from "react-icons/ci";
import { GoQuestion } from "react-icons/go";
import { ImAlarm } from "react-icons/im";
import { useParams, useRouter } from "next/navigation";
import { marketField } from "@/data/data";
import { useEffect, useState } from "react";
import { getCountDown } from "@/utils";
import { depositLiquidity, fetchMarketInfo, fundMultiOutcomeEvent, fetchMultiOutcomeEventInfo } from "@/components/hedera_sdk";
import { useMetaMask } from "@/providers/MetaMaskProvider";
import { errorAlert, successAlert } from "@/components/elements/ToastGroup";
import axios from "axios";
import { API_ENDPOINTS } from "@/config/api";
import { MarketDataType } from "@/types/type";
import CollapsibleDescription from "@/components/elements/CollapsibleDescription";

export default function FundDetail() {
  const [market, setMarket] = useState<MarketDataType | null>(null);
  const [loading, setLoading] = useState(true);
  const [counter, setCounter] = useState("7d : 6h : 21m : 46s");
  const [fundAmount, setAmount] = useState(0);
  const [onChainInfo, setOnChainInfo] = useState<any>(null);
  const [eventOutcomes, setEventOutcomes] = useState<MarketDataType[]>([]);
  const router = useRouter();
  const { isConnected, address, signer } = useMetaMask();

  const param = useParams();
  const marketId = param.id as string;

  // Fetch market by ID from API
  useEffect(() => {
    const fetchMarket = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`${API_ENDPOINTS.MARKET.GET}?id=${marketId}`);
        if (res.data.data && res.data.data.length > 0) {
          setMarket(res.data.data[0]);
        } else if (res.data && !res.data.data) {
          // Single market response
          setMarket(res.data);
        } else {
          errorAlert("Market not found");
          router.replace("/fund");
        }
      } catch (error) {
        console.error("Error fetching market:", error);
        errorAlert("Failed to load market");
        router.replace("/fund");
      } finally {
        setLoading(false);
      }
    };

    if (marketId) {
      fetchMarket();
    }
  }, [marketId, router]);

  useEffect(() => {
    if (!market) return;
    const interval = setInterval(() => {
      setCounter(getCountDown(market.date));
    }, 1000);
    return () => clearInterval(interval);
  }, [market]);

  // Fetch on-chain info for liquidityGoal
  useEffect(() => {
    if (!market) return;
    const load = async () => {
      // Multi-outcome events use the new contract
      if (market.marketType === "multi" && market.eventGroupId) {
        const info = await fetchMultiOutcomeEventInfo(market.eventGroupId);
        if (info) {
          setOnChainInfo(info);
        } else if (market.market) {
          // Fallback: old per-outcome approach
          const fallback = await fetchMarketInfo(market.market);
          if (fallback) setOnChainInfo(fallback);
        }
      } else if (market.market) {
        const info = await fetchMarketInfo(market.market);
        if (info) setOnChainInfo(info);
      }
    };
    load();
  }, [market?.market, market?.eventGroupId, market?.marketType]);

  // Fetch all outcomes for multi-outcome events
  useEffect(() => {
    if (!market?.eventGroupId || market.marketType !== "multi") return;
    const load = async () => {
      try {
        const res = await axios.get(
          `${API_ENDPOINTS.MARKET.EVENT_GROUP}?eventGroupId=${market.eventGroupId}`
        );
        setEventOutcomes(res.data.data || []);
      } catch (e) {
        console.error("Error fetching event outcomes:", e);
      }
    };
    load();
  }, [market?.eventGroupId, market?.marketType]);

  const onFund = async () => {
    try {
      if (!isConnected || !signer) {
        errorAlert("Please connect wallet!");
        return;
      }
      
      if (!market) {
        errorAlert("Market not loaded!");
        return;
      }

      if (new Date(market.date).getTime() <= Date.now()) {
        errorAlert("This market has expired and can no longer be funded.");
        return;
      }

      if (fundAmount <= 0) {
        errorAlert("Please enter a valid amount!");
        return;
      }

      // Multi-outcome: fund ALL outcomes with single tx via new contract
      if (market.marketType === "multi" && market.eventGroupId) {
        const depositResult = await fundMultiOutcomeEvent({
          eventId: market.eventGroupId,
          amount: fundAmount,
          signer,
        });

        const active = depositResult.status === "active";

        await axios.post(API_ENDPOINTS.MARKET.FUND_EVENT, {
          eventGroupId: market.eventGroupId,
          amount: fundAmount,
          investor: address,
          active,
        });

        successAlert("Event funded successfully!", { txHash: depositResult.txHash });
        router.replace(`/fund`);
        return;
      }
      
      const depositResult = await depositLiquidity({ 
        amount: fundAmount, 
        market_id: market.market, 
        accountId: address!,
        signer 
      });
      
      console.log("fundAmount:", fundAmount);
      const active = depositResult.status === "active";
      console.log("status:", active);

      const result = await axios.post(API_ENDPOINTS.MARKET.LIQUIDITY, { 
        market_id: market._id, 
        amount: fundAmount, 
        investor: address, 
        active 
      });

      if (result.status === 200) {
        successAlert("Funded successfully!", { txHash: depositResult.txHash });
        router.replace(`/fund`);
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      errorAlert("Failed deploying fund!");
    }
  };

  if (loading) {
    return (
      <div className="self-stretch px-[50px] inline-flex flex-col justify-center items-center gap-[50px] min-h-[400px]">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#07b3ff]"></div>
        <p className="text-[#838587] text-lg">Loading market...</p>
      </div>
    );
  }

  if (!market) return null;

  const isExpired = new Date(market.date).getTime() <= Date.now();

  return (
    <div className="self-stretch px-[50px] inline-flex flex-col justify-start items-start gap-[50px] overflow-auto">
      <div className="self-stretch inline-flex justify-start items-start gap-2">
        <div className="justify-start text-[#838587] text-lg font-normal cursor-pointer font-rubic leading-relaxed">
          {marketField[market.marketField].name}
        </div>
        <div className="justify-start text-[#838587] text-lg font-normal font-rubic leading-relaxed">{">"}</div>
        <div className="justify-start text-white text-lg font-normal font-rubic leading-relaxed">
          {market.marketType === "multi" && market.eventQuestion
            ? market.eventQuestion
            : market.question}
        </div>
      </div>

      <div className="self-stretch flex flex-col lg:flex-row justify-start items-start gap-10">
        {/* Left: Market Info */}
        <div className="flex-1 flex flex-col justify-start items-start gap-6">
          <div className="self-stretch p-6 bg-[#1e1e1e] rounded-2xl outline-1 outline-offset-[-1px] outline-[#313131] flex flex-col justify-start items-start gap-8">
            {/* Header with image */}
            <div className="self-stretch flex justify-start items-start gap-6">
              <img
                className="w-24 h-24 mt-3 rounded-xl object-contain flex-shrink-0"
                src={market.imageUrl || "https://placehold.co/96x96"}
                alt={market.feedName}
              />
              <div className="flex-1 flex flex-col justify-start items-start gap-2 relative">
                <div className="inline-flex justify-start items-center gap-2">
                  <div className="text-[#07b3ff] text-base font-semibold font-interSemi leading-normal">
                    {marketField[market.marketField].name}
                  </div>
                </div>
                <div className="self-stretch text-white text-[32px] font-medium font-rubik leading-[40px]">
                  {market.marketType === "multi" && market.eventQuestion
                    ? market.eventQuestion
                    : market.question}
                </div>
                <div className="flex absolute top-0 right-0 gap-1">
                  <div className="cursor-pointer rounded-2xl flex justify-start items-center gap-2">
                    <Icon name="Message" size={20} />
                    <div className="text-white text-base font-medium font-satoshi leading-7">45</div>
                  </div>
                  <div className="cursor-pointer rounded-2xl flex justify-center items-center gap-2">
                    <CiStar className="text-white font-extrabold text-[24px]" />
                  </div>
                </div>
              </div>
            </div>

            {/* Expires in */}
            {market.marketType === "multi" && eventOutcomes.length > 0 && (
              <div className="self-stretch flex flex-col gap-2">
                <div className="text-[#838587] text-lg font-medium font-satoshi leading-relaxed">Outcomes ({eventOutcomes.length})</div>
                <div className="flex flex-col gap-2">
                  {eventOutcomes.map((o, i) => {
                    const onChainOutcome = onChainInfo?.outcomes?.[i];
                    return (
                      <div key={o._id} className="flex items-center justify-between px-4 py-2.5 bg-[#111] rounded-xl border border-[#262626]">
                        <span className="text-white text-sm font-medium">{onChainOutcome?.name || o.outcomeName || o.question}</span>
                        <div className="flex items-center gap-2">
                          {onChainOutcome && (
                            <span className="text-[#838587] text-xs">{Math.round(onChainOutcome.yesPrice * 100)}%</span>
                          )}
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${o.marketStatus === "ACTIVE" ? "bg-[#223a25] text-[#3fd145]" : "bg-[#2a2a2a] text-[#838587]"}`}>
                            {o.marketStatus === "ACTIVE" ? "Funded" : "Pending"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="text-[#838587] text-xs mt-1">All outcomes are funded together with a single transaction.</div>
              </div>
            )}

            <div className="flex flex-col justify-center items-start gap-3">
              <div className="text-[#838587] text-lg font-normal font-interSemi leading-relaxed">Expires in</div>
              <div className="px-3 py-2 bg-[#3fd145]/10 rounded-xl inline-flex justify-start items-center gap-2">
                <ImAlarm color="#3fd145" size={25} className="flex-shrink-0" />
                <div className="text-[#3fd145] text-lg font-medium font-satoshi leading-relaxed tabular-nums min-w-[200px]">{counter}</div>
              </div>
            </div>

            {/* Initial Funding */}
            <div className="flex flex-col justify-start items-start gap-2 w-full">
              <div className="text-[#838587] text-lg font-normal font-interSemi leading-relaxed">Initial Funding</div>
              <div className="w-full max-w-[392px] p-4 bg-[#111111] rounded-2xl outline-1 outline-offset-[-1px] outline-[#313131] flex flex-col justify-start items-start gap-4">
                <div className="self-stretch h-[23px] inline-flex justify-between items-center">
                  {Array.from({ length: 20 }).map((_, i) => {
                    const goal = onChainInfo?.liquidityGoal;
                    const currentLiq = onChainInfo?.liquidity ?? market.totalInvestment;
                    const filledSegments = goal && goal > 0 ? Math.min(20, Math.floor((currentLiq / goal) * 20)) : 0;
                    return <div key={i} className={`sm:w-[11px] w-[5px] self-stretch ${i < filledSegments ? 'bg-[#3fd145]' : 'bg-[#838587]'} rounded-[100px]`} />;
                  })}
                </div>
                <div className="self-stretch rounded-xl inline-flex justify-between items-center">
                  <div>
                    <span className="text-[#3fd145] text-lg font-semibold font-interSemi leading-relaxed">{onChainInfo ? parseFloat(Number(onChainInfo.liquidity ?? market.totalInvestment).toFixed(4)).toString() : "—"}</span>
                    <span className="text-[#838587] text-lg font-semibold font-interSemi leading-relaxed"> / {onChainInfo?.liquidityGoal ?? "—"}</span>
                  </div>
                  <div className="text-right text-white text-lg font-semibold font-interSemi leading-relaxed">HBAR Raised</div>
                </div>
              </div>
            </div>

            {/* Oracle Resolver */}
            <div className="self-stretch flex flex-col justify-start items-start gap-2">
              <div className="text-[#838587] text-lg font-medium font-satoshi leading-relaxed">Oracle Resolver</div>
              <div className="text-white text-lg font-medium font-satoshi leading-relaxed">{marketField[market.marketField].content[market.apiType].api_name}</div>
            </div>

            {/* Description */}
            <div className="self-stretch flex flex-col justify-start items-start gap-2">
              <CollapsibleDescription
                description={market.description}
                labelClassName="text-[#838587] text-lg font-medium font-satoshi leading-relaxed"
                textClassName="text-white text-lg font-medium font-satoshi leading-relaxed"
              />
              <div className="self-stretch inline-flex justify-end">
                <div className="text-[#838587] text-sm font-medium font-satoshi">Note: This event is legally protected</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Fund Panel */}
        <div className="lg:w-[440px] w-full px-6 pt-6 pb-8 bg-[#1e1e1e] rounded-2xl outline-1 outline-offset-[-1px] outline-[#313131] flex flex-col justify-start items-center gap-8 lg:sticky lg:top-6">
          <div className="self-stretch flex flex-col justify-start items-start gap-1">
            <div className="justify-start text-white text-[32px] font-medium font-rubik leading-[48px]">Fund</div>
            <div className="self-stretch justify-start text-[#838587] text-lg font-normal font-satoshi leading-relaxed">
              {market.marketType === "multi"
                ? `Fund all ${eventOutcomes.length || "—"} outcomes for this event`
                : "Start funding for this Topic"}
            </div>
          </div>

          <div className="self-stretch flex flex-col justify-start items-start gap-3">
            <div className="self-stretch inline-flex justify-start items-start gap-1">
              <div className="justify-start text-[#838587] text-base font-medium font-satoshi leading-none">Amount</div>
              <GoQuestion className="text-gray font-bold w-4 h-4" />
            </div>
            <SolCounter amount={fundAmount} setAmount={setAmount} />
          </div>

          <div className="self-stretch flex flex-col justify-start items-start gap-4">
            <div className="self-stretch inline-flex justify-between items-center">
              <div className="justify-start text-[#838587] text-base font-medium font-satoshi leading-none">Fund Amount</div>
              <div className="justify-start text-[#838587] text-base font-bold font-satoshi leading-none">{fundAmount} HBAR</div>
            </div>
            <div className="self-stretch inline-flex justify-between items-center">
              <div className="flex justify-start items-center gap-1">
                <div className="justify-start text-[#838587] text-base font-medium font-satoshi leading-none">LP Share</div>
                <GoQuestion className="text-gray font-bold w-4 h-4" />
              </div>
              <div className="justify-start text-[#838587] text-base font-bold font-satoshi leading-none">
                {fundAmount > 0 && onChainInfo ? ((fundAmount / (onChainInfo.liquidity + fundAmount)) * 100).toFixed(2) : fundAmount > 0 ? ((fundAmount / (market.totalInvestment + fundAmount)) * 100).toFixed(2) : "0.00"}%
              </div>
            </div>
            <div className="self-stretch inline-flex justify-between items-center">
              <div className="justify-start text-[#838587] text-base font-medium font-satoshi leading-none">Gas Fee</div>
              <div className="justify-start text-[#838587] text-base font-bold font-satoshi leading-none">~0.001 HBAR</div>
            </div>
          </div>

          <div className="self-stretch flex flex-col justify-start items-center gap-5">
            {isExpired ? (
              <div className="self-stretch px-6 py-3.5 bg-[#2a2a2a] rounded-2xl inline-flex justify-center items-center gap-2">
                <div className="text-[#838587] text-xl font-medium font-satoshi leading-7">Market Expired</div>
              </div>
            ) : (
              <div onClick={onFund} className="self-stretch px-6 py-3.5 hover:cursor-pointer bg-[#07b3ff] hover:bg-[#07b3ff]/50 rounded-2xl shadow-[inset_0px_3px_0px_0px_rgba(255,255,255,0.16)] inline-flex justify-center items-center gap-2">
                <div className="text-[#111111] text-xl font-medium font-satoshi leading-7">Fund Now</div>
              </div>
            )}
            <div className="text-center text-sm font-satoshi leading-relaxed">
              <span className="text-[#838587]">By clicking Fund you agree to </span>
              <span className="text-[#3fd145] font-medium underline cursor-pointer">Terms and Conditions</span>
            </div>
          </div>
        </div>
      </div>
      <FundNavbar />
    </div>
  );
}
