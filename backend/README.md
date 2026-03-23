# Foresight — Backend Service

Backend API and blockchain service for the Foresight prediction market platform on Hedera.

## Tech Stack

- Node.js + TypeScript
- Express.js
- MongoDB (Atlas)
- Hedera Hashgraph (@hashgraph/sdk + ethers.js v6)

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Required variables:

| Variable | Description |
|----------|-------------|
| `HEDERA_NETWORK` | testnet or mainnet |
| `HEDERA_OPERATOR_ID` | Hedera account ID (e.g. 0.0.12345) |
| `HEDERA_OPERATOR_KEY` | Hedera private key |
| `PREDICTION_MARKET_CONTRACT` | Binary market contract (EVM address) |
| `OPTIMISTIC_ORACLE_CONTRACT` | Binary oracle contract (EVM address) |
| `MULTI_OUTCOME_CONTRACT` | Multi-outcome event contract (EVM address) |
| `MULTI_OUTCOME_ORACLE_CONTRACT` | Multi-outcome oracle contract (EVM address) |
| `DB_URL` | MongoDB connection string |
| `FORE_TOKEN_ID` | HTS FORE reward token ID |
| `PORT` | Server port (default: 9000) |

### 3. Development

```bash
npm run dev
```

### 4. Production (Render)

```bash
npm run build
npm start
```

Build command: `npm install && npm run build`
Start command: `npm start`

## API Endpoints

### Markets (`/api/market`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/create` | Create a binary market |
| POST | `/create-multi` | Create a multi-outcome event |
| POST | `/add` | Fund a market |
| POST | `/betting` | Place a bet |
| POST | `/liquidity` | Add liquidity |
| GET | `/get` | Get markets (paginated) |
| POST | `/filter` | Filter markets |
| GET | `/hcs/:marketId` | Get HCS audit log |

### Oracle (`/api/oracle`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/request` | Request oracle resolution |
| POST | `/propose` | Propose an answer (with bond) |
| POST | `/dispute` | Dispute an answer (with bond) |
| POST | `/settle` | Settle undisputed proposal |
| POST | `/resolve` | Admin resolve dispute |
| POST | `/finalize` | Finalize market from oracle |
| GET | `/status/:questionId` | Get oracle status |

### Profile (`/api/profile`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Get user profile and stats |

### Referral (`/api/referral`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/` | Get or create referral code |
| POST | `/claim` | Claim referral rewards |

## Background Services

### Auto-Resolver (polling every 60s)

Handles the full oracle lifecycle automatically:

- Requests oracle resolution when markets expire
- Auto-proposes outcomes for crypto/tweet markets using live price feeds
- Settles proposals after the 2-hour dispute window
- Finalizes markets and updates DB
- Force-closes markets stuck in oracle flow for 48+ hours
- Closes expired PENDING markets that never got funded

### HCS Audit Trail

Logs every market action to a dedicated Hedera Consensus Service topic — immutable on-chain audit log.

### FORE Rewards (HTS)

Automatically mints and distributes FORE reward tokens for market creation, betting, and funding.

## Project Structure

```
backend/
├── src/
│   ├── index.ts               # Entry point + graceful error handling
│   ├── config.ts              # App config + market field definitions
│   ├── controller/
│   │   ├── market/            # Market CRUD + funding + betting
│   │   ├── oracle/            # Oracle resolution endpoints
│   │   ├── profile/           # User profiles
│   │   ├── referral/          # Referral system
│   │   ├── bot/               # Background cleanup tasks
│   │   └── initialize/        # SDK + contract initialization
│   ├── services/
│   │   ├── autoResolver.ts    # Auto-resolution polling service
│   │   ├── hcsService.ts      # HCS audit trail logging
│   │   ├── htsService.ts      # FORE token minting + rewards
│   │   └── twitterService.ts  # Tweet metric fetching
│   ├── hedera_sdk/            # Hedera blockchain SDK wrapper
│   ├── model/                 # MongoDB schemas
│   ├── router/                # Express route definitions
│   ├── middleware/             # Request validation
│   └── type/                  # TypeScript type definitions
├── package.json
├── tsconfig.json
└── .env.example
```

## Deployed Contracts (Hedera Testnet)

| Contract | Address |
|----------|---------|
| PredictionMarket | `0x61E76D8eD410aDc29EcF65aE697b7599eB17E97D` |
| OptimisticOracle | `0x506eA2BE51Daf38BBE1278cd836e799013fcC4Ed` |
| MultiOutcomeEvent | `0x5c678d1144Ea155Eb65176A6AC225DCB2e22B455` |
| MultiOutcomeOracle | `0x8B25245D57a8965bb36D715442Fcd41CBE945EB6` |
| FORE Token (HTS) | `0.0.8139283` |

## License

ISC

---

Part of the [Foresight](https://github.com/ArhamKhan117/Foresight) prediction market platform — built on Hedera.
