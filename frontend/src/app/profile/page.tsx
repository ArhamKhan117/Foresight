"use client";
import HistoryItem from "@/components/elements/profile/HistoryItem";
import ProfileFundItem from "@/components/elements/profile/ProfileFundItem";
import ProfileNavbar from "@/components/elements/profile/ProfileNavbar";
import ProfileProposeItem from "@/components/elements/profile/ProfileProposeItem";
import { useMetaMask } from "@/providers/MetaMaskProvider";
import axios from "axios";
import { API_ENDPOINTS } from "@/config/api";
import { useEffect, useState, useRef } from "react";
import { getCached, setCache, isStale } from "@/utils/cache";
import { uploadToPinata } from "@/utils";
import { FaWallet, FaChartLine, FaDice, FaHandHoldingUsd, FaUsers, FaCoins, FaLayerGroup, FaFileAlt, FaCamera } from "react-icons/fa";

// Default avatar — Twitter/Instagram-style silhouette
const DEFAULT_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='32' fill='%23333'/%3E%3Ccircle cx='32' cy='24' r='10' fill='%23555'/%3E%3Cellipse cx='32' cy='52' rx='18' ry='14' fill='%23555'/%3E%3C/svg%3E";

const truncAddr = (key: string) => {
  if (!key) return "";
  return `${key.slice(0, 6)}...${key.slice(-4)}`;
};

