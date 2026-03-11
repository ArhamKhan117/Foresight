// Hedera-specific types (using MetaMask/ethers)
import { JsonRpcSigner } from "ethers";

export interface SidebarNavItemProps {
  label:
    | "Home"
    | "FundMarket"
    | "ProposeMarket"
    | "Referral"
    | "Profile"
    | "About";
  href: string;
  isActive: boolean;
  onClick: () => void;
  isCollapsed: boolean;
}

export interface SidebarNavProps {
  isCollapsed: boolean;
}

export interface MarketCarouselItemProps {
  category: string;
  title: string;
  bgImage: string;
  mainImage: string;
  overlayImage: string;
  volume: string;
  timeLeft: string;
  yesPercentage: number;
  comments: number;
}

export interface Prediction {
  category: string;
  question: string;
  volume: string;
  timeLeft: string;
  comments: number;
  yesPercentage: number;
  imageUrl: string;
  onVote?: () => void;
}

export interface PendingData {
  category: string;
  question: string;
  volume: string;
  timeLeft: string;
  comments: number;
  imageUrl: string;
}

export interface ProposeType {
  marketField: number;
  imageUrl: string;
  range: number;
  direction: "above" | "below";
  apiType: number;
  question: string;
  feedName: string;
  feedId: string;
  dataLink: string;
  date: string;
  task: string;
  value: number;
  creator: string;
  description: string;
}

export type GlobalSettingType = {
  creatorFeeAmount: number;
  liqudityUserFeeAmount: number;
  bettingUserFeeAmount: number;
  marketCount: number;
  decimal: number;
  feePercentage: number;
};

// MetaMask wallet types
export type CreateMarketType = {
  marketID: string;
  date: string;
  value: number;
  question: string;
  accountId: string; // EVM address or Hedera account ID
  signer?: JsonRpcSigner;
};

export type DepositeLiquidityType = {
  market_id: string;
  amount: number;
  accountId: string;
  signer?: JsonRpcSigner;
};

export type BetType = {
  marketId: string;
  amount: number;
  isYes: boolean;
  signer?: JsonRpcSigner;
};

export type OracleType = {
  creator: string;
};

export type RegistType = {
  url: string;
  task: string;
  name: string;
  accountId: string;
  network: "testnet" | "mainnet";
};

export type MarketStatus = "INIT" | "PENDING" | "ACTIVE" | "CLOSED";

export type MarketDataType = {
  _id: string;
  marketField: number;
  apiType: number;
  task: string;
  creator: string;
  tokenA: string;
  tokenB: string;
  market: string;
  question: string;
  feedName: string;
  feedId?: string;
  value: number;
  tradingAmountA: number;
  tradingAmountB: number;
  tokenAPrice: number;
  tokenBPrice: number;
  initAmount: number;
  range: number;
  direction?: "above" | "below";
  date: string;
  marketStatus: string;
  imageUrl: string;
  createdAt: string;
  __v: number;
  playerACount: number;
  playerBCount: number;
  totalInvestment: number;
  description: string;
  comments: number;
  totalBets: number;
  marketTag?: string;
  marketType?: "binary" | "multi";
  eventGroupId?: string;
  eventQuestion?: string;
  outcomeName?: string;
  outcomeIndex?: number;
  hcsTopicId?: string;
};

export type ReferralType = {
  wallet: string;
  referralCode: string;
  referredLevel: number;
  fee: number;
  status: "PENDING" | "ACTIVE";
  wallet_refered: string;
  createdAt: string;
};

// MetaMask wallet state
export interface MetaMaskWalletState {
  address: string | null;
  accountId: string | null;
  isConnected: boolean;
  network: "testnet" | "mainnet";
  chainId: string | null;
  balance: string;
}
