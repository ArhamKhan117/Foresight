// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "abdk-libraries-solidity/ABDKMath64x64.sol";
import "./OptimisticOracle.sol";

/**
 * @title PredictionMarket
 * @notice Polymarket-style prediction market on Hedera with LMSR pricing
 * @dev 1 winning token = 1 HBAR. Prices bounded 0-1 HBAR. Yes + No = 1 HBAR.
 *      Uses LMSR (Logarithmic Market Scoring Rule) for pricing.
 */
contract PredictionMarket {
    using ABDKMath64x64 for int128;

    // ============ Enums ============
    enum MarketStatus { Prepare, Active, Finished }

    // ============ Structs ============
    struct Global {
        address admin;
        address feeAuthority;
        uint256 creatorFeeAmount;       // tinybars
        uint256 bettingFeePercentage;   // basis points (250 = 2.5%)
        uint256 fundFeePercentage;      // basis points (150 = 1.5%)
    }

    struct Market {
        address creator;
        MarketStatus marketStatus;
        bool result;
        uint256 qYes;                   // Outstanding Yes tokens (scaled by 1e8)
        uint256 qNo;                    // Outstanding No tokens (scaled by 1e8)
        uint256 b;                      // Liquidity parameter (scaled by 1e8)
        uint256 totalVolume;            // Total HBAR wagered (tinybars)
        uint256 liquidity;              // Total LP deposits (tinybars)
        uint256 liquidityGoal;          // Funding target to activate (tinybars)
        uint256 totalLPShares;          // Total LP shares issued
        uint256 accumulatedFees;        // Betting fees for LPs (tinybars)
        int64 resolutionDate;           // Unix timestamp
        string question;
        bytes32 oracleRequestId;
    }

    // ============ Constants ============
    uint256 constant SCALE = 1e8;       // 8 decimal precision (tinybars)
    uint256 constant ONE_HBAR = 1e8;    // 1 HBAR in tinybars
    uint256 constant MIN_PRICE = 1e6;   // 0.01 HBAR min price
    uint256 constant MAX_PRICE = 99e6;  // 0.99 HBAR max price

    // ============ State Variables ============
    Global public global;
    bool public initialized;
    OptimisticOracle public oracle;

    mapping(bytes32 => Market) public markets;
    bytes32[] public marketIds;

    // LP shares: marketHash => funder => shares
    mapping(bytes32 => mapping(address => uint256)) public lpShares;
    mapping(bytes32 => mapping(address => bool)) public lpClaimed;

    // User token holdings: marketHash => user => tokenCount (scaled 1e8)
    mapping(bytes32 => mapping(address => uint256)) public userYesTokens;
    mapping(bytes32 => mapping(address => uint256)) public userNoTokens;
    mapping(bytes32 => mapping(address => bool)) public winningsClaimed;

    // ============ Events ============
    event GlobalInitialized(address indexed admin, address indexed feeAuthority, uint256 creatorFeeAmount, uint256 fundFeePercentage, uint256 bettingFeePercentage);
    event MarketCreated(bytes32 indexed marketId, address indexed creator, string question, uint256 liquidityGoal, int64 resolutionDate);
    event MarketActivated(bytes32 indexed marketId, uint256 liquidity, uint256 b);
    event LiquidityAdded(bytes32 indexed marketId, address indexed user, uint256 amount, uint256 shares);
    event LiquidityRemoved(bytes32 indexed marketId, address indexed user, uint256 amount, uint256 feeReward);
    event TokensBought(bytes32 indexed marketId, address indexed user, bool isYes, uint256 amount, uint256 cost, uint256 yesPrice, uint256 noPrice);
    event TokensSold(bytes32 indexed marketId, address indexed user, bool isYes, uint256 amount, uint256 payout, uint256 yesPrice, uint256 noPrice);
    event WinningsClaimed(bytes32 indexed marketId, address indexed user, uint256 payout);
    event MarketResolved(bytes32 indexed marketId, bool result);

    // ============ Errors ============
    error AlreadyInitialized();
    error NotInitialized();
    error NotAdmin();
    error InvalidAmount();
    error MarketNotPreparing();
    error MarketNotActive();
    error MarketNotFinished();
    error MarketAlreadyExists();
    error MarketNotFound();
    error TransferFailed();
    error FundingGoalReached();
    error InsufficientTokens();
    error AlreadyClaimed();
    error NoWinnings();
    error ResolutionTooEarly();
    error NoLPShares();
    error InsufficientPayment();

    // ============ Modifiers ============
    modifier onlyAdmin() { if (msg.sender != global.admin) revert NotAdmin(); _; }
    modifier onlyInitialized() { if (!initialized) revert NotInitialized(); _; }

    constructor() {}

    // ============ Initialize ============
    function initialize(
        address _feeAuthority,
        uint256 _creatorFeeAmount,
        uint256 _bettingFeePercentage,
        uint256 _fundFeePercentage
    ) external {
        if (initialized) revert AlreadyInitialized();
        global = Global({
            admin: msg.sender,
            feeAuthority: _feeAuthority,
            creatorFeeAmount: _creatorFeeAmount,
            bettingFeePercentage: _bettingFeePercentage,
            fundFeePercentage: _fundFeePercentage
        });
        initialized = true;
        emit GlobalInitialized(msg.sender, _feeAuthority, _creatorFeeAmount, _fundFeePercentage, _bettingFeePercentage);
    }

    // ============ Create Market ============
    function createMarket(
        string calldata _marketId,
        string calldata _question,
        int64 _resolutionDate,
        uint256 _liquidityGoal
    ) external payable onlyInitialized {
        bytes32 h = keccak256(abi.encodePacked(_marketId));
        if (markets[h].creator != address(0)) revert MarketAlreadyExists();
        if (msg.value < global.creatorFeeAmount) revert InvalidAmount();
        if (_liquidityGoal < ONE_HBAR) revert InvalidAmount(); // Min 1 HBAR goal

        // Transfer creator fee
        (bool fs, ) = global.feeAuthority.call{value: global.creatorFeeAmount}("");
        if (!fs) revert TransferFailed();

        markets[h] = Market({
            creator: msg.sender,
            marketStatus: MarketStatus.Prepare,
            result: false,
            qYes: 0,
            qNo: 0,
            b: 0,
            totalVolume: 0,
            liquidity: 0,
            liquidityGoal: _liquidityGoal,
            totalLPShares: 0,
            accumulatedFees: 0,
            resolutionDate: _resolutionDate,
            question: _question,
            oracleRequestId: bytes32(0)
        });
        marketIds.push(h);

        emit MarketCreated(h, msg.sender, _question, _liquidityGoal, _resolutionDate);

        // Refund excess
        uint256 excess = msg.value - global.creatorFeeAmount;
        if (excess > 0) {
            (bool s, ) = msg.sender.call{value: excess}("");
            if (!s) revert TransferFailed();
        }
    }

    // ============ Add Liquidity ============
    /**
     * @notice Add liquidity during Prepare phase (toward goal) or Active phase (increase depth)
     * @dev Increases the `b` parameter which controls price sensitivity
     */
    function addLiquidity(string calldata _marketId) external payable onlyInitialized {
        bytes32 h = keccak256(abi.encodePacked(_marketId));
        Market storage market = markets[h];
        if (market.creator == address(0)) revert MarketNotFound();
        if (market.marketStatus == MarketStatus.Finished) revert MarketNotActive();
        if (msg.value < 100000) revert InvalidAmount(); // Min 0.001 HBAR

        // Check if still in funding phase and goal would be exceeded
        // (Allow overfunding slightly — just cap at goal for activation check)

        // Calculate fee
        uint256 feeAmount = (msg.value * global.fundFeePercentage) / 10000;
        uint256 liquidityAmount = msg.value - feeAmount;

        if (feeAmount > 0) {
            (bool fs, ) = global.feeAuthority.call{value: feeAmount}("");
            if (!fs) revert TransferFailed();
        }

        // Calculate LP shares
        uint256 shares;
        if (market.totalLPShares == 0) {
            shares = liquidityAmount;
        } else {
            shares = (liquidityAmount * market.totalLPShares) / market.liquidity;
        }

        market.liquidity += liquidityAmount;
        market.totalLPShares += shares;
        lpShares[h][msg.sender] += shares;

        // Update b parameter: b = liquidity / (2 * ONE_HBAR)
        // This means with 100 HBAR liquidity, b = 50 (in token units)
        // Scaled: b_scaled = liquidity / 2
        market.b = market.liquidity / 2;

        // Activate if goal reached and still preparing
        if (market.marketStatus == MarketStatus.Prepare && market.liquidity >= market.liquidityGoal) {
            market.marketStatus = MarketStatus.Active;
            emit MarketActivated(h, market.liquidity, market.b);
        }

        emit LiquidityAdded(h, msg.sender, liquidityAmount, shares);
    }

    // ============ Remove Liquidity ============
    /**
     * @notice Remove LP position. Before activation: full refund. After activation: proportional + fees.
     */
    function removeLiquidity(string calldata _marketId) external {
        bytes32 h = keccak256(abi.encodePacked(_marketId));
        Market storage market = markets[h];
        if (market.creator == address(0)) revert MarketNotFound();
        if (market.marketStatus == MarketStatus.Finished) revert MarketNotFinished();

        uint256 shares = lpShares[h][msg.sender];
        if (shares == 0) revert NoLPShares();

        uint256 amount;
        uint256 feeReward = 0;

        if (market.marketStatus == MarketStatus.Prepare) {
            // Before activation: simple proportional refund
            amount = (shares * market.liquidity) / market.totalLPShares;
        } else {
            // After activation: proportional liquidity + share of fees
            amount = (shares * market.liquidity) / market.totalLPShares;
            feeReward = (shares * market.accumulatedFees) / market.totalLPShares;
            market.accumulatedFees -= feeReward;
        }

        market.liquidity -= amount;
        market.totalLPShares -= shares;
        lpShares[h][msg.sender] = 0;

        // Update b parameter
        market.b = market.liquidity / 2;

        uint256 total = amount + feeReward;
        if (total > 0) {
            (bool s, ) = msg.sender.call{value: total}("");
            if (!s) revert TransferFailed();
        }

        emit LiquidityRemoved(h, msg.sender, total, feeReward);
    }

    // ============ Claim LP Rewards (after market finishes) ============
    function claimLPRewards(string calldata _marketId) external {
        bytes32 h = keccak256(abi.encodePacked(_marketId));
        Market storage market = markets[h];
        if (market.creator == address(0)) revert MarketNotFound();
        if (market.marketStatus != MarketStatus.Finished) revert MarketNotFinished();
        if (lpClaimed[h][msg.sender]) revert AlreadyClaimed();

        uint256 shares = lpShares[h][msg.sender];
        if (shares == 0) revert NoLPShares();

        lpClaimed[h][msg.sender] = true;

        // LP gets proportional share of remaining liquidity + accumulated fees
        uint256 lpPool = market.liquidity + market.accumulatedFees;
        uint256 payout = (shares * lpPool) / market.totalLPShares;

        if (payout > 0) {
            (bool s, ) = msg.sender.call{value: payout}("");
            if (!s) revert TransferFailed();
        }

        emit LiquidityRemoved(h, msg.sender, payout, market.accumulatedFees);
    }

    // ============ LMSR Core Math ============
    /**
     * @notice LMSR cost function: C = b * ln(e^(qYes/b) + e^(qNo/b))
     * @dev Uses ABDKMath64x64 for fixed-point ln/exp
     * @param _qYes Outstanding Yes tokens (scaled 1e8)
     * @param _qNo Outstanding No tokens (scaled 1e8)
     * @param _b Liquidity parameter (scaled 1e8)
     * @return cost in tinybars
     */
    function _lmsrCost(uint256 _qYes, uint256 _qNo, uint256 _b) internal pure returns (uint256) {
        if (_b == 0) return 0;

        // Convert to 64.64 fixed point
        // Divide by SCALE first to get "real" values, then work in 64.64
        int128 bFP = ABDKMath64x64.fromUInt(_b).div(ABDKMath64x64.fromUInt(SCALE));
        int128 qYesFP = ABDKMath64x64.fromUInt(_qYes).div(ABDKMath64x64.fromUInt(SCALE));
        int128 qNoFP = ABDKMath64x64.fromUInt(_qNo).div(ABDKMath64x64.fromUInt(SCALE));

        // qYes/b and qNo/b
        int128 ratioYes = qYesFP.div(bFP);
        int128 ratioNo = qNoFP.div(bFP);

        // e^(qYes/b) + e^(qNo/b)
        int128 expYes = ABDKMath64x64.exp(ratioYes);
        int128 expNo = ABDKMath64x64.exp(ratioNo);
        int128 sumExp = expYes.add(expNo);

        // b * ln(sum)
        int128 lnSum = ABDKMath64x64.ln(sumExp);
        int128 costFP = bFP.mul(lnSum);

        // Convert back to tinybars (multiply by SCALE)
        uint256 cost = ABDKMath64x64.toUInt(costFP.mul(ABDKMath64x64.fromUInt(SCALE)));
        return cost;
    }

    /**
     * @notice Get current Yes/No prices in tinybars (0 to 1e8)
     * @dev Yes price = e^(qYes/b) / (e^(qYes/b) + e^(qNo/b)) * 1e8
     */
    function _getPrice(uint256 _qYes, uint256 _qNo, uint256 _b, bool _isYes) internal pure returns (uint256) {
        if (_b == 0) return SCALE / 2; // 0.50 default

        int128 bFP = ABDKMath64x64.fromUInt(_b).div(ABDKMath64x64.fromUInt(SCALE));
        int128 qYesFP = ABDKMath64x64.fromUInt(_qYes).div(ABDKMath64x64.fromUInt(SCALE));
        int128 qNoFP = ABDKMath64x64.fromUInt(_qNo).div(ABDKMath64x64.fromUInt(SCALE));

        int128 expYes = ABDKMath64x64.exp(qYesFP.div(bFP));
        int128 expNo = ABDKMath64x64.exp(qNoFP.div(bFP));
        int128 sumExp = expYes.add(expNo);

        int128 priceFP;
        if (_isYes) {
            priceFP = expYes.div(sumExp);
        } else {
            priceFP = expNo.div(sumExp);
        }

        // Convert to tinybars (0 to 1e8)
        uint256 price = ABDKMath64x64.toUInt(priceFP.mul(ABDKMath64x64.fromUInt(SCALE)));

        // Clamp to [MIN_PRICE, MAX_PRICE]
        if (price < MIN_PRICE) price = MIN_PRICE;
        if (price > MAX_PRICE) price = MAX_PRICE;

        return price;
    }

    // ============ Buy Tokens ============
    /**
     * @notice Buy Yes or No tokens. AMM mints tokens and charges LMSR cost.
     * @param _marketId Market string ID
     * @param _isYes true = buy Yes, false = buy No
     * @param _amount Number of tokens to buy (scaled 1e8, so 1 token = 1e8)
     */
    function buyTokens(
        string calldata _marketId,
        bool _isYes,
        uint256 _amount
    ) external payable onlyInitialized {
        bytes32 h = keccak256(abi.encodePacked(_marketId));
        Market storage market = markets[h];
        if (market.creator == address(0)) revert MarketNotFound();
        if (market.marketStatus != MarketStatus.Active) revert MarketNotActive();
        if (_amount == 0) revert InvalidAmount();

        // Calculate LMSR cost: difference in cost function before and after
        uint256 costBefore = _lmsrCost(market.qYes, market.qNo, market.b);
        uint256 costAfter;
        if (_isYes) {
            costAfter = _lmsrCost(market.qYes + _amount, market.qNo, market.b);
        } else {
            costAfter = _lmsrCost(market.qYes, market.qNo + _amount, market.b);
        }

        uint256 rawCost = costAfter - costBefore;

        // Add betting fee
        uint256 feeAmount = (rawCost * global.bettingFeePercentage) / 10000;
        uint256 totalCost = rawCost + feeAmount;

        // On Hedera, msg.value is in tinybars (relay converts weibars->tinybars)
        // totalCost is also in tinybars, so compare directly
        if (msg.value < totalCost) revert InsufficientPayment();

        // Accumulate fees for LPs (in tinybars)
        market.accumulatedFees += feeAmount;

        // Update token quantities
        if (_isYes) {
            market.qYes += _amount;
            userYesTokens[h][msg.sender] += _amount;
        } else {
            market.qNo += _amount;
            userNoTokens[h][msg.sender] += _amount;
        }

        market.totalVolume += rawCost;

        // Get new prices for event
        uint256 yesPrice = _getPrice(market.qYes, market.qNo, market.b, true);
        uint256 noPrice = _getPrice(market.qYes, market.qNo, market.b, false);

        emit TokensBought(h, msg.sender, _isYes, _amount, totalCost, yesPrice, noPrice);

        // Refund excess (in tinybars)
        uint256 excess = msg.value - totalCost;
        if (excess > 0) {
            (bool s, ) = msg.sender.call{value: excess}("");
            if (!s) revert TransferFailed();
        }
    }

    // ============ Sell Tokens ============
    /**
     * @notice Sell tokens back to the AMM. Returns HBAR based on LMSR.
     */
    function sellTokens(
        string calldata _marketId,
        bool _isYes,
        uint256 _amount
    ) external onlyInitialized {
        bytes32 h = keccak256(abi.encodePacked(_marketId));
        Market storage market = markets[h];
        if (market.creator == address(0)) revert MarketNotFound();
        if (market.marketStatus != MarketStatus.Active) revert MarketNotActive();
        if (_amount == 0) revert InvalidAmount();

        // Check user has enough tokens
        if (_isYes) {
            if (userYesTokens[h][msg.sender] < _amount) revert InsufficientTokens();
        } else {
            if (userNoTokens[h][msg.sender] < _amount) revert InsufficientTokens();
        }

        // Calculate LMSR refund: cost before - cost after (removing tokens)
        uint256 costBefore = _lmsrCost(market.qYes, market.qNo, market.b);
        uint256 costAfter;
        if (_isYes) {
            costAfter = _lmsrCost(market.qYes - _amount, market.qNo, market.b);
        } else {
            costAfter = _lmsrCost(market.qYes, market.qNo - _amount, market.b);
        }

        uint256 rawRefund = costBefore - costAfter;

        // Deduct fee from refund
        uint256 feeAmount = (rawRefund * global.bettingFeePercentage) / 10000;
        uint256 netRefund = rawRefund - feeAmount;

        // Accumulate fees for LPs (in tinybars)
        market.accumulatedFees += feeAmount;

        // Update token quantities
        if (_isYes) {
            market.qYes -= _amount;
            userYesTokens[h][msg.sender] -= _amount;
        } else {
            market.qNo -= _amount;
            userNoTokens[h][msg.sender] -= _amount;
        }

        // Get new prices for event
        uint256 yesPrice = _getPrice(market.qYes, market.qNo, market.b, true);
        uint256 noPrice = _getPrice(market.qYes, market.qNo, market.b, false);

        emit TokensSold(h, msg.sender, _isYes, _amount, netRefund, yesPrice, noPrice);

        // Send refund in tinybars (Hedera relay handles conversion)
        if (netRefund > 0) {
            (bool s, ) = msg.sender.call{value: netRefund}("");
            if (!s) revert TransferFailed();
        }
    }

    // ============ Claim Winnings ============
    /**
     * @notice Winners claim 1 HBAR per winning token
     */
    function claimWinnings(string calldata _marketId) external {
        bytes32 h = keccak256(abi.encodePacked(_marketId));
        Market storage market = markets[h];
        if (market.creator == address(0)) revert MarketNotFound();
        if (market.marketStatus != MarketStatus.Finished) revert MarketNotFinished();
        if (winningsClaimed[h][msg.sender]) revert AlreadyClaimed();

        uint256 winningTokens;
        if (market.result) {
            winningTokens = userYesTokens[h][msg.sender];
        } else {
            winningTokens = userNoTokens[h][msg.sender];
        }

        if (winningTokens == 0) revert NoWinnings();

        winningsClaimed[h][msg.sender] = true;

        // 1 token (1e8 scaled) = 1 HBAR (1e8 tinybars)
        // On Hedera, msg.value and call value are in tinybars
        // winningTokens is already in tinybars scale (1e8 per token)
        if (winningTokens > 0) {
            (bool s, ) = msg.sender.call{value: winningTokens}("");
            if (!s) revert TransferFailed();
        }

        emit WinningsClaimed(h, msg.sender, winningTokens);
    }

    // ============ Resolution ============
    function resolveMarket(string calldata _marketId, bool _result) external onlyAdmin {
        bytes32 h = keccak256(abi.encodePacked(_marketId));
        Market storage market = markets[h];
        if (market.creator == address(0)) revert MarketNotFound();
        if (market.marketStatus != MarketStatus.Active) revert MarketNotActive();
        if (block.timestamp < uint256(uint64(market.resolutionDate))) revert ResolutionTooEarly();

        market.result = _result;
        market.marketStatus = MarketStatus.Finished;

        emit MarketResolved(h, _result);
    }

    // ============ Oracle Functions ============
    function setOracle(address payable _oracle) external onlyAdmin {
        oracle = OptimisticOracle(_oracle);
    }

    function requestOracleResolution(string calldata _marketId) external onlyInitialized {
        bytes32 h = keccak256(abi.encodePacked(_marketId));
        Market storage market = markets[h];
        if (market.creator == address(0)) revert MarketNotFound();
        if (market.marketStatus != MarketStatus.Active) revert MarketNotActive();
        if (block.timestamp < uint256(uint64(market.resolutionDate))) revert ResolutionTooEarly();
        require(address(oracle) != address(0), "Oracle not set");
        require(market.oracleRequestId == bytes32(0), "Already requested");

        bytes32 requestId = oracle.requestResolution(market.question, uint256(uint64(market.resolutionDate)));
        market.oracleRequestId = requestId;
    }

    function finalizeFromOracle(string calldata _marketId) external onlyInitialized {
        bytes32 h = keccak256(abi.encodePacked(_marketId));
        Market storage market = markets[h];
        if (market.creator == address(0)) revert MarketNotFound();
        if (market.marketStatus != MarketStatus.Active) revert MarketNotActive();
        require(address(oracle) != address(0), "Oracle not set");
        require(market.oracleRequestId != bytes32(0), "No oracle request");
        require(oracle.isResolved(market.oracleRequestId), "Oracle not resolved");

        int256 oracleResult = oracle.getResolvedValue(market.oracleRequestId);
        market.result = (oracleResult == 1);
        market.marketStatus = MarketStatus.Finished;

        emit MarketResolved(h, market.result);
    }

    // ============ View Functions ============
    function getMarket(string calldata _marketId) external view returns (Market memory) {
        return markets[keccak256(abi.encodePacked(_marketId))];
    }

    function getMarketByHash(bytes32 _h) external view returns (Market memory) {
        return markets[_h];
    }

    function getMarketCount() external view returns (uint256) {
        return marketIds.length;
    }

    function getMarketIdAt(uint256 _index) external view returns (bytes32) {
        return marketIds[_index];
    }

    function getGlobal() external view returns (Global memory) {
        return global;
    }

    function marketExists(string calldata _marketId) external view returns (bool) {
        return markets[keccak256(abi.encodePacked(_marketId))].creator != address(0);
    }

    /**
     * @notice Get current Yes and No prices in tinybars (0 to 1e8)
     */
    function getPrices(string calldata _marketId) external view returns (uint256 yesPrice, uint256 noPrice) {
        bytes32 h = keccak256(abi.encodePacked(_marketId));
        Market memory market = markets[h];
        yesPrice = _getPrice(market.qYes, market.qNo, market.b, true);
        noPrice = _getPrice(market.qYes, market.qNo, market.b, false);
    }

    /**
     * @notice Estimate cost to buy tokens (read-only)
     */
    function estimateBuyCost(string calldata _marketId, bool _isYes, uint256 _amount) external view returns (uint256 cost, uint256 fee) {
        bytes32 h = keccak256(abi.encodePacked(_marketId));
        Market memory market = markets[h];

        uint256 costBefore = _lmsrCost(market.qYes, market.qNo, market.b);
        uint256 costAfter;
        if (_isYes) {
            costAfter = _lmsrCost(market.qYes + _amount, market.qNo, market.b);
        } else {
            costAfter = _lmsrCost(market.qYes, market.qNo + _amount, market.b);
        }

        cost = costAfter - costBefore;
        fee = (cost * global.bettingFeePercentage) / 10000;
    }

    /**
     * @notice Estimate refund for selling tokens (read-only)
     */
    function estimateSellRefund(string calldata _marketId, bool _isYes, uint256 _amount) external view returns (uint256 refund, uint256 fee) {
        bytes32 h = keccak256(abi.encodePacked(_marketId));
        Market memory market = markets[h];

        if (_isYes && _amount > market.qYes) return (0, 0);
        if (!_isYes && _amount > market.qNo) return (0, 0);

        uint256 costBefore = _lmsrCost(market.qYes, market.qNo, market.b);
        uint256 costAfter;
        if (_isYes) {
            costAfter = _lmsrCost(market.qYes - _amount, market.qNo, market.b);
        } else {
            costAfter = _lmsrCost(market.qYes, market.qNo - _amount, market.b);
        }

        refund = costBefore - costAfter;
        fee = (refund * global.bettingFeePercentage) / 10000;
        refund = refund - fee;
    }

    function getUserTokens(string calldata _marketId, address _user) external view returns (uint256 yesTokens, uint256 noTokens) {
        bytes32 h = keccak256(abi.encodePacked(_marketId));
        return (userYesTokens[h][_user], userNoTokens[h][_user]);
    }

    function getLPInfo(string calldata _marketId, address _user) external view returns (uint256 shares, uint256 totalShares, bool claimed) {
        bytes32 h = keccak256(abi.encodePacked(_marketId));
        return (lpShares[h][_user], markets[h].totalLPShares, lpClaimed[h][_user]);
    }

    // ============ Admin Functions ============
    function updateFeeAuthority(address _new) external onlyAdmin { global.feeAuthority = _new; }
    function updateFees(uint256 _betting, uint256 _fund) external onlyAdmin {
        global.bettingFeePercentage = _betting;
        global.fundFeePercentage = _fund;
    }
    function transferAdmin(address _new) external onlyAdmin { global.admin = _new; }

    // Emergency withdraw
    function withdraw(string calldata _marketId, address _receiver, uint256 _amount) external onlyAdmin {
        bytes32 h = keccak256(abi.encodePacked(_marketId));
        if (markets[h].creator == address(0)) revert MarketNotFound();
        (bool s, ) = _receiver.call{value: _amount}("");
        if (!s) revert TransferFailed();
    }

    receive() external payable {}
}
