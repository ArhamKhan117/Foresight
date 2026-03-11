// API Configuration for Hedera Prediction Market

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000";

export const API_ENDPOINTS = {
  MARKET: {
    CREATE: `${API_URL}/api/market/create`,
    ADD: `${API_URL}/api/market/add`,
    GET: `${API_URL}/api/market/get`,
    LIQUIDITY: `${API_URL}/api/market/liquidity`,
    BETTING: `${API_URL}/api/market/betting`,
    RESOLVE: `${API_URL}/api/market/resolve`,
    REFERRAL_FEE: `${API_URL}/api/market/referral-fee`,
    EVENT_GROUP: `${API_URL}/api/market/event-group`,
    CREATE_MULTI_EVENT: `${API_URL}/api/market/create-multi-event`,
    FUND_EVENT: `${API_URL}/api/market/fund-event`,
    HCS_LOG: `${API_URL}/api/market/hcs-log`,
  },
  PROFILE: {
    GET: `${API_URL}/api/profile/get`,
    AVATAR: `${API_URL}/api/profile/avatar`,
    SET_AVATAR: `${API_URL}/api/profile/avatar`,
    AVATARS_BATCH: `${API_URL}/api/profile/avatars`,
  },
  REFERRAL: {
    GET_OR_GENERATE: `${API_URL}/api/referral/get-or-generate`,
    CLAIM: `${API_URL}/api/referral/claim`,
  },
  ORACLE: {
    REQUEST: `${API_URL}/api/oracle/request`,
    PROPOSE: `${API_URL}/api/oracle/propose`,
    DISPUTE: `${API_URL}/api/oracle/dispute`,
    SETTLE: `${API_URL}/api/oracle/settle`,
    STATUS: `${API_URL}/api/oracle/status`,
  },
  RECENT: {
    GET: `${API_URL}/api/market/recent`,
  },
  PRICE_HISTORY: {
    GET: `${API_URL}/api/market/price-history`,
  },
  HCS: {
    MIRROR_NODE: "https://testnet.mirrornode.hedera.com/api/v1/topics",
  },
  TWITTER: {
    TWEET: `${API_URL}/api/twitter/tweet`,
  },
  COMMENT: {
    GET: `${API_URL}/api/comment/get`,
    ADD: `${API_URL}/api/comment/add`,
  },
};
