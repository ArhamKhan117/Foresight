"use client";

import { useState, useRef, useEffect } from "react";
import Icon from "@/components/elements/Icons";
import { useGlobalContext } from "@/providers/GlobalContext";
import { usePathname } from "next/navigation";
import { RxHamburgerMenu } from "react-icons/rx";
import Link from "next/link";
import { useMetaMask } from "@/providers/MetaMaskProvider";
import { ADMIN_ADDRESS, FORE_TOKEN_ID } from "@/components/hedera_sdk/constants";
import { associateFOREToken, getFOREBalance } from "@/components/hedera_sdk";
import { IoChevronDown, IoClose } from "react-icons/io5";
import { TbArrowsExchange } from "react-icons/tb";

interface HeaderTopProps {
  isCollapsed?: boolean;
}

const HeaderTop: React.FC<HeaderTopProps> = ({ isCollapsed }) => {
  const { activeTab, setActiveTab } = useGlobalContext();
  const { isConnected, address, balance, connect, disconnect, chainId, switchToHedera } = useMetaMask();
  const { signer, accountId } = useMetaMask();
  const pathname = usePathname();
  const [showHbarMenu, setShowHbarMenu] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [showBridgeModal, setShowBridgeModal] = useState(false);
  const [selectedLang, setSelectedLang] = useState("EN");
  const [foreBalance, setForeBalance] = useState<number | null>(null);
  const [foreAssociating, setForeAssociating] = useState(false);
  const hbarRef = useRef<HTMLDivElement>(null);
  const langRef = useRef<HTMLDivElement>(null);

  const languages = [
    { code: "EN", label: "English" },
    { code: "ES", label: "Español" },
    { code: "FR", label: "Français" },
    { code: "DE", label: "Deutsch" },
    { code: "ZH", label: "中文" },
    { code: "JA", label: "日本語" },
    { code: "KO", label: "한국어" },
    { code: "AR", label: "العربية" },
  ];

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (hbarRef.current && !hbarRef.current.contains(e.target as Node)) setShowHbarMenu(false);
      if (langRef.current && !langRef.current.contains(e.target as Node)) setShowLangMenu(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowBridgeModal(false);
    };
    document.addEventListener("click", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => { document.removeEventListener("click", handleClick); document.removeEventListener("keydown", handleKey); };
  }, []);

  // Fetch FORE balance when connected
  useEffect(() => {
    if (!isConnected || !accountId || !FORE_TOKEN_ID) {
      setForeBalance(null);
      return;
    }
    const fetchFore = () => getFOREBalance(accountId).then(setForeBalance).catch(() => setForeBalance(null));
    fetchFore();
    const interval = setInterval(fetchFore, 30000);
    return () => clearInterval(interval);
  }, [isConnected, accountId]);

  const handleAssociateFORE = async () => {
    if (!signer) return;
    setForeAssociating(true);
    try {
      await associateFOREToken(signer);
      // Refresh balance after association
      if (accountId) {
        const bal = await getFOREBalance(accountId);
        setForeBalance(bal);
      }
    } catch (e: any) {
      console.error("FORE associate error:", e);
    } finally {
      setForeAssociating(false);
    }
  };

  const formatAddress = (addr: string | null) => {
    if (!addr) return "";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const isWrongNetwork = isConnected && chainId !== "0x128";
  const isAdmin = isConnected && address?.toLowerCase() === ADMIN_ADDRESS;

  const handleWalletClick = async () => {
    if (isConnected) {
      if (isWrongNetwork) await switchToHedera();
      else disconnect();
    } else {
      connect();
    }
  };

  // Compact mode: home page with sidebar expanded
  const compact = pathname === "/" && !isCollapsed;

  return (
    <div className="flex flex-col relative">
      <div className="self-stretch px-[50px] py-4 inline-flex justify-between items-center w-full">
        <div className="flex gap-2 items-center md:hidden">
          <div className="w-4 h-4 md:hidden relative overflow-hidden">
            <RxHamburgerMenu size={16} className="text-white" />
          </div>
          <div className="flex-1 md:hidden flex justify-start items-center gap-2">
            <Link href="/markets"><Icon name="Logo" size={24} /></Link>
            <Link href="/markets" className="text-xl leading-9 font-normal font-['anton'] text-white uppercase">Hedera PM</Link>
          </div>
        </div>

        <div className={`md:flex hidden justify-start items-center ${compact ? "gap-3 min-w-0 flex-1" : "gap-5"}`}>
          {/* Market Tab Switch */}
          {pathname === "/" && (
            <div className="p-0.5 bg-[#111111] rounded-[18px] outline-1 outline-offset-[-1px] outline-[#313131] flex flex-shrink-0">
              <button
                onClick={() => setActiveTab("ACTIVE")}
                className={`${compact ? "px-3 py-2 gap-1.5" : "px-4 py-2.5 gap-2"} rounded-2xl flex items-center cursor-pointer transition-all duration-300
                  ${activeTab === "ACTIVE" ? "bg-[#282828] shadow-[inset_0px_2px_0px_0px_rgba(53,53,53,1.00)]" : "bg-transparent hover:bg-[#2a2a2a] hover:shadow-md hover:scale-95"}`}
              >
                <Icon name="ActiveMarket" color={activeTab === "ACTIVE" ? "#FF6464" : "#838587"} className="transition-all duration-300 ease-in-out hover:scale-110" />
                <span className={`${compact ? "text-sm" : "text-base"} font-medium font-satoshi leading-normal whitespace-nowrap transition-all duration-300 ease-in-out ${activeTab === "ACTIVE" ? "text-white" : "text-[#838587]"}`}>
                  Active Market
                </span>
              </button>
              <button
                onClick={() => setActiveTab("PENDING")}
                className={`${compact ? "px-3 py-2 gap-1.5" : "px-4 py-2.5 gap-2"} rounded-2xl flex items-center cursor-pointer transition-all duration-300
                  ${activeTab === "PENDING" ? "bg-[#282828] shadow-[inset_0px_2px_0px_0px_rgba(53,53,53,1.00)]" : "bg-transparent hover:bg-[#2a2a2a] hover:shadow-md hover:scale-95"}`}
              >
                <Icon name="PendingMarket" color={activeTab === "PENDING" ? "#FF6464" : "#838587"} className="transition-all duration-300 ease-in-out hover:scale-110" />
                <span className={`${compact ? "text-sm" : "text-base"} font-medium font-satoshi leading-normal whitespace-nowrap transition-all duration-300 ease-in-out ${activeTab === "PENDING" ? "text-white" : "text-[#838587]"}`}>
                  Pending Market
                </span>
              </button>
            </div>
          )}

          {/* Search Bar */}
          <div className={`${compact ? "flex-1 min-w-[160px] max-w-[480px]" : "2xl:w-[480px] lg:w-auto"} hidden px-4 py-3 bg-[#1e1e1e] rounded-2xl outline-1 outline-offset-[-1px] outline-[#313131] lg:flex justify-start items-center gap-3`}>
            <span className="pointer-events-none"><Icon name="Search" /></span>
            <input type="text" placeholder="Search" className="flex-1 min-w-0 bg-transparent hover:text-gray-400 text-[#838587] text-base font-medium font-satoshi leading-normal outline-none" />
            <div className="px-2 py-1 bg-[#111111] rounded-lg outline-1 outline-offset-[-1px] outline-[#313131] flex justify-center items-center gap-2.5">
              <span className="text-[#838587] cursor-pointer text-sm font-medium font-satoshi leading-none">⌘V</span>
            </div>
          </div>
        </div>

        {/* Language Selector & Wallet Button */}
        <div className={`flex justify-start items-center ${compact ? "gap-3 ml-4" : "gap-5"} flex-shrink-0`}>
          {/* Balance Display with dropdown (when connected) */}
          {isConnected && !isWrongNetwork && (
            <div className="hidden xl:block relative" ref={hbarRef}>
              <button
                onClick={() => setShowHbarMenu(!showHbarMenu)}
                className={`${compact ? "px-3 py-2 gap-1.5" : "px-4 py-2.5 gap-2"} bg-[#282828] rounded-2xl flex justify-center items-center cursor-pointer transition-all duration-200 hover:bg-[#343434]`}
              >
                <span className={`text-[#3fd145] ${compact ? "text-sm" : "text-lg"} font-medium font-satoshi whitespace-nowrap`}>
                  {parseFloat(balance).toFixed(compact ? 2 : 4)} HBAR
                </span>
                <IoChevronDown className={`text-[#838587] text-sm transition-transform duration-200 ${showHbarMenu ? "rotate-180" : ""}`} />
              </button>
              {showHbarMenu && (
                <div className="absolute top-full mt-2 right-0 min-w-[220px] bg-[#1e1e1e] rounded-xl border border-[#313131] shadow-[0px_8px_24px_rgba(0,0,0,0.6)] overflow-hidden z-50">
                  {/* Bridge */}
                  <button
                    onClick={() => { setShowHbarMenu(false); setShowBridgeModal(true); }}
                    className="w-full flex items-center gap-2.5 px-4 py-3 text-[#c9c9c9] hover:bg-[#282828] hover:text-white transition-all duration-200 cursor-pointer"
                  >
                    <TbArrowsExchange className="text-lg" />
                    <span className="text-sm font-medium font-satoshi">Bridge</span>
                  </button>

                  {/* Divider */}
                  <div className="h-px bg-[#2a2a2a]" />

                  {/* FORE Token Row */}
                  {FORE_TOKEN_ID && (
                    foreBalance !== null && foreBalance >= 0 ? (
                      <div className="w-full flex items-center gap-2.5 px-4 py-3">
                        <img src="/logo1.png" alt="FORE" className="w-5 h-5 rounded-full" />
                        <span className="text-sm font-medium font-satoshi text-[#f0b90b]">
                          {foreBalance.toFixed(2)} FORE
                        </span>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleAssociateFORE(); }}
                        disabled={foreAssociating}
                        className={`w-full flex items-center gap-2.5 px-4 py-3 text-[#f0b90b] hover:bg-[#282828] transition-all duration-200 cursor-pointer ${foreAssociating ? "opacity-50" : ""}`}
                      >
                        <img src="/logo1.png" alt="FORE" className="w-5 h-5 rounded-full" />
                        <span className="text-sm font-medium font-satoshi">
                          {foreAssociating ? "Associating..." : "Associate FORE"}
                        </span>
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
          )}

          {/* Language Selector */}
          <div className="relative hidden xl:block" ref={langRef}>
            <button
              onClick={() => setShowLangMenu(!showLangMenu)}
              className={`${compact ? "px-3 py-2 gap-1.5" : "px-4 py-2.5 gap-2"} bg-[#282828] rounded-2xl flex justify-center items-center transition-all duration-300 ease-in-out hover:bg-[#3a3a3a] hover:shadow-md cursor-pointer`}
            >
              <span className={`text-white ${compact ? "text-sm" : "text-lg"} font-medium font-satoshi`}>{selectedLang}</span>
              <IoChevronDown className={`text-[#838587] text-sm transition-transform duration-200 ${showLangMenu ? "rotate-180" : ""}`} />
            </button>
            {showLangMenu && (
              <div className="absolute top-full mt-2 right-0 min-w-[160px] bg-[#1e1e1e] rounded-xl border border-[#313131] shadow-[0px_8px_24px_rgba(0,0,0,0.6)] overflow-hidden z-50">
                {languages.map(({ code, label }) => (
                  <button key={code} onClick={() => { setSelectedLang(code); setShowLangMenu(false); }}
                    className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium font-satoshi transition-all duration-200 cursor-pointer ${
                      selectedLang === code ? "text-[#07b3ff] bg-[#07b3ff]/10" : "text-[#c9c9c9] hover:bg-[#282828] hover:text-white"
                    }`}>
                    <span>{code}</span>
                    <span className="text-[#838587]">{label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Connect Wallet Button */}
          <div className="flex items-center gap-2">
            {isAdmin && (
              <span className="px-2.5 py-1 bg-[#ffd600] rounded-lg text-black text-xs font-bold font-satoshi uppercase tracking-wider">Admin</span>
            )}
            <button
              onClick={handleWalletClick}
              className={`${compact ? "px-3 py-1.5" : "md:px-4 px-3 md:py-2.5 py-1"} rounded-2xl flex items-center gap-2 transition-all cursor-pointer duration-300 ease-in-out hover:scale-105 hover:shadow-lg ${
                isWrongNetwork ? "bg-[#ff6464] hover:bg-[#ff4444]" : "bg-[#07b3ff] hover:bg-[#0595d3]"
              }`}
              style={{ borderRadius: "15px", color: "#000", boxShadow: "inset 0px 2px 0px 0px rgba(255,255,255,0.16)" }}
            >
              <span className={`text-black ${compact ? "text-xs" : "md:text-lg text-sm"} font-medium font-satoshi leading-7 whitespace-nowrap transition-all duration-300 ease-in-out`}>
                {isConnected ? (isWrongNetwork ? "Switch to Hedera" : formatAddress(address)) : "Connect Wallet"}
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className="px-[50px]">
        <div className="lg:hidden px-4 py-3 bg-[#1e1e1e] rounded-2xl outline-1 outline-offset-[-1px] outline-[#313131] flex justify-start items-center gap-3">
          <span className="cursor-pointer"><Icon name="Search" /></span>
          <input type="text" placeholder="Search" className="flex-1 bg-transparent text-[#838587] md:text-base text-sm font-medium font-satoshi leading-normal outline-none" />
          <div className="px-2 py-1 bg-[#111111] rounded-lg outline-1 outline-offset-[-1px] outline-[#313131] flex justify-center items-center gap-2.5">
            <span className="text-[#838587] cursor-pointer text-sm font-medium font-satoshi leading-none">⌘V</span>
          </div>
        </div>
      </div>

      {/* Bridge Modal */}
      {showBridgeModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center" onClick={() => setShowBridgeModal(false)}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="relative w-full max-w-[440px] mx-4 bg-[#1e1e1e] rounded-2xl border border-[#313131] shadow-[0px_16px_48px_rgba(0,0,0,0.8)] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a2a]">
              <div className="flex items-center gap-3">
                <TbArrowsExchange className="text-[#07b3ff] text-xl" />
                <span className="text-white text-lg font-semibold font-satoshi">Bridge to Hedera</span>
              </div>
              <button onClick={() => setShowBridgeModal(false)} className="text-[#838587] hover:text-white transition-colors cursor-pointer p-1">
                <IoClose className="text-xl" />
              </button>
            </div>

            {/* Supported Chains — removed */}

            {/* Bridge iframe */}
            <div className="h-[580px] bg-[#111]">
              <iframe
                src="https://thirdweb.com/bridge/widget?theme=dark&outputChain=295&showThirdwebBranding=false"
                height="100%"
                width="100%"
                style={{ border: 0 }}
                allow="clipboard-write"
              />
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-[#2a2a2a] flex items-center justify-center gap-2">
              <span className="text-[#555] text-xs font-satoshi">Powered by</span>
              <a href="https://thirdweb.com/bridge" target="_blank" rel="noopener noreferrer" className="text-[#07b3ff] text-xs font-semibold font-satoshi hover:underline">thirdweb Bridge</a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HeaderTop;
