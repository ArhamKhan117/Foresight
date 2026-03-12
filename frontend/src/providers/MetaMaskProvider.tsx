"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { ethers, BrowserProvider, JsonRpcSigner } from "ethers";

// Network configuration for Hedera
const HEDERA_NETWORKS = {
  testnet: {
    chainId: "0x128", // 296 in decimal
    chainName: "Hedera Testnet",
    nativeCurrency: {
      name: "HBAR",
      symbol: "HBAR",
      decimals: 18,
    },
    rpcUrls: ["https://testnet.hashio.io/api"],
    blockExplorerUrls: ["https://hashscan.io/testnet"],
  },
  mainnet: {
    chainId: "0x127", // 295 in decimal
    chainName: "Hedera Mainnet",
    nativeCurrency: {
      name: "HBAR",
      symbol: "HBAR",
      decimals: 18,
    },
    rpcUrls: ["https://mainnet.hashio.io/api"],
    blockExplorerUrls: ["https://hashscan.io/mainnet"],
  },
};

const NETWORK = (process.env.NEXT_PUBLIC_HEDERA_NETWORK as "testnet" | "mainnet") || "testnet";
const TARGET_CHAIN_ID = HEDERA_NETWORKS[NETWORK].chainId;

interface MetaMaskContextType {
  // Connection state
  isConnected: boolean;
  address: string | null;
  accountId: string | null; // Hedera account ID format (0.0.xxxxx)
  network: "testnet" | "mainnet";
  chainId: string | null;
  
  // Provider and signer
  provider: BrowserProvider | null;
  signer: JsonRpcSigner | null;
  
  // Actions
  connect: () => Promise<void>;
  disconnect: () => void;
  switchToHedera: () => Promise<boolean>;
  
  // Balance
  balance: string;
}

const MetaMaskContext = createContext<MetaMaskContextType | undefined>(undefined);

export const MetaMaskProvider = ({ children }: { children: ReactNode }) => {
  const [address, setAddress] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null);
  const [balance, setBalance] = useState<string>("0");

  const isConnected = !!address && chainId === TARGET_CHAIN_ID;

  // Convert EVM address to Hedera account ID format
  const evmToAccountId = async (evmAddress: string): Promise<string | null> => {
    try {
      // For now, we'll use the EVM address as identifier
      // In production, you'd query the mirror node to get the actual account ID
      // Example: https://testnet.mirrornode.hedera.com/api/v1/accounts/{evmAddress}
      const response = await fetch(
        `https://${NETWORK}.mirrornode.hedera.com/api/v1/accounts/${evmAddress}`
      );
      if (response.ok) {
        const data = await response.json();
        return data.account; // Returns format like "0.0.12345"
      }
      return evmAddress; // Fallback to EVM address
    } catch (error) {
      console.log("Could not fetch Hedera account ID, using EVM address");
      return evmAddress;
    }
  };

  // Fetch balance
  const fetchBalance = useCallback(async (addr: string, prov: BrowserProvider) => {
    try {
      const bal = await prov.getBalance(addr);
      // Convert from wei (18 decimals) to HBAR
      setBalance(ethers.formatEther(bal));
    } catch (error) {
      console.error("Error fetching balance:", error);
    }
  }, []);

  // Switch to Hedera network
  const switchToHedera = useCallback(async (): Promise<boolean> => {
    if (!window.ethereum) return false;

    const networkConfig = HEDERA_NETWORKS[NETWORK];

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: networkConfig.chainId }],
      });
      return true;
    } catch (switchError: any) {
      // Chain not added, try to add it
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [networkConfig],
          });
          return true;
        } catch (addError) {
          console.error("Error adding Hedera network:", addError);
          return false;
        }
      }
      console.error("Error switching to Hedera:", switchError);
      return false;
    }
  }, []);

  // Connect wallet
  const connect = useCallback(async () => {
    if (typeof window === "undefined" || !window.ethereum) {
      alert("Please install MetaMask to use this application");
      return;
    }

    try {
      // Request account access
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      if (accounts.length === 0) {
        throw new Error("No accounts found");
      }

      const addr = accounts[0];
      
      // Create provider and signer
      const prov = new BrowserProvider(window.ethereum);
      const sign = await prov.getSigner();
      
      // Get current chain ID
      const network = await prov.getNetwork();
      const currentChainId = "0x" + network.chainId.toString(16);

      setAddress(addr);
      setProvider(prov);
      setSigner(sign);
      setChainId(currentChainId);

      // Switch to Hedera if not already on it
      if (currentChainId !== TARGET_CHAIN_ID) {
        const switched = await switchToHedera();
        if (switched) {
          // Refresh provider after network switch
          const newProv = new BrowserProvider(window.ethereum);
          const newSign = await newProv.getSigner();
          setProvider(newProv);
          setSigner(newSign);
          setChainId(TARGET_CHAIN_ID);
          await fetchBalance(addr, newProv);
        }
      } else {
        await fetchBalance(addr, prov);
      }

      // Get Hedera account ID
      const hederaId = await evmToAccountId(addr);
      setAccountId(hederaId);

      // Save to localStorage
      localStorage.setItem("metamask_connected", "true");
    } catch (error) {
      console.error("Connection error:", error);
    }
  }, [switchToHedera, fetchBalance]);

  // Disconnect wallet
  const disconnect = useCallback(() => {
    setAddress(null);
    setAccountId(null);
    setProvider(null);
    setSigner(null);
    setChainId(null);
    setBalance("0");
    localStorage.removeItem("metamask_connected");
  }, []);

  // Handle account changes
  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) return;

    const handleAccountsChanged = async (accounts: string[]) => {
      if (accounts.length === 0) {
        disconnect();
      } else {
        const addr = accounts[0];
        setAddress(addr);
        const hederaId = await evmToAccountId(addr);
        setAccountId(hederaId);
        if (provider) {
          const sign = await provider.getSigner();
          setSigner(sign);
          await fetchBalance(addr, provider);
        }
      }
    };

    const handleChainChanged = (newChainId: string) => {
      setChainId(newChainId);
      // Reload provider on chain change
      if (address) {
        const prov = new BrowserProvider(window.ethereum);
        setProvider(prov);
        prov.getSigner().then(setSigner);
        fetchBalance(address, prov);
      }
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      window.ethereum?.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum?.removeListener("chainChanged", handleChainChanged);
    };
  }, [address, provider, disconnect, fetchBalance]);

  // Auto-connect on mount if previously connected
  useEffect(() => {
    const wasConnected = localStorage.getItem("metamask_connected");
    if (wasConnected === "true" && window.ethereum) {
      connect();
    }
  }, [connect]);

  const value: MetaMaskContextType = {
    isConnected,
    address,
    accountId,
    network: NETWORK,
    chainId,
    provider,
    signer,
    connect,
    disconnect,
    switchToHedera,
    balance,
  };

  return (
    <MetaMaskContext.Provider value={value}>
      {children}
    </MetaMaskContext.Provider>
  );
};

// Custom hook to use MetaMask
export const useMetaMask = () => {
  const context = useContext(MetaMaskContext);
  if (!context) {
    throw new Error("useMetaMask must be used within a MetaMaskProvider");
  }
  return context;
};

// Alias for compatibility
export const useWallet = useMetaMask;

// Declare ethereum on window
declare global {
  interface Window {
    ethereum?: any;
  }
}
