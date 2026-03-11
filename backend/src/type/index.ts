// Global settings type for contract initialization (Polymarket-style LMSR)
export type GlobalSettingType = {
    creatorFeeAmount: number;
    bettingFeePercentage: number;
    fundFeePercentage: number;
    // Legacy fields kept for backward compat with initialize controller
    marketCount?: number;
    decimal?: number;
};

// Create market type
export type CreateMarketType = {
    creator: string;
    marketId: string;
    question: string;
    tokenAmount: number;
    tokenPrice: number;
    value: number;
    range: number;
    resolutionDate: number;
    feed?: string;
};

// Deposit liquidity type
export type DepositLiquidityType = {
    creator: string;
    investor: string;
    amount: number;
};

// Bet type
export type BetType = {
    creator: string;
    player: string;
    amount: number;
    isYes: boolean;
    token: string;
};

// Withdraw type
export type WithdrawType = {
    marketId: string;
    receiver: string;
    amount: number;
};

// Oracle types for OptimisticOracle
export type ProposeAnswerType = {
    questionId: string;
    value: 1 | -1;  // 1 = YES, -1 = NO
    bondAmount: number;
};

export type DisputeAnswerType = {
    questionId: string;
    bondAmount: number;
};

export type ResolveDisputeType = {
    questionId: string;
    finalValue: 1 | -1;
};

export type OracleStatusType = {
    questionId: string;
    proposer: string;
    proposedValue: number;
    proposalTime: number;
    bondAmount: number;
    disputed: boolean;
    disputer: string;
    disputeBond: number;
    settled: boolean;
    canSettle: boolean;
    canDispute: boolean;
    disputeTimeRemaining: number;
};

// Market filter type
export interface MarketFilter {
    volumeMin?: number;
    volumeMax?: number;
    expiryStart?: string; // ISO date
    expiryEnd?: string;
    yesProbMin?: number;
    yesProbMax?: number;
    noProbMin?: number;
    noProbMax?: number;
}

// Market status enum
export type MarketStatus =
    "INIT" |
    "PENDING" |
    "ACTIVE" |
    "CLOSED";

// Contract market status (matches Solidity enum)
export enum ContractMarketStatus {
    Prepare = 0,
    Active = 1,
    Finished = 2
}
