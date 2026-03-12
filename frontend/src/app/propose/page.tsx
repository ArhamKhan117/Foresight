"use client";

import { useEffect, useState } from "react";
import { FiUpload } from "react-icons/fi";
import { ProposeType } from "@/types/type";
import axios from "axios";
import { useMetaMask } from "@/providers/MetaMaskProvider";
import { API_ENDPOINTS } from "@/config/api";
import { marketField } from "@/data/data";
import { errorAlert, infoAlert, warningAlert, successAlert } from "@/components/elements/ToastGroup";
import { createMarket, createMultiOutcomeEvent } from "@/components/hedera_sdk";
import { ADMIN_ADDRESS } from "@/components/hedera_sdk/constants";
import { useRouter } from "next/navigation";
import { ClipLoader } from "react-spinners";
import { GoQuestion } from "react-icons/go";

interface CoinGeckoToken { id: string; symbol: string; name: string; market_cap?: number; image?: string; }
interface DexToken { name: string; symbol: string; address: string; market_cap?: number; }

const findJsonPathsForKey = (json: string, key: string): string[] => {
  try {
    const obj = JSON.parse(json);
    const paths: string[] = [];
    const search = (current: any, path: string) => {
      if (typeof current === "object" && current !== null) {
        for (const k in current) {
          if (k === key || k.toLowerCase().includes(key.toLowerCase())) paths.push(`${path}.${k}`);
          search(current[k], `${path}.${k}`);
        }
      }
    };
    search(obj, "$");
    return paths;
  } catch { return []; }
};

const uploadImage = async (file: File): Promise<string> => {
  const PINATA_API_KEY = process.env.NEXT_PUBLIC_PINATA_API_KEY;
  const PINATA_SECRET_KEY = process.env.NEXT_PUBLIC_PINATA_SECRET_KEY;
  if (!PINATA_API_KEY || !PINATA_SECRET_KEY) { console.warn("Pinata keys not configured"); return fileToBase64(file); }
  try {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: { 'pinata_api_key': PINATA_API_KEY, 'pinata_secret_api_key': PINATA_SECRET_KEY },
      body: formData,
    });
    if (!response.ok) return fileToBase64(file);
    const data = await response.json();
    return `https://gateway.pinata.cloud/ipfs/${data.IpfsHash}`;
  } catch { return fileToBase64(file); }
};

const fileToBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result as string);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

const formatNumber = (num: number): string => {
  if (num >= 1e12) return (num / 1e12).toFixed(1) + 'T';
  if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(1) + 'k';
  return num.toString();
};