export default function Profile() {
  const [activeTab, setActiveTab] = useState<"Betting History" | "Funded Market" | "Proposed Market">("Betting History");
  const [profileData, setProfileData] = useState<any>();
  const [avatarUrl, setAvatarUrl] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { address, isConnected } = useMetaMask();

  // Fetch avatar
  useEffect(() => {
    if (!isConnected || !address) return;
    (async () => {
      try {
        const res = await axios.get(`${API_ENDPOINTS.PROFILE.AVATAR}?wallet=${address}`);
        if (res.data?.data?.avatarUrl) setAvatarUrl(res.data.data.avatarUrl);
      } catch (err) { /* ignore */ }
    })();
  }, [address, isConnected]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !address) return;
    setUploadingAvatar(true);
    try {
      const url = await uploadToPinata(file);
      if (url) {
        await axios.post(API_ENDPOINTS.PROFILE.SET_AVATAR, { wallet: address, avatarUrl: url });
        setAvatarUrl(url);
      }
    } catch (err) { console.error("Avatar upload failed:", err); }
    setUploadingAvatar(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  useEffect(() => {
    if (!isConnected || !address) return;
    const cacheKey = `profile:${address}`;
    const cached = getCached<any>(cacheKey);
    if (cached) setProfileData(cached);

    if (isStale(cacheKey)) {
      (async () => {
        try {
          const res = await axios.get(`${API_ENDPOINTS.PROFILE.GET}?wallet=${address}`);
          setCache(cacheKey, res.data);
          setProfileData(res.data);
        } catch (error) {
          console.error("Error fetching profile:", error);
        }
      })();
    }
  }, [address, isConnected]);

  if (!isConnected) {
    return (
      <div className="flex-1 flex justify-center items-center px-6 py-20">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#282828] flex items-center justify-center">
            <FaWallet className="text-[#07b3ff] text-2xl" />
          </div>
          <p className="text-white text-xl font-medium mb-2">Connect Your Wallet</p>
          <p className="text-[#666] text-sm">Connect your wallet to view your profile and activity</p>
        </div>
      </div>
    );
  }

  const fmt = (v: any) => {
    const n = Number(v);
    if (isNaN(n)) return "0";
    return n.toFixed(2);
  };

  const stats = [
    { label: "Portfolio Value", value: `${fmt(profileData?.totalProfileValue)} HBAR`, icon: FaChartLine, color: "#07b3ff" },
    { label: "Active Bets", value: profileData?.activeBet || 0, icon: FaDice, color: "#3fd145" },
    { label: "Total Bets", value: profileData?.totalBet || 0, icon: FaLayerGroup, color: "#ff6464" },
    { label: "Bet Volume", value: `${fmt(profileData?.earnedBet)} HBAR`, icon: FaCoins, color: "#ffd600" },
    { label: "Liquidity Provided", value: `${fmt(profileData?.totalLiquidityProvided)} HBAR`, icon: FaHandHoldingUsd, color: "#07b3ff" },
    { label: "LP Fees Earned", value: `${fmt(profileData?.earnedFeeLiquidity)} HBAR`, icon: FaCoins, color: "#3fd145" },
    { label: "Proposed Markets", value: profileData?.totalProposedMarket || 0, icon: FaFileAlt, color: "#ff6464" },
    { label: "Referrals", value: profileData?.totalreferrals || 0, icon: FaUsers, color: "#ffd600" },
  ];

  return (
    <div className="self-stretch px-6 sm:px-10 flex flex-col gap-6 overflow-auto pb-8">
      {/* Profile Header */}
      <div className="w-full p-6 bg-[#1e1e1e] rounded-2xl border border-[#2a2a2a] flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="relative group flex-shrink-0">
          <img
            src={avatarUrl || DEFAULT_AVATAR}
            alt="Profile"
            className="w-14 h-14 rounded-full object-cover border-2 border-[#2a2a2a]"
          />
          <input type="file" ref={fileInputRef} accept="image/*" onChange={handleAvatarUpload} className="hidden" />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingAvatar}
            className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
          >
            {uploadingAvatar ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
            ) : (
              <FaCamera className="text-white text-lg" />
            )}
          </button>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-white text-xl font-semibold font-rubik">{truncAddr(address || "")}</span>
            <span className="px-2.5 py-1 bg-[#07b3ff]/10 text-[#07b3ff] text-xs font-semibold rounded-lg">Connected</span>
          </div>
          <p className="text-[#666] text-sm mt-1 font-satoshi">{address}</p>
        </div>

      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((stat, i) => (
          <div key={i} className="p-4 bg-[#1e1e1e] rounded-xl border border-[#2a2a2a] flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <stat.icon className="text-sm" style={{ color: stat.color }} />
              <span className="text-[#666] text-xs font-satoshi">{stat.label}</span>
            </div>
            <span className="text-white text-lg font-semibold font-satoshi">{stat.value}</span>
          </div>
        ))}
      </div>

      {/* Tabs + Content */}
      <div className="flex flex-col gap-4">
        <ProfileNavbar activeTab={activeTab} onTabChange={setActiveTab} />

        <div className="flex flex-col gap-3">
          {activeTab === "Betting History" && (
            <>
              {profileData?.bettingHistory?.length > 0 ? (
                profileData.bettingHistory.map((item: any, index: number) => <HistoryItem key={index} {...item} />)
              ) : (
                <div className="p-8 bg-[#1e1e1e] rounded-xl border border-[#2a2a2a] text-center">
                  <FaDice className="text-[#333] text-3xl mx-auto mb-3" />
                  <p className="text-[#666] text-sm">No betting history yet</p>
                </div>
              )}
            </>
          )}

          {activeTab === "Funded Market" && (
            <>
              {profileData?.fundedMarkets?.length > 0 ? (
                profileData.fundedMarkets.map((fund: any, index: number) => <ProfileFundItem key={index} {...fund} />)
              ) : (
                <div className="p-8 bg-[#1e1e1e] rounded-xl border border-[#2a2a2a] text-center">
                  <FaHandHoldingUsd className="text-[#333] text-3xl mx-auto mb-3" />
                  <p className="text-[#666] text-sm">No funded markets yet</p>
                </div>
              )}
            </>
          )}

          {activeTab === "Proposed Market" && (
            <>
              {profileData?.proposedMarket?.length > 0 ? (
                profileData.proposedMarket.map((proposal: any, index: number) => <ProfileProposeItem key={index} {...proposal} />)
              ) : (
                <div className="p-8 bg-[#1e1e1e] rounded-xl border border-[#2a2a2a] text-center">
                  <FaFileAlt className="text-[#333] text-3xl mx-auto mb-3" />
                  <p className="text-[#666] text-sm">No proposed markets yet</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
