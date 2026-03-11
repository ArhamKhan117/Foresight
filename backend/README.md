# Hedera Prediction Market - Backend

Backend service for the Hedera Prediction Market platform.

## Tech Stack

- **Runtime**: Node.js + TypeScript
- **Framework**: Express.js
- **Database**: MongoDB
- **Blockchain**: Hedera Hashgraph
- **SDK**: @hashgraph/sdk + ethers.js

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Required environment variables:
- `HEDERA_NETWORK` - testnet or mainnet
- `HEDERA_OPERATOR_ID` - Your Hedera account ID (e.g., 0.0.12345)
- `HEDERA_OPERATOR_KEY` - Your Hedera private key
- `PREDICTION_MARKET_CONTRACT` - Deployed contract ID
- `OPTIMISTIC_ORACLE_CONTRACT` - Deployed oracle contract ID
- `DB_URL` - MongoDB connection string

### 3. Run Development Server

```bash
npm run dev
```

### 4. Build for Production

```bash
npm run build
npm start
```

## API Endpoints

### Market Routes (`/api/market`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/create` | Create a new market |
| POST | `/add` | Add additional market info |
| POST | `/betting` | Place a bet |
| POST | `/liquidity` | Add liquidity |
| GET | `/get` | Get markets (paginated) |
| POST | `/filter` | Filter markets |

### Oracle Routes (`/api/oracle`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/request` | Request oracle resolution |
| POST | `/propose` | Propose an answer |
| POST | `/dispute` | Dispute an answer |
| POST | `/settle` | Settle undisputed proposal |
| POST | `/resolve` | Admin resolve dispute |
| POST | `/finalize` | Finalize market from oracle |
| GET | `/status/:questionId` | Get oracle status |
| GET | `/bond/:address` | Get required bond amount |

### Profile Routes (`/api/profile`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Get user profile data |

### Referral Routes (`/api/referral`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/` | Get/create referral code |
| POST | `/claim` | Claim referral rewards |

## Project Structure

```
backend/
├── src/
│   ├── config.ts              # App configuration
│   ├── index.ts               # Entry point
│   ├── controller/            # Route handlers
│   │   ├── bot/               # Background tasks
│   │   ├── initialize/        # SDK initialization
│   │   ├── market/            # Market operations
│   │   ├── oracle/            # Oracle operations
│   │   ├── profile/           # User profiles
│   │   └── referral/          # Referral system
│   ├── hedera_sdk/            # Hedera blockchain SDK
│   │   ├── config.ts          # Hedera client config
│   │   ├── constants.ts       # Contract addresses
│   │   ├── contracts.ts       # Contract ABIs
│   │   ├── index.ts           # SDK functions
│   │   └── utils.ts           # Helper functions
│   ├── middleware/            # Express middleware
│   ├── model/                 # MongoDB models
│   ├── router/                # Express routes
│   └── type/                  # TypeScript types
├── package.json
├── tsconfig.json
└── .env.example
```

## Oracle Flow (OptimisticOracle)

1. **Market ends** → Timer expires
2. **Request resolution** → Anyone calls `/api/oracle/request`
3. **Propose answer** → Anyone proposes YES/NO with bond
   - Admin: 2 HBAR
   - User: 10,000 HBAR
4. **Dispute window** → 2 hours to dispute
5. **Settlement**:
   - No dispute → Proposer wins, gets bond back
   - Disputed → Admin resolves, winner gets both bonds

## License

ISC