export default function Propose() {
  const [active, setActive] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const { isConnected, address, signer } = useMetaMask();
  const [isChecked, setIsChecked] = useState(false);
  const [marketFieldIndex, setMarketFieldIndex] = useState(0);
  const [marketFieldContentIndex, setMarketFieldContentIndex] = useState(0);
  const [marketFieldOpen, setMarketFieldOpen] = useState(false);
  const [needDataError, setNeededDataError] = useState(false);
  const [marketFieldContentOpen, setMarketFieldContentOpen] = useState(false);
  const [isUploading, setUploading] = useState(false);
  const router = useRouter();

  const [error, setError] = useState({
    question: "", feedName: "", imageUrl: "", dataLink: "",
    date: "", value: "", checkbox: "", description: ""
  });

  const [data, setData] = useState<ProposeType>({
    marketField: 0, apiType: 0, range: 0, direction: "above", question: "", imageUrl: "",
    feedName: "", feedId: "", dataLink: "", date: "", task: "", value: 0, creator: "", description: ""
  });

  const [liquidityGoal, setLiquidityGoal] = useState<string>("100");
  const [marketTypeChoice, setMarketTypeChoice] = useState<"binary" | "multi">("binary");
  const [outcomes, setOutcomes] = useState<string[]>(["", ""]);
  const [eventQuestion, setEventQuestion] = useState("");
  const [tokenList, setTokenList] = useState<CoinGeckoToken[]>([]);
  const [dexTokenList, setDexTokenList] = useState<DexToken[]>([]);
  const [tokenSearch, setTokenSearch] = useState("");
  const [dexIndex, setDexIndex] = useState(0);
  const [selectedToken, setSelectedToken] = useState<CoinGeckoToken | null>(null);
  const [selectedDexToken, setSelectedDexToken] = useState<DexToken | null>(null);
  const [tokenDropdownOpen, setTokenDropdownOpen] = useState(false);
  const [searchingDex, setSearchingDex] = useState(false);
  const [tokenDisplayName, setTokenDisplayName] = useState("");
  const [freeTextQuestion, setFreeTextQuestion] = useState("");
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);

  // Tweet market state
  const [tweetUrl, setTweetUrl] = useState("");
  const [tweetData, setTweetData] = useState<any>(null);
  const [tweetLoading, setTweetLoading] = useState(false);
  const [tweetError, setTweetError] = useState<string | null>(null);

  const isAdmin = isConnected && address?.toLowerCase() === ADMIN_ADDRESS;
  const [marketTag, setMarketTag] = useState<"normal" | "demo" | "test">("normal");
  const [quickTimer, setQuickTimer] = useState(5);
  const isFreeText = !!(marketField[marketFieldIndex] as any)?.freeText;
  const isTweet = !!(marketField[marketFieldIndex] as any)?.isTweet;

  // Fetch current price or market cap when a crypto token is selected
  useEffect(() => {
    if (isFreeText) { setCurrentPrice(null); return; }
    const content = marketField[marketFieldIndex].content[marketFieldContentIndex] as any;
    const feedId = data.feedId || data.feedName;
    if (!feedId || (!selectedToken && !selectedDexToken)) { setCurrentPrice(null); return; }
    const isMcap = data.range === 1;
    const fetchPrice = async () => {
      try {
        if (content.api_name === "CoinGecko") {
          if (isMcap) {
            // Fetch market cap from CoinGecko
            const res = await fetch(`/api/coingecko?path=/simple/price&ids=${feedId}&vs_currencies=usd&include_market_cap=true`);
            const json = await res.json();
            if (json?.[feedId]?.usd_market_cap) setCurrentPrice(json[feedId].usd_market_cap);
            else setCurrentPrice(null);
          } else {
            const res = await fetch(`/api/coingecko?path=/simple/price&ids=${feedId}&vs_currencies=usd`);
            const json = await res.json();
            if (json?.[feedId]?.usd) setCurrentPrice(json[feedId].usd);
            else setCurrentPrice(null);
          }
        } else if (content.api_name === "Dexscreener") {
          const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(feedId)}`);
          const json = await res.json();
          if (isMcap) {
            const mc = json?.pairs?.[0]?.marketCap || json?.pairs?.[0]?.fdv || null;
            setCurrentPrice(mc ? Number(mc) : null);
          } else {
            if (json?.pairs?.[0]?.priceUsd) setCurrentPrice(parseFloat(json.pairs[0].priceUsd));
            else setCurrentPrice(null);
          }
        }
      } catch { setCurrentPrice(null); }
    };
    fetchPrice();
  }, [selectedToken, selectedDexToken, marketFieldIndex, marketFieldContentIndex, isFreeText, data.range]);

  useEffect(() => {
    fetch("/api/coingecko?path=/coins/markets&vs_currency=usd&order=market_cap_desc&per_page=250&page=1")
      .then(res => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setTokenList(data.map((c: any) => ({ id: c.id, symbol: c.symbol, name: c.name, market_cap: c.market_cap || 0, image: c.image })));
        }
      })
      .catch(() => setTokenList([]));
  }, []);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setError(prev => ({ ...prev, imageUrl: "" }));
      const file = e.target.files[0];
      setUploading(true);
      const imageUrl = await uploadImage(file);
      setPreviewUrl(imageUrl);
      setData(prev => ({ ...prev, imageUrl }));
      infoAlert("Image uploaded!");
      setUploading(false);
    }
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setData(prev => ({ ...prev, [name]: value }));
    setError(prev => ({ ...prev, [name]: "" }));
  };

  const updateTokenTicker = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTokenSearch(val);
    setNeededDataError(false);
    setSelectedToken(null);
    setSelectedDexToken(null);
    setData(prev => ({ ...prev, feedId: "" }));
    const currentContent = marketField[marketFieldIndex].content[marketFieldContentIndex];
    const apiName = currentContent.api_name;

    if (apiName === "CoinGecko") {
      setTokenDropdownOpen(val.length > 0);
    } else if (apiName === "Dexscreener") {
      setTokenDropdownOpen(val.length > 1);
      if (val.length > 1) {
        setSearchingDex(true);
        try {
          const res = await axios.get(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(val)}`);
          if (res.data.pairs?.length > 0) {
            const tokenMap = new Map<string, DexToken>();
            for (const pair of res.data.pairs) {
              const base = pair.baseToken;
              if (!base?.name || !base?.symbol) continue;
              const key = `${base.name.toLowerCase()}_${base.symbol.toLowerCase()}`;
              const mc = pair.marketCap || pair.fdv || 0;
              const existing = tokenMap.get(key);
              if (!existing || mc > (existing.market_cap || 0)) {
                tokenMap.set(key, { name: base.name, symbol: base.symbol, address: base.address, market_cap: mc });
              }
            }
            const sorted = Array.from(tokenMap.values()).sort((a, b) => (b.market_cap || 0) - (a.market_cap || 0));
            setDexTokenList(sorted);
          } else {
            setDexTokenList([]);
          }
        } catch { setDexTokenList([]); }
        setSearchingDex(false);
      } else {
        setDexTokenList([]);
      }
      setData(prev => ({ ...prev, feedName: val }));
    } else {
      setTokenDropdownOpen(false);
      setData(prev => ({ ...prev, feedName: val }));
    }
  };

  const changeDataSource = (index: number) => {
    setMarketFieldContentIndex(index);
    setMarketFieldContentOpen(false);
    setData(prev => ({
      ...prev, marketField: marketFieldIndex, apiType: index, range: 0, direction: "above", question: "",
      feedName: "", feedId: "", dataLink: "", date: "", task: "", value: 0, creator: "", description: ""
    }));
    setTokenSearch("");
    setTokenDisplayName("");
    setSelectedToken(null);
    setSelectedDexToken(null);
    setFreeTextQuestion("");
    setTweetUrl("");
    setTweetData(null);
    setTweetError(null);
  };

  // Fetch tweet data when URL is pasted
  const fetchTweet = async () => {
    if (!tweetUrl.trim()) return;
    setTweetLoading(true);
    setTweetError(null);
    setTweetData(null);
    try {
      // Extract tweet ID from URL
      const idMatch = tweetUrl.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/) || tweetUrl.match(/^(\d+)$/);
      const tweetId = idMatch?.[1];
      if (!tweetId) { setTweetError("Invalid tweet URL. Use a twitter.com or x.com link."); setTweetLoading(false); return; }
      const res = await axios.get(`${API_ENDPOINTS.TWITTER.TWEET}/${tweetId}`);
      if (res.data?.success && res.data?.data) {
        setTweetData(res.data.data);
        setData(prev => ({ ...prev, feedId: tweetId, feedName: `@${res.data.data.authorHandle}`, imageUrl: res.data.data.authorAvatar || "" }));
        if (res.data.data.authorAvatar) setPreviewUrl(res.data.data.authorAvatar);
      } else {
        setTweetError("Tweet not found or API error.");
      }
    } catch (err: any) {
      setTweetError(err?.response?.data?.error || "Failed to fetch tweet. Check the URL and try again.");
    }
    setTweetLoading(false);
  };

  const onSubmit = async () => {
    if (!isConnected || !address || !signer) { warningAlert("Please connect wallet!"); return; }
    if (!isChecked) { setError(prev => ({ ...prev, checkbox: "Please accept" })); return; }

    // Multi-outcome validation
    if (marketTypeChoice === "multi") {
      if (!eventQuestion.trim()) { errorAlert("Please enter an event question"); return; }
      const validOutcomes = outcomes.filter(o => o.trim());
      if (validOutcomes.length < 2) { errorAlert("Please add at least 2 outcomes"); return; }
    }

    setActive(false);
    try {
      const currentField = marketField[marketFieldIndex];
      const currentContent = currentField.content[marketFieldContentIndex];

      // Compute effective date
      let effectiveDate = data.date;
      if (isAdmin && (marketTag === "demo" || marketTag === "test")) {
        effectiveDate = new Date(Date.now() + quickTimer * 60 * 1000).toISOString();
      }
      if (!effectiveDate || isNaN(new Date(effectiveDate).getTime())) {
        errorAlert("Please select a valid resolution date");
        setActive(true);
        return;
      }

      const readableDate = new Date(effectiveDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

      // ===== MULTI-OUTCOME FLOW =====
      if (marketTypeChoice === "multi") {
        const validOutcomes = outcomes.filter(o => o.trim());
        const groupId = `event_${Date.now()}`;

        infoAlert("Creating multi-outcome event on-chain... Please confirm in MetaMask.");

        // Single on-chain transaction for all outcomes
        await createMultiOutcomeEvent({
          eventId: groupId,
          question: eventQuestion.trim(),
          outcomeNames: validOutcomes.map(o => o.trim()),
          date: effectiveDate,
          liquidityGoal: Number(liquidityGoal) || 100,
          signer,
        });

        // Save all outcomes to DB in one API call
        await axios.post(API_ENDPOINTS.MARKET.CREATE_MULTI_EVENT, {
          eventGroupId: groupId,
          eventQuestion: eventQuestion.trim(),
          outcomeNames: validOutcomes.map(o => o.trim()),
          marketField: marketFieldIndex,
          apiType: marketFieldContentIndex,
          date: effectiveDate,
          imageUrl: data.imageUrl || "/fund.png",
          creator: address,
          feedName: currentContent.api_name || "Multi",
          feedId: "",
          description: data.description || "",
          marketTag: isAdmin ? marketTag : "normal",
        });

        successAlert("Multi-outcome event created with 1 transaction!");
        router.push("/fund");
        setActive(true);
        return;
      }

      // ===== BINARY FLOW (existing) =====
      let submitData: any = { ...data, creator: address, marketField: marketFieldIndex, apiType: marketFieldContentIndex, date: effectiveDate };

      if (isTweet) {
        // Tweet market mode
        if (!tweetData) { errorAlert("Please fetch a tweet first"); setActive(true); return; }
        if (!data.value || Number(data.value) <= 0) { errorAlert("Please enter a target value"); setActive(true); return; }
        const currentContent = marketField[marketFieldIndex].content[marketFieldContentIndex] as any;
        const metricLabel = currentContent.api_name; // Views, Likes, Retweets, Comments
        submitData.question = `Will @${tweetData.authorHandle}'s tweet hit ${formatNumber(Number(data.value))} ${metricLabel.toLowerCase()} by ${readableDate}?`;
        submitData.feedName = `Tweets · ${metricLabel}`;
        submitData.feedId = tweetData.tweetId;
        submitData.dataLink = tweetUrl;
        submitData.imageUrl = tweetData.authorAvatar || data.imageUrl;
        submitData.task = "";
        submitData.direction = "above"; // Tweet markets are always "will it reach X"
        submitData.range = 0;
      } else if (isFreeText) {
        // Sports / News mode
        if (!freeTextQuestion.trim()) { errorAlert("Please enter a question"); setActive(true); return; }
        submitData.question = freeTextQuestion.trim();
        submitData.feedName = currentContent.api_name; // e.g. "NBA", "Politics"
        submitData.feedId = "";
        submitData.dataLink = "";
        submitData.task = "";
        submitData.value = 0;
        submitData.range = 0;
      } else {
        // Crypto mode — validate token selection + API
        const cryptoContent = currentContent as any;
        if (currentContent.api_name === "CoinGecko") {
          if (!selectedToken) { errorAlert("Please select a token from the dropdown!"); setActive(true); return; }
        } else if (currentContent.api_name === "Dexscreener") {
          if (!selectedDexToken) { errorAlert("Please select a token from the dropdown!"); setActive(true); return; }
        }
        if (!data.value || Number(data.value) <= 0) { errorAlert("Please enter a target value"); setActive(true); return; }

        const params: any[] = [];
        if (currentContent.api_name === "CoinGecko") {
          params.push(selectedToken!.id);
        } else {
          params.push(data.feedName);
        }
        params.push(data.range);

        const api_link = cryptoContent.api_link(...params);
        // Proxy CoinGecko through our API route to avoid CORS; Dexscreener allows CORS
        let proxyUrl = api_link;
        if (api_link.includes("coingecko.com/api/v3")) {
          const cgUrl = new URL(api_link);
          const path = cgUrl.pathname.replace("/api/v3", "");
          const qs = cgUrl.searchParams.toString();
          proxyUrl = `/api/coingecko?path=${path}${qs ? "&" + qs : ""}`;
        }
        let response;
        try {
          response = await axios.get(proxyUrl);
        } catch (apiErr: any) {
          if (apiErr?.response?.status === 404) {
            errorAlert("Token not found on this data source. Try a different token or data provider.");
          } else {
            errorAlert("Failed to fetch token data. Please check your selection and try again.");
          }
          setActive(true);
          return;
        }
        const task = cryptoContent.task(dexIndex, data.range) !== "null"
          ? cryptoContent.task(dexIndex, data.range)
          : (findJsonPathsForKey(JSON.stringify(response.data), data.range ? "market_cap" : "usd")[0] || "");

        const displayName = tokenDisplayName || data.feedName;
        const dirLabel = data.direction === "above" ? "be above" : "fall below";
        submitData.question = data.range
          ? `Will ${displayName} ${dirLabel} a market cap of ${formatNumber(Number(data.value))} by ${readableDate}?`
          : `Will ${displayName} ${dirLabel} $${formatNumber(Number(data.value))} by ${readableDate}?`;
        submitData.dataLink = api_link;
        submitData.task = task;
        submitData.feedName = tokenDisplayName || data.feedName;
        submitData.feedId = data.feedId || data.feedName;
        submitData.direction = data.direction;
      }

      const marketID = `market_${Date.now()}`;

      infoAlert("Creating market on-chain... Please confirm in MetaMask.");
      const onChainResult = await createMarket({
        marketID, date: effectiveDate, value: Number(submitData.value),
        question: submitData.question, accountId: address, signer, liquidityGoal: Number(liquidityGoal) || 100,
      });

      const res = await axios.post(API_ENDPOINTS.MARKET.CREATE, {
        data: { ...submitData, market: marketID, marketTag: isAdmin ? marketTag : "normal" },
        isChecked: true
      });
      if (res.status === 200) { successAlert("Market created successfully!", { txHash: onChainResult.txHash }); router.push(`/fund`); }
    } catch (err: any) {
      console.error("Market creation error:", err);
      errorAlert(err?.message || err?.response?.data?.message || "Error creating market");
    }
    setActive(true);
  };

  // Shared input classes
  const inputCls = "w-full px-4 py-3 text-sm text-[#c9c9c9] bg-[#111] rounded-xl border border-[#2a2a2a] focus:border-[#07b3ff] outline-none transition-all placeholder:text-[#555]";
  const labelCls = "text-[#999] text-xs font-semibold font-satoshi uppercase tracking-wider mb-0.5";
  const dropdownBtnCls = "w-full text-[#999] px-4 py-3 text-sm bg-[#111] rounded-xl border border-[#2a2a2a] flex justify-between items-center hover:border-[#3a3a3a] transition-all cursor-pointer";
  const dropdownItemCls = "px-4 py-2.5 hover:bg-[#1a1a1a] cursor-pointer transition-colors text-white text-sm";
  const chevron = <svg className="w-3.5 h-3.5 text-[#666]" fill="none" viewBox="0 0 10 6"><path stroke="currentColor" strokeWidth="1.5" d="m1 1 4 4 4-4" /></svg>;

  return (
    <div className="px-6 sm:px-10 flex-col self-stretch flex justify-start items-start gap-6 overflow-auto">
      <div className="w-full max-w-[1000px] mx-auto p-8 bg-[#1e1e1e] rounded-2xl border border-[#2a2a2a] flex flex-col gap-7 relative">
        {!active && <div className="absolute inset-0 flex justify-center items-center bg-[#1e1e1e]/60 backdrop-blur-sm z-20 rounded-2xl"><ClipLoader color="#ffffff" size={200} /></div>}

        {/* Header */}
        <div className="flex flex-col gap-1">
          <h1 className="text-white text-2xl font-semibold font-rubik">Create Prediction Market</h1>
          <p className="text-[#666] text-sm font-satoshi">Set up a new prediction market on Hedera in minutes.</p>
        </div>

        {/* Admin Mode Selector */}
        {isAdmin && (
          <div className="p-3 bg-[#111] rounded-xl border border-[#ffd600]/20 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 bg-[#ffd600] rounded text-black text-[10px] font-bold uppercase">Admin</span>
              <span className="text-white text-xs font-semibold font-satoshi">Market Mode</span>
            </div>
            <div className="flex gap-1.5">
              {([["normal", "#07b3ff"], ["demo", "#ff6464"], ["test", "#3fd145"]] as const).map(([tag, color]) => (
                <button key={tag} onClick={() => setMarketTag(tag)} className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-semibold transition-all ${marketTag === tag ? `text-black` : "bg-[#1e1e1e] text-[#666] border border-[#2a2a2a]"}`} style={marketTag === tag ? { backgroundColor: color } : {}}>
                  {tag.charAt(0).toUpperCase() + tag.slice(1)}
                </button>
              ))}
            </div>
            {(marketTag === "demo" || marketTag === "test") && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[#666] text-[10px] font-satoshi">Expires in:</span>
                {(marketTag === "demo" ? [5, 10, 15] : [1, 2, 3, 5]).map((m) => (
                  <button key={m} onClick={() => setQuickTimer(m)} className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${quickTimer === m ? "text-black" : "bg-[#1e1e1e] text-[#666] border border-[#2a2a2a]"}`} style={quickTimer === m ? { backgroundColor: marketTag === "demo" ? "#ff6464" : "#3fd145" } : {}}>{m}m</button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Row 1: Image + Category + Sub-Category/Data Source */}
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex flex-col gap-2 lg:w-[200px] flex-shrink-0">
            <label className={labelCls}>Market Image</label>
            <label className="w-full h-[160px] bg-[#111] rounded-xl cursor-pointer border border-dashed border-[#2a2a2a] flex flex-col justify-center items-center gap-2 relative hover:border-[#07b3ff]/40 transition-all">
              {previewUrl && <img src={previewUrl} alt="Preview" className="absolute inset-0 w-full h-full object-cover rounded-xl" />}
              <FiUpload size={22} color="#07b3ff" />
              <span className="text-[#555] text-xs text-center px-2">
                <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                {isUploading ? "Uploading..." : "Upload image"}
              </span>
            </label>
            <span className="text-[#444] text-[10px]">JPG, PNG. Max 5MB</span>
          </div>
          <div className="flex-1 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5 relative">
              <label className={labelCls}>Market Category</label>
              <button className={dropdownBtnCls} onClick={() => setMarketFieldOpen(!marketFieldOpen)}>
                {marketField[marketFieldIndex].name} {chevron}
              </button>
              {marketFieldOpen && (
                <div className="w-full bg-[#111] rounded-xl border border-[#2a2a2a] absolute left-0 top-[58px] z-10 overflow-hidden">
                  {marketField.map((field, i) => (
                    <div key={i} className={dropdownItemCls} onClick={() => { setMarketFieldIndex(i); setMarketFieldOpen(false); setMarketFieldContentIndex(0); setFreeTextQuestion(""); setTokenSearch(""); setTokenDisplayName(""); setSelectedToken(null); setSelectedDexToken(null); setTweetUrl(""); setTweetData(null); setTweetError(null); }}>{field.name}</div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1.5 relative">
              <label className={labelCls}>{isTweet ? "Metric" : isFreeText ? "Sub-Category" : "Data Source"}</label>
              <button className={dropdownBtnCls} onClick={() => setMarketFieldContentOpen(!marketFieldContentOpen)}>
                {marketField[marketFieldIndex].content[marketFieldContentIndex].api_name} {chevron}
              </button>
              {marketFieldContentOpen && (
                <div className="w-full bg-[#111] rounded-xl border border-[#2a2a2a] absolute left-0 top-[58px] z-10 overflow-hidden">
                  {marketField[marketFieldIndex].content.map((field, i) => (
                    <div key={i} className={dropdownItemCls} onClick={() => changeDataSource(i)}>{field.api_name}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="h-px bg-[#2a2a2a]" />

        {/* Market Type Toggle: Binary vs Multi-Outcome */}
        <div className="flex flex-col gap-2">
          <label className={labelCls}>Market Type</label>
          <div className="flex gap-2">
            <button
              onClick={() => setMarketTypeChoice("binary")}
              className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                marketTypeChoice === "binary"
                  ? "bg-[#07b3ff] text-black"
                  : "bg-[#111] text-[#666] border border-[#2a2a2a]"
              }`}
            >
              Binary (Yes / No)
            </button>
            <button
              onClick={() => setMarketTypeChoice("multi")}
              className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                marketTypeChoice === "multi"
                  ? "bg-[#07b3ff] text-black"
                  : "bg-[#111] text-[#666] border border-[#2a2a2a]"
              }`}
            >
              Multi-Outcome
            </button>
          </div>
        </div>

        {/* Multi-Outcome: Event Question + Outcomes */}
        {marketTypeChoice === "multi" && (
          <div className="flex flex-col gap-4 p-4 bg-[#111] rounded-xl border border-[#2a2a2a]">
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Event Question</label>
              <input
                className={inputCls}
                placeholder="e.g. Who will win the 2026 FIFA World Cup?"
                value={eventQuestion}
                onChange={(e) => setEventQuestion(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className={labelCls}>Outcomes (min 2, max 10)</label>
              {outcomes.map((outcome, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[#555] text-xs w-5 text-center">{i + 1}</span>
                  <input
                    className={`${inputCls} flex-1`}
                    placeholder={`Outcome ${i + 1} (e.g. ${i === 0 ? "Brazil" : i === 1 ? "Germany" : "France"})`}
                    value={outcome}
                    onChange={(e) => {
                      const updated = [...outcomes];
                      updated[i] = e.target.value;
                      setOutcomes(updated);
                    }}
                  />
                  {outcomes.length > 2 && (
                    <button
                      onClick={() => setOutcomes(outcomes.filter((_, idx) => idx !== i))}
                      className="text-[#ff6464] text-xs font-bold px-2 py-1 hover:bg-[#3a2222] rounded-lg transition-colors"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              {outcomes.length < 10 && (
                <button
                  onClick={() => setOutcomes([...outcomes, ""])}
                  className="self-start px-3 py-1.5 text-[#07b3ff] text-xs font-semibold bg-[#07b3ff]/10 rounded-lg hover:bg-[#07b3ff]/20 transition-colors"
                >
                  + Add Outcome
                </button>
              )}
            </div>
          </div>
        )}

        {/* Question Preview */}
        <div className="p-5 bg-[#111] rounded-xl border border-[#07b3ff]/20 flex items-start gap-3">
          <GoQuestion size={22} className="text-[#07b3ff] flex-shrink-0 mt-0.5" />
          <div className="flex flex-col gap-1.5">
            <span className="text-[#666] text-[11px] font-semibold uppercase tracking-wider">Question Preview</span>
            <span className="text-[#07b3ff] text-base font-medium">
              {marketTypeChoice === "multi"
                ? (eventQuestion
                  ? <span>{eventQuestion}<br/><span className="text-[#666] text-xs">{outcomes.filter(o => o.trim()).map(o => o.trim()).join(" • ") || "Add outcomes below..."}</span></span>
                  : "Enter your event question above..."
                )
                : isTweet
                ? (tweetData
                  ? `Will @${tweetData.authorHandle}'s tweet hit ${data.value ? formatNumber(Number(data.value)) : "___"} ${(marketField[marketFieldIndex].content[marketFieldContentIndex] as any).api_name?.toLowerCase() || "___"} by ${(isAdmin && (marketTag === "demo" || marketTag === "test")) ? `~${quickTimer}min` : (data.date ? new Date(data.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "___")}?`
                  : "Paste a tweet URL to get started...")
                : isFreeText
                ? (freeTextQuestion || "Enter your question below...")
                : `Will ${tokenDisplayName || "___"} ${data.direction === "above" ? "be above" : "fall below"} ${data.range === 0 ? "$" : "a market cap of $"}${data.value ? formatNumber(Number(data.value)) : "___"} by ${(isAdmin && (marketTag === "demo" || marketTag === "test")) ? `~${quickTimer}min` : (data.date ? new Date(data.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "___")}?`
              }
            </span>
          </div>
        </div>

        {/* Row 2: Conditional form fields */}
        {marketTypeChoice === "multi" ? (
          /* Multi-outcome: just need a resolution date */
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 flex flex-col gap-1.5">
              <label className={labelCls}>
                {isAdmin && (marketTag === "demo" || marketTag === "test") ? `Auto: ~${quickTimer}min` : "Resolution Date"}
              </label>
              {isAdmin && (marketTag === "demo" || marketTag === "test") ? (
                <div className="px-3 py-2.5 text-sm text-[#07b3ff] bg-[#111] rounded-xl border border-[#2a2a2a]">
                  {new Date(Date.now() + quickTimer * 60 * 1000).toLocaleString()}
                </div>
              ) : (
                <input className={`${inputCls} [color-scheme:dark]`} type="datetime-local" name="date" value={data.date} onChange={onInputChange} />
              )}
            </div>
          </div>
        ) : isTweet ? (
          <div className="flex flex-col gap-4">
            {/* Tweet URL input */}
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Tweet URL</label>
              <div className="flex gap-2">
                <input className={`${inputCls} flex-1`} placeholder="Paste a tweet URL (e.g. https://x.com/user/status/123...)" value={tweetUrl} onChange={(e) => { setTweetUrl(e.target.value); setTweetError(null); }} />
                <button onClick={fetchTweet} disabled={tweetLoading || !tweetUrl.trim()} className="px-5 py-3 bg-[#07b3ff] hover:bg-[#07b3ff]/80 disabled:opacity-40 text-black text-xs font-semibold rounded-xl transition-all whitespace-nowrap">
                  {tweetLoading ? "Fetching..." : "Fetch Tweet"}
                </button>
              </div>
              {tweetError && <span className="text-red-400 text-xs">{tweetError}</span>}
            </div>

            {/* Tweet preview */}
            {tweetData && (
              <div className="p-4 bg-[#111] rounded-xl border border-[#2a2a2a]">
                <div className="flex gap-3">
                  {tweetData.authorAvatar && <img src={tweetData.authorAvatar} alt="" className="w-10 h-10 rounded-full flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white text-sm font-semibold">{tweetData.authorName}</span>
                      <span className="text-[#666] text-xs">@{tweetData.authorHandle}</span>
                    </div>
                    <p className="text-[#ccc] text-xs leading-relaxed line-clamp-4">{tweetData.text?.replace(/https?:\/\/t\.co\/\S+/g, "").trim()}</p>
                  </div>
                </div>
                {/* Media: thumbnail preview for all types, click opens on X */}
                {tweetData.media && tweetData.media.length > 0 && (
                  <div className="mt-3 rounded-lg overflow-hidden border border-[#2a2a2a] max-w-[360px]" style={{ maxHeight: "200px" }}>
                    {tweetData.media.length === 1 ? (
                      <div className="block relative" style={{ maxHeight: "200px" }}>
                        <img src={tweetData.media[0].previewUrl || tweetData.media[0].url} alt="" className="w-full object-cover" style={{ maxHeight: "200px" }} />
                        {(tweetData.media[0].type === "video" || tweetData.media[0].type === "animated_gif") && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none">
                            <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="#000"><path d="M8 5v14l11-7z"/></svg>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-px" style={{ maxHeight: "200px" }}>
                        {tweetData.media.slice(0, 4).map((m: any, i: number) => (
                          <div key={i} className="relative overflow-hidden" style={{ height: "100px" }}>
                            <img src={m.previewUrl || m.url} alt="" className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div className="flex items-center justify-between mt-3">
                  <div className="flex gap-4">
                    <span className="text-[#666] text-[10px]">Views: <span className="text-white font-semibold">{formatNumber(tweetData.views)}</span></span>
                    <span className="text-[#666] text-[10px]">Likes: <span className="text-white font-semibold">{formatNumber(tweetData.likes)}</span></span>
                    <span className="text-[#666] text-[10px]">Retweets: <span className="text-white font-semibold">{formatNumber(tweetData.retweets)}</span></span>
                    <span className="text-[#666] text-[10px]">Comments: <span className="text-white font-semibold">{formatNumber(tweetData.comments)}</span></span>
                  </div>
                  <a href={tweetUrl} target="_blank" rel="noopener noreferrer" className="text-[#07b3ff] text-[10px] font-semibold hover:underline">View on X</a>
                </div>
              </div>
            )}

            {/* Metric + Target + Date row */}
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1 flex flex-col gap-1.5">
                <label className={labelCls}>Target Value</label>
                <input className={inputCls} type="number" name="value" placeholder="e.g. 1000000" value={data.value || ""} onChange={onInputChange} />
                {/* Preset buttons */}
                {(marketField[marketFieldIndex].content[marketFieldContentIndex] as any)?.presets && (
                  <div className="flex gap-1.5 mt-1">
                    {((marketField[marketFieldIndex].content[marketFieldContentIndex] as any).presets as number[]).map((preset) => (
                      <button key={preset} onClick={() => setData(prev => ({ ...prev, value: preset }))} className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] font-semibold transition-all ${Number(data.value) === preset ? "bg-[#07b3ff] text-black" : "bg-[#1e1e1e] text-[#666] border border-[#2a2a2a]"}`}>
                        {formatNumber(preset)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex-1 flex flex-col gap-1.5">
                <label className={labelCls}>
                  {isAdmin && (marketTag === "demo" || marketTag === "test") ? `Auto: ~${quickTimer}min` : "Resolution Date"}
                </label>
                {isAdmin && (marketTag === "demo" || marketTag === "test") ? (
                  <div className="px-3 py-2.5 text-sm text-[#07b3ff] bg-[#111] rounded-xl border border-[#2a2a2a]">
                    {new Date(Date.now() + quickTimer * 60 * 1000).toLocaleString()}
                  </div>
                ) : (
                  <input className={`${inputCls} [color-scheme:dark]`} type="datetime-local" name="date" value={data.date} onChange={onInputChange} />
                )}
              </div>
            </div>

            {/* Current metric warning */}
            {tweetData && data.value > 0 && (() => {
              const metricKey = (marketField[marketFieldIndex].content[marketFieldContentIndex] as any)?.metric;
              const currentVal = metricKey === "VIEWS" ? tweetData.views : metricKey === "LIKES" ? tweetData.likes : metricKey === "RETWEETS" ? tweetData.retweets : tweetData.comments;
              if (currentVal >= Number(data.value)) {
                return (
                  <div className="p-3 bg-[#3a2222]/30 rounded-xl border border-[#ff6464]/20 flex items-center gap-2">
                    <span className="text-[#ff6464] text-sm leading-none">&#9888;</span>
                    <span className="text-[#ff6464] text-xs font-satoshi">
                      Current {metricKey?.toLowerCase()} is {formatNumber(currentVal)} — already above your target of {formatNumber(Number(data.value))}. This market would resolve YES immediately.
                    </span>
                  </div>
                );
              }
              return null;
            })()}
          </div>
        ) : isFreeText ? (
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-[2] flex flex-col gap-1.5">
              <label className={labelCls}>Question</label>
              <input className={`${inputCls} ${needDataError ? "border-red-500" : ""}`} placeholder="e.g. Will the Lakers win the NBA Championship?" value={freeTextQuestion} onChange={(e) => { setFreeTextQuestion(e.target.value); setNeededDataError(false); }} />
              {needDataError && <span className="text-red-400 text-[10px]">Required</span>}
            </div>
            <div className="flex-1 flex flex-col gap-1.5">
              <label className={labelCls}>
                {isAdmin && (marketTag === "demo" || marketTag === "test") ? `Auto: ~${quickTimer}min` : "Resolution Date"}
              </label>
              {isAdmin && (marketTag === "demo" || marketTag === "test") ? (
                <div className="px-3 py-2.5 text-sm text-[#07b3ff] bg-[#111] rounded-xl border border-[#2a2a2a]">
                  {new Date(Date.now() + quickTimer * 60 * 1000).toLocaleString()}
                </div>
              ) : (
                <input className={`${inputCls} [color-scheme:dark]`} type="datetime-local" name="date" value={data.date} onChange={onInputChange} />
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 flex flex-col gap-1.5 relative">
              <label className={labelCls}>Token / Feed</label>
              <input id="feedName" className={`${inputCls} ${needDataError ? "border-red-500" : ""}`} placeholder="Search token (e.g. Bitcoin, ETH...)" value={tokenSearch} onChange={updateTokenTicker} />
              {needDataError && <span className="text-red-400 text-[10px]">Required</span>}
              {tokenDropdownOpen && tokenSearch.length > 0 && (
                <div className="absolute top-[62px] left-0 w-full max-h-[200px] overflow-y-auto bg-[#111] border border-[#2a2a2a] rounded-xl z-20">
                  {marketField[marketFieldIndex].content[marketFieldContentIndex].api_name === "CoinGecko" ? (
                    tokenList.filter(t => t.name.toLowerCase().includes(tokenSearch.toLowerCase()) || t.symbol.toLowerCase().includes(tokenSearch.toLowerCase())).slice(0, 20).map((token) => (
                      <div key={token.id} className={`${dropdownItemCls} flex items-center justify-between`} onClick={() => {
                        setSelectedToken(token); setTokenSearch(token.name); setTokenDisplayName(token.name);
                        setData(prev => ({ ...prev, feedName: token.id, feedId: token.id })); setTokenDropdownOpen(false);
                      }}>
                        <div className="flex items-center gap-2">
                          {token.image && <img src={token.image} alt="" className="w-5 h-5 rounded-full" />}
                          <span className="text-white">{token.name}</span>
                          <span className="text-[#666] uppercase text-xs">{token.symbol}</span>
                        </div>
                        {token.market_cap ? <span className="text-[#555] text-xs">${formatNumber(token.market_cap)}</span> : null}
                      </div>
                    ))
                  ) : (
                    searchingDex ? (
                      <div className="px-4 py-3 text-[#666] text-sm">Searching...</div>
                    ) : dexTokenList.length === 0 ? (
                      <div className="px-4 py-3 text-[#666] text-sm">No tokens found</div>
                    ) : (
                      dexTokenList.slice(0, 20).map((token) => (
                        <div key={token.address} className={`${dropdownItemCls} flex items-center justify-between`} onClick={() => {
                          setSelectedDexToken(token); setTokenSearch(token.name); setTokenDisplayName(`${token.name} (${token.symbol.toUpperCase()})`);
                          setData(prev => ({ ...prev, feedName: token.address, feedId: token.address })); setTokenDropdownOpen(false);
                        }}>
                          <div className="flex items-center gap-2">
                            <span className="text-white">{token.name}</span>
                            <span className="text-[#666] uppercase text-xs">{token.symbol}</span>
                          </div>
                          {token.market_cap ? <span className="text-[#555] text-xs">${formatNumber(token.market_cap)}</span> : null}
                        </div>
                      ))
                    )
                  )}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1.5 lg:w-[140px]">
              <label className={labelCls}>Metric</label>
              <div className="flex gap-1.5">
                {["Price", "MCap"].map((label, i) => (
                  <button key={i} onClick={() => setData(prev => ({ ...prev, range: i }))} className={`flex-1 px-2 py-2.5 rounded-xl text-xs font-semibold transition-all ${data.range === i ? "bg-[#07b3ff] text-black" : "bg-[#111] text-[#666] border border-[#2a2a2a]"}`}>{label}</button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1.5 lg:w-[140px]">
              <label className={labelCls}>Direction</label>
              <div className="flex gap-1.5">
                {([["above", "Above"], ["below", "Below"]] as const).map(([val, label]) => (
                  <button key={val} onClick={() => setData(prev => ({ ...prev, direction: val }))} className={`flex-1 px-2 py-2.5 rounded-xl text-xs font-semibold transition-all ${data.direction === val ? (val === "above" ? "bg-[#3fd145] text-black" : "bg-[#ff6464] text-black") : "bg-[#111] text-[#666] border border-[#2a2a2a]"}`}>{label}</button>
                ))}
              </div>
            </div>
            <div className="flex-1 flex flex-col gap-1.5">
              <label className={labelCls}>Target Value ($)</label>
              <input className={inputCls} type="number" name="value" placeholder="e.g. 100000" value={data.value || ""} onChange={onInputChange} />
            </div>
            <div className="flex-1 flex flex-col gap-1.5">
              <label className={labelCls}>
                {isAdmin && (marketTag === "demo" || marketTag === "test") ? `Auto: ~${quickTimer}min` : "Resolution Date"}
              </label>
              {isAdmin && (marketTag === "demo" || marketTag === "test") ? (
                <div className="px-3 py-2.5 text-sm text-[#07b3ff] bg-[#111] rounded-xl border border-[#2a2a2a]">
                  {new Date(Date.now() + quickTimer * 60 * 1000).toLocaleString()}
                </div>
              ) : (
                <input className={`${inputCls} [color-scheme:dark]`} type="datetime-local" name="date" value={data.date} onChange={onInputChange} />
              )}
            </div>
          </div>
        )}

        {/* Price Warning */}
        {!isFreeText && currentPrice !== null && data.value > 0 && (
          (data.direction === "above" && currentPrice >= Number(data.value)) ? (
            <div className="p-3 bg-[#3a2222]/30 rounded-xl border border-[#ff6464]/20 flex items-center gap-2">
              <span className="text-[#ff6464] text-sm leading-none">⚠</span>
              <span className="text-[#ff6464] text-xs font-satoshi">
                Current {data.range === 1 ? "market cap" : "price"} is ${currentPrice.toLocaleString(undefined, { maximumFractionDigits: data.range === 1 ? 0 : 2 })} — already above your target of ${formatNumber(Number(data.value))}. This market would resolve YES immediately at expiry.
              </span>
            </div>
          ) : (data.direction === "below" && currentPrice <= Number(data.value)) ? (
            <div className="p-3 bg-[#3a2222]/30 rounded-xl border border-[#ff6464]/20 flex items-center gap-2">
              <span className="text-[#ff6464] text-sm leading-none">⚠</span>
              <span className="text-[#ff6464] text-xs font-satoshi">
                Current {data.range === 1 ? "market cap" : "price"} is ${currentPrice.toLocaleString(undefined, { maximumFractionDigits: data.range === 1 ? 0 : 2 })} — already below your target of ${formatNumber(Number(data.value))}. This market would resolve YES immediately at expiry.
              </span>
            </div>
          ) : null
        )}

        {/* Row 3: Description + Liquidity Goal */}
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 flex flex-col gap-1.5">
            <label className={labelCls}>Description</label>
            <textarea className={`${inputCls} min-h-[100px] resize-none`} name="description" placeholder="Brief description of this market..." value={data.description} onChange={onInputChange} />
          </div>
          <div className="lg:w-[220px] flex flex-col gap-2">
            <label className={labelCls}>Liquidity Goal (HBAR)</label>
            <input className={inputCls} type="number" min="1" value={liquidityGoal} onChange={(e) => { const v = e.target.value; if (v === "" || Number(v) >= 0) setLiquidityGoal(v); }} placeholder="100" />
            <span className="text-[#444] text-[10px]">Min funding needed to activate</span>
          </div>
        </div>

        <div className="h-px bg-[#2a2a2a]" />

        {/* Terms + Submit */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isChecked} onChange={() => { setIsChecked(!isChecked); setError(prev => ({ ...prev, checkbox: "" })); }} className="w-4 h-4 accent-[#07b3ff] rounded" />
            <span className="text-[#666] text-xs font-satoshi">I agree to the terms and conditions</span>
            {error.checkbox && <span className="text-red-400 text-[10px]">{error.checkbox}</span>}
          </label>
          <button onClick={onSubmit} disabled={!active} className="px-10 py-3 bg-[#07b3ff] hover:bg-[#07b3ff]/80 disabled:opacity-40 text-black text-sm font-semibold rounded-xl transition-all active:scale-95">
            {active ? "Create Market" : "Creating..."}
          </button>
        </div>

      </div>
    </div>
  );
}
