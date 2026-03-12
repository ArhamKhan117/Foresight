"use client";

import ReferralItem from "@/components/elements/referral/ReferralItem";
import { LuCopy } from "react-icons/lu";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { FaUserFriends, FaCoins } from "react-icons/fa";
import toast from "react-hot-toast";
import axios from "axios";
import { useMetaMask } from "@/providers/MetaMaskProvider";
import { API_ENDPOINTS } from "@/config/api";
import { errorAlert } from "@/components/elements/ToastGroup";
import { ReferralType } from "@/types/type";

export default function Referral() {
  const [copied, setCopied] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [updating, setUpdating] = useState(true);
  const [referrals, setReferrals] = useState<ReferralType[] | null>([]);
  const { address, isConnected } = useMetaMask();

  const handleCopy = () => {
    navigator.clipboard.writeText(referralCode);
    setCopied(true);
    toast.success("Referral link copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    setUpdating(true);

    const ref = new URLSearchParams(window.location.search).get("ref");
    if (!isConnected || !address) {
      setUpdating(false);
      return;
    }
    
    (async () => {
      try {
        const res = await axios.post(API_ENDPOINTS.REFERRAL.GET_OR_GENERATE, {
          wallet: address,
          referralCode: ref || ""
        });
        setReferralCode(`${window.location.origin}/referral?ref=${res.data.code}`);
        setReferrals(res.data.referrals);
      } catch (error) {
        console.error("Error fetching referral:", error);
      }
      setUpdating(false);
    })();
  }, [address, isConnected]);

  if (!isConnected) {
    return (
      <div className="w-full max-w-[1200px] mx-auto px-6 py-12 flex flex-col gap-8">
        <div className="text-white text-2xl text-center">Please connect your wallet to view referrals</div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1200px] mx-auto px-6 py-12 flex flex-col gap-8">
      {/* Stats Section */}
      <div className="grid grid-cols-2 gap-6">
        <motion.div 
          whileHover={{ scale: 1.02 }}
          className="p-6 bg-gradient-to-r from-[#1e1e1e] to-[#282828] rounded-xl border border-[#313131]"
        >
          <div className="flex items-center gap-3 mb-2">
            <FaUserFriends className="text-[#00b4d8] text-xl" />
            <h3 className="text-white text-lg font-medium">Active Referrals</h3>
          </div>
          <p className="text-[#00b4d8] text-2xl font-bold">{referrals?.length || 0}</p>
        </motion.div>
        <motion.div 
          whileHover={{ scale: 1.02 }}
          className="p-6 bg-gradient-to-r from-[#1e1e1e] to-[#282828] rounded-xl border border-[#313131]"
        >
          <div className="flex items-center gap-3 mb-2">
            <FaCoins className="text-[#00b4d8] text-xl" />
            <h3 className="text-white text-lg font-medium">Total Earnings</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[#00b4d8] text-2xl font-bold">
              {referrals?.reduce((sum, i) => sum + i.fee, 0) || 0} HBAR
            </span>
          </div>
        </motion.div>
      </div>

      {/* Referral Link Section */}
      <div className="flex flex-col gap-3">
        <h2 className="text-white text-2xl font-medium font-rubik">Your Foresight Referral Link</h2>
        <p className="text-[#838587] text-sm">Share this unique link with friends. When they join and trade, you earn HBAR rewards.</p>
        <div className="h-[60px] p-2 bg-[#1e1e1e] rounded-xl border border-[#313131] flex items-center gap-3">
          <div className="flex-1 px-6 py-3 rounded-lg overflow-hidden">
            <div className="text-[#07b3ff] text-lg font-medium font-satoshi truncate">
              {updating ? "Generating your link..." : referralCode}
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleCopy}
            className="px-4 py-3 bg-[#282828] rounded-xl cursor-pointer border border-[#313131] flex items-center gap-2 hover:bg-[#313131] transition-colors"
          >
            <LuCopy className="text-[#00b4d8] w-4 h-4" />
            <span className="text-white text-base font-medium font-satoshi">
              {copied ? "Copied!" : "Copy"}
            </span>
          </motion.button>
        </div>
      </div>

      {/* Activity Section */}
      <div className="flex flex-col gap-3">
        <h2 className="text-white text-2xl font-medium font-rubik">Activity</h2>
        <div className="flex flex-col gap-4">
          {referrals?.map((refer, index) => (
            <motion.div
              key={index.toString() + refer.referralCode}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <ReferralItem {...refer} />
            </motion.div>
          ))}
          {(!referrals || referrals.length === 0) && (
            <div className="text-[#838587] text-lg text-center py-8">No referrals yet. Share your link to start earning!</div>
          )}
        </div>
      </div>
    </div>
  );
}
