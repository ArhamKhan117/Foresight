// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "abdk-libraries-solidity/ABDKMath64x64.sol";
import "./MultiOutcomeOracle.sol";

/**
 * @title MultiOutcomeEvent
 * @notice Multi-outcome prediction market events on Hedera
 * @dev Each event has N outcomes. Each outcome is an independent LMSR binary market.
 *      Single tx to create all outcomes, single tx to fund all outcomes.
 */
contract MultiOutcomeEvent {
    using ABDKMath64x64 for int128;

    // ============ Enums ============
    enum EventStatus { Prepare, Active, Finished }

    // ============ Structs ============
    struct Global {
        address admin;
        address feeAuthority;
        uint256 creatorFeeAmount;       // tinybars
        uint256 bettingFeePercentage;   // basis points (250 = 2.5%)
        uint256 fundFeePercentage;      // basis points (150 = 1.5%)
    }

    struct Outcome {
        string name;
        uint256 qYes;                   // Outstanding Yes tokens (scaled 1e8)
        uint256 qNo;                    // Outstanding No tokens (scaled 1e8)
        uint256 b;                      // Liquidity parameter (scaled 1e8)
        uint256 totalVolume;            // Total HBAR wagered (tinybars)
        uint256 accumulatedFees;        // Betting fees for LPs (tinybars)
    }

    struct Event {
        address creator;
        EventStatus status;
        string question;                // Event question
        int64 resolutionDate;
        uint256 outcomeCount;
        uint256 liquidity;              // Total LP deposits (tinybars)
        uint256 liquidityGoal;          // Funding target (tinybars)
        uint256 totalLPShares;
        int256 winningOutcome;          // -1 = unresolved, 0..N-1 = winner
        bytes32 oracleRequestId;        // Oracle request ID (bytes32(0) = none)
    }

    // ============ Constants ============
    uint256 constant SCALE = 1e8;
    uint256 constant ONE_HBAR = 1e8;
    uint256 constant MIN_PRICE = 1e6;   // 0.01
    uint256 constant MAX_PRICE = 99e6;  // 0.99

    // ============ State ============
    Global public global;
    bool public initialized;
    MultiOutcomeOracle public oracle;

    // eventId => Event
    mapping(bytes32 => Event) public events;
    // eventId => outcomeIndex => Outcome
    mapping(bytes32 => mapping(uint256 => Outcome)) public outcomes;
    bytes32[] public eventIds;

    // LP shares: eventId => funder => shares
    mapping(bytes32 => mapping(address => uint256)) public lpShares;
    mapping(bytes32 => mapping(address => bool)) public lpClaimed;

    // User tokens: eventId => outcomeIndex => user => tokens
    mapping(bytes32 => mapping(uint256 => mapping(address => uint256))) public userYesTokens;
    mapping(bytes32 => mapping(uint256 => mapping(address => uint256))) public userNoTokens;
    mapping(bytes32 => mapping(address => bool)) public winningsClaimed;

    // ============ Events ============
    event GlobalInitialized(address indexed admin, address indexed feeAuthority);
    event EventCreated(bytes32 indexed eventId, address indexed creator, string question, uint256 outcomeCount, uint256 liquidityGoal);
    event EventActivated(bytes32 indexed eventId, uint256 liquidity);
    event LiquidityAdded(bytes32 indexed eventId, address indexed user, uint256 amount, uint256 shares);
    event LiquidityRemoved(bytes32 indexed eventId, address indexed user, uint256 amount);
    event TokensBought(bytes32 indexed eventId, uint256 outcomeIndex, address indexed user, bool isYes, uint256 amount, uint256 cost);
    event TokensSold(bytes32 indexed eventId, uint256 outcomeIndex, address indexed user, bool isYes, uint256 amount, uint256 payout);
    event WinningsClaimed(bytes32 indexed eventId, address indexed user, uint256 payout);
    event EventResolved(bytes32 indexed eventId, int256 winningOutcome);

    // ============ Errors ============
    error AlreadyInitialized();
    error NotInitialized();
    error NotAdmin();
    error InvalidAmount();
    error EventNotPreparing();
    error EventNotActive();
    error EventNotFinished();
    error EventAlreadyExists();
    error EventNotFound();
    error TransferFailed();
    error InsufficientTokens();
    error AlreadyClaimed();
    error NoWinnings();
    error NoLPShares();
    error InsufficientPayment();
    error InvalidOutcome();
    error TooFewOutcomes();

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
        emit GlobalInitialized(msg.sender, _feeAuthority);
    }

    // ============ Create Event (all outcomes in one tx) ============
    function createEvent(
        string calldata _eventId,
        string calldata _question,
        string[] calldata _outcomeNames,
        int64 _resolutionDate,
        uint256 _liquidityGoal
    ) external payable onlyInitialized {
        if (_outcomeNames.length < 2) revert TooFewOutcomes();
        bytes32 h = keccak256(abi.encodePacked(_eventId));
        if (events[h].creator != address(0)) revert EventAlreadyExists();
        if (msg.value < global.creatorFeeAmount) revert InvalidAmount();
        if (_liquidityGoal < ONE_HBAR) revert InvalidAmount();

        // Transfer creator fee
        (bool fs, ) = global.feeAuthority.call{value: global.creatorFeeAmount}("");
        if (!fs) revert TransferFailed();

        events[h] = Event({
            creator: msg.sender,
            status: EventStatus.Prepare,
            question: _question,
            resolutionDate: _resolutionDate,
            outcomeCount: _outcomeNames.length,
            liquidity: 0,
            liquidityGoal: _liquidityGoal,
            totalLPShares: 0,
            winningOutcome: -1,
            oracleRequestId: bytes32(0)
        });

        for (uint256 i = 0; i < _outcomeNames.length; i++) {
            outcomes[h][i] = Outcome({
                name: _outcomeNames[i],
                qYes: 0,
                qNo: 0,
                b: 0,
                totalVolume: 0,
                accumulatedFees: 0
            });
        }

        eventIds.push(h);
        emit EventCreated(h, msg.sender, _question, _outcomeNames.length, _liquidityGoal);

        // Refund excess
        uint256 excess = msg.value - global.creatorFeeAmount;
        if (excess > 0) {
            (bool s, ) = msg.sender.call{value: excess}("");
            if (!s) revert TransferFailed();
        }
    }

    // ============ Fund Event (single tx funds all outcomes) ============
    function fundEvent(string calldata _eventId) external payable onlyInitialized {
        bytes32 h = keccak256(abi.encodePacked(_eventId));
        Event storage evt = events[h];
        if (evt.creator == address(0)) revert EventNotFound();
        if (evt.status == EventStatus.Finished) revert EventNotActive();
        if (msg.value < 100000) revert InvalidAmount();

        // Fee
        uint256 feeAmount = (msg.value * global.fundFeePercentage) / 10000;
        uint256 liquidityAmount = msg.value - feeAmount;

        if (feeAmount > 0) {
            (bool fs, ) = global.feeAuthority.call{value: feeAmount}("");
            if (!fs) revert TransferFailed();
        }

        // LP shares
        uint256 shares;
        if (evt.totalLPShares == 0) {
            shares = liquidityAmount;
        } else {
            shares = (liquidityAmount * evt.totalLPShares) / evt.liquidity;
        }

        evt.liquidity += liquidityAmount;
        evt.totalLPShares += shares;
        lpShares[h][msg.sender] += shares;

        // Split liquidity evenly across outcomes and update b parameter
        uint256 perOutcome = evt.liquidity / evt.outcomeCount;
        for (uint256 i = 0; i < evt.outcomeCount; i++) {
            outcomes[h][i].b = perOutcome / 2;
        }

        // Activate if goal reached
        if (evt.status == EventStatus.Prepare && evt.liquidity >= evt.liquidityGoal) {
            evt.status = EventStatus.Active;
            emit EventActivated(h, evt.liquidity);
        }

        emit LiquidityAdded(h, msg.sender, liquidityAmount, shares);
    }

    // ============ Remove Liquidity ============
    function removeLiquidity(string calldata _eventId) external {
        bytes32 h = keccak256(abi.encodePacked(_eventId));
        Event storage evt = events[h];
        if (evt.creator == address(0)) revert EventNotFound();
        if (evt.status == EventStatus.Finished) revert EventNotFinished();

        uint256 shares = lpShares[h][msg.sender];
        if (shares == 0) revert NoLPShares();

        uint256 amount;
        uint256 feeReward = 0;

        if (evt.status == EventStatus.Prepare) {
            amount = (shares * evt.liquidity) / evt.totalLPShares;
        } else {
            amount = (shares * evt.liquidity) / evt.totalLPShares;
            // Sum fees across all outcomes
            uint256 totalFees = 0;
            for (uint256 i = 0; i < evt.outcomeCount; i++) {
                totalFees += outcomes[h][i].accumulatedFees;
            }
            feeReward = (shares * totalFees) / evt.totalLPShares;
            // Deduct proportionally from each outcome
            for (uint256 i = 0; i < evt.outcomeCount; i++) {
                uint256 outcomeFeeShare = (shares * outcomes[h][i].accumulatedFees) / evt.totalLPShares;
                outcomes[h][i].accumulatedFees -= outcomeFeeShare;
            }
        }

        evt.liquidity -= amount;
        evt.totalLPShares -= shares;
        lpShares[h][msg.sender] = 0;

        // Update b for all outcomes
        uint256 perOutcome = evt.outcomeCount > 0 ? evt.liquidity / evt.outcomeCount : 0;
        for (uint256 i = 0; i < evt.outcomeCount; i++) {
            outcomes[h][i].b = perOutcome / 2;
        }

        uint256 total = amount + feeReward;
        if (total > 0) {
            (bool s, ) = msg.sender.call{value: total}("");
            if (!s) revert TransferFailed();
        }

        emit LiquidityRemoved(h, msg.sender, total);
    }

    // ============ Claim LP Rewards (after event finishes) ============
    function claimLPRewards(string calldata _eventId) external {
        bytes32 h = keccak256(abi.encodePacked(_eventId));
        Event storage evt = events[h];
        if (evt.creator == address(0)) revert EventNotFound();
        if (evt.status != EventStatus.Finished) revert EventNotFinished();
        if (lpClaimed[h][msg.sender]) revert AlreadyClaimed();

        uint256 shares = lpShares[h][msg.sender];
        if (shares == 0) revert NoLPShares();

        lpClaimed[h][msg.sender] = true;

        uint256 totalFees = 0;
        for (uint256 i = 0; i < evt.outcomeCount; i++) {
            totalFees += outcomes[h][i].accumulatedFees;
        }

        uint256 lpPool = evt.liquidity + totalFees;
        uint256 payout = (shares * lpPool) / evt.totalLPShares;

        if (payout > 0) {
            (bool s, ) = msg.sender.call{value: payout}("");
            if (!s) revert TransferFailed();
        }

        emit LiquidityRemoved(h, msg.sender, payout);
    }

    // ============ LMSR Core Math ============
    function _lmsrCost(uint256 _qYes, uint256 _qNo, uint256 _b) internal pure returns (uint256) {
        if (_b == 0) return 0;
        int128 bFP = ABDKMath64x64.fromUInt(_b).div(ABDKMath64x64.fromUInt(SCALE));
        int128 qYesFP = ABDKMath64x64.fromUInt(_qYes).div(ABDKMath64x64.fromUInt(SCALE));
        int128 qNoFP = ABDKMath64x64.fromUInt(_qNo).div(ABDKMath64x64.fromUInt(SCALE));

        int128 expYes = ABDKMath64x64.exp(qYesFP.div(bFP));
        int128 expNo = ABDKMath64x64.exp(qNoFP.div(bFP));
        int128 sumExp = expYes.add(expNo);
        int128 lnSum = ABDKMath64x64.ln(sumExp);
        int128 costFP = bFP.mul(lnSum);

        return ABDKMath64x64.toUInt(costFP.mul(ABDKMath64x64.fromUInt(SCALE)));
    }

    function _getPrice(uint256 _qYes, uint256 _qNo, uint256 _b, bool _isYes) internal pure returns (uint256) {
        if (_b == 0) return SCALE / 2;
        int128 bFP = ABDKMath64x64.fromUInt(_b).div(ABDKMath64x64.fromUInt(SCALE));
        int128 qYesFP = ABDKMath64x64.fromUInt(_qYes).div(ABDKMath64x64.fromUInt(SCALE));
        int128 qNoFP = ABDKMath64x64.fromUInt(_qNo).div(ABDKMath64x64.fromUInt(SCALE));

        int128 expYes = ABDKMath64x64.exp(qYesFP.div(bFP));
        int128 expNo = ABDKMath64x64.exp(qNoFP.div(bFP));
        int128 sumExp = expYes.add(expNo);

        int128 priceFP = _isYes ? expYes.div(sumExp) : expNo.div(sumExp);
        uint256 price = ABDKMath64x64.toUInt(priceFP.mul(ABDKMath64x64.fromUInt(SCALE)));

        if (price < MIN_PRICE) price = MIN_PRICE;
        if (price > MAX_PRICE) price = MAX_PRICE;
        return price;
    }

    // ============ Buy Tokens (on a specific outcome) ============
    function buyTokens(
        string calldata _eventId,
        uint256 _outcomeIndex,
        bool _isYes,
        uint256 _amount
    ) external payable onlyInitialized {
        bytes32 h = keccak256(abi.encodePacked(_eventId));
        Event storage evt = events[h];
        if (evt.creator == address(0)) revert EventNotFound();
        if (evt.status != EventStatus.Active) revert EventNotActive();
        if (_outcomeIndex >= evt.outcomeCount) revert InvalidOutcome();
        if (_amount == 0) revert InvalidAmount();

        Outcome storage o = outcomes[h][_outcomeIndex];

        uint256 costBefore = _lmsrCost(o.qYes, o.qNo, o.b);
        uint256 costAfter;
        if (_isYes) {
            costAfter = _lmsrCost(o.qYes + _amount, o.qNo, o.b);
        } else {
            costAfter = _lmsrCost(o.qYes, o.qNo + _amount, o.b);
        }

        uint256 rawCost = costAfter - costBefore;
        uint256 feeAmount = (rawCost * global.bettingFeePercentage) / 10000;
        uint256 totalCost = rawCost + feeAmount;

        if (msg.value < totalCost) revert InsufficientPayment();

        o.accumulatedFees += feeAmount;

        if (_isYes) {
            o.qYes += _amount;
            userYesTokens[h][_outcomeIndex][msg.sender] += _amount;
        } else {
            o.qNo += _amount;
            userNoTokens[h][_outcomeIndex][msg.sender] += _amount;
        }

        o.totalVolume += rawCost;

        emit TokensBought(h, _outcomeIndex, msg.sender, _isYes, _amount, totalCost);

        uint256 excess = msg.value - totalCost;
        if (excess > 0) {
            (bool s, ) = msg.sender.call{value: excess}("");
            if (!s) revert TransferFailed();
        }
    }

    // ============ Sell Tokens ============
    function sellTokens(
        string calldata _eventId,
        uint256 _outcomeIndex,
        bool _isYes,
        uint256 _amount
    ) external onlyInitialized {
        bytes32 h = keccak256(abi.encodePacked(_eventId));
        Event storage evt = events[h];
        if (evt.creator == address(0)) revert EventNotFound();
        if (evt.status != EventStatus.Active) revert EventNotActive();
        if (_outcomeIndex >= evt.outcomeCount) revert InvalidOutcome();
        if (_amount == 0) revert InvalidAmount();

        Outcome storage o = outcomes[h][_outcomeIndex];

        if (_isYes) {
            if (userYesTokens[h][_outcomeIndex][msg.sender] < _amount) revert InsufficientTokens();
        } else {
            if (userNoTokens[h][_outcomeIndex][msg.sender] < _amount) revert InsufficientTokens();
        }

        uint256 costBefore = _lmsrCost(o.qYes, o.qNo, o.b);
        uint256 costAfter;
        if (_isYes) {
            costAfter = _lmsrCost(o.qYes - _amount, o.qNo, o.b);
        } else {
            costAfter = _lmsrCost(o.qYes, o.qNo - _amount, o.b);
        }

        uint256 rawRefund = costBefore - costAfter;
        uint256 feeAmount = (rawRefund * global.bettingFeePercentage) / 10000;
        uint256 netRefund = rawRefund - feeAmount;

        o.accumulatedFees += feeAmount;

        if (_isYes) {
            o.qYes -= _amount;
            userYesTokens[h][_outcomeIndex][msg.sender] -= _amount;
        } else {
            o.qNo -= _amount;
            userNoTokens[h][_outcomeIndex][msg.sender] -= _amount;
        }

        emit TokensSold(h, _outcomeIndex, msg.sender, _isYes, _amount, netRefund);

        if (netRefund > 0) {
            (bool s, ) = msg.sender.call{value: netRefund}("");
            if (!s) revert TransferFailed();
        }
    }

    // ============ Claim Winnings ============
    function claimWinnings(string calldata _eventId) external {
        bytes32 h = keccak256(abi.encodePacked(_eventId));
        Event storage evt = events[h];
        if (evt.creator == address(0)) revert EventNotFound();
        if (evt.status != EventStatus.Finished) revert EventNotFinished();
        if (winningsClaimed[h][msg.sender]) revert AlreadyClaimed();
        if (evt.winningOutcome < 0) revert NoWinnings();

        uint256 winIdx = uint256(evt.winningOutcome);
        uint256 winningTokens = userYesTokens[h][winIdx][msg.sender];
        if (winningTokens == 0) revert NoWinnings();

        winningsClaimed[h][msg.sender] = true;

        if (winningTokens > 0) {
            (bool s, ) = msg.sender.call{value: winningTokens}("");
            if (!s) revert TransferFailed();
        }

        emit WinningsClaimed(h, msg.sender, winningTokens);
    }

    // ============ Resolution ============
    function resolveEvent(string calldata _eventId, int256 _winningOutcome) external onlyAdmin {
        bytes32 h = keccak256(abi.encodePacked(_eventId));
        Event storage evt = events[h];
        if (evt.creator == address(0)) revert EventNotFound();
        if (evt.status != EventStatus.Active) revert EventNotActive();
        if (_winningOutcome < -1 || _winningOutcome >= int256(evt.outcomeCount)) revert InvalidOutcome();

        evt.winningOutcome = _winningOutcome;
        evt.status = EventStatus.Finished;

        emit EventResolved(h, _winningOutcome);
    }

    // ============ View Functions ============
    function getEvent(string calldata _eventId) external view returns (Event memory) {
        return events[keccak256(abi.encodePacked(_eventId))];
    }

    function getOutcome(string calldata _eventId, uint256 _index) external view returns (Outcome memory) {
        return outcomes[keccak256(abi.encodePacked(_eventId))][_index];
    }

    function getOutcomePrices(string calldata _eventId, uint256 _index) external view returns (uint256 yesPrice, uint256 noPrice) {
        bytes32 h = keccak256(abi.encodePacked(_eventId));
        Outcome memory o = outcomes[h][_index];
        yesPrice = _getPrice(o.qYes, o.qNo, o.b, true);
        noPrice = _getPrice(o.qYes, o.qNo, o.b, false);
    }

    function eventExists(string calldata _eventId) external view returns (bool) {
        return events[keccak256(abi.encodePacked(_eventId))].creator != address(0);
    }

    function getEventCount() external view returns (uint256) {
        return eventIds.length;
    }

    function getGlobal() external view returns (Global memory) {
        return global;
    }

    function getUserTokens(string calldata _eventId, uint256 _outcomeIndex, address _user) external view returns (uint256 yesTokens, uint256 noTokens) {
        bytes32 h = keccak256(abi.encodePacked(_eventId));
        return (userYesTokens[h][_outcomeIndex][_user], userNoTokens[h][_outcomeIndex][_user]);
    }

    function getLPInfo(string calldata _eventId, address _user) external view returns (uint256 shares, uint256 totalShares, bool claimed) {
        bytes32 h = keccak256(abi.encodePacked(_eventId));
        return (lpShares[h][_user], events[h].totalLPShares, lpClaimed[h][_user]);
    }

    function estimateBuyCost(string calldata _eventId, uint256 _outcomeIndex, bool _isYes, uint256 _amount) external view returns (uint256 cost, uint256 fee) {
        bytes32 h = keccak256(abi.encodePacked(_eventId));
        Outcome memory o = outcomes[h][_outcomeIndex];
        uint256 costBefore = _lmsrCost(o.qYes, o.qNo, o.b);
        uint256 costAfter;
        if (_isYes) {
            costAfter = _lmsrCost(o.qYes + _amount, o.qNo, o.b);
        } else {
            costAfter = _lmsrCost(o.qYes, o.qNo + _amount, o.b);
        }
        cost = costAfter - costBefore;
        fee = (cost * global.bettingFeePercentage) / 10000;
    }

    // ============ Oracle Functions ============
    function setOracle(address payable _oracle) external onlyAdmin {
        oracle = MultiOutcomeOracle(_oracle);
    }

    function requestOracleResolution(string calldata _eventId) external onlyInitialized {
        bytes32 h = keccak256(abi.encodePacked(_eventId));
        Event storage evt = events[h];
        if (evt.creator == address(0)) revert EventNotFound();
        if (evt.status != EventStatus.Active) revert EventNotActive();
        if (block.timestamp < uint256(uint64(evt.resolutionDate))) revert InvalidAmount();
        require(address(oracle) != address(0), "Oracle not set");
        require(evt.oracleRequestId == bytes32(0), "Already requested");

        bytes32 requestId = oracle.requestResolution(evt.question, uint256(uint64(evt.resolutionDate)), evt.outcomeCount);
        evt.oracleRequestId = requestId;
    }

    function finalizeFromOracle(string calldata _eventId) external onlyInitialized {
        bytes32 h = keccak256(abi.encodePacked(_eventId));
        Event storage evt = events[h];
        if (evt.creator == address(0)) revert EventNotFound();
        if (evt.status != EventStatus.Active) revert EventNotActive();
        require(address(oracle) != address(0), "Oracle not set");
        require(evt.oracleRequestId != bytes32(0), "No oracle request");
        require(oracle.isResolved(evt.oracleRequestId), "Oracle not resolved");

        int256 oracleResult = oracle.getResolvedValue(evt.oracleRequestId);
        evt.winningOutcome = oracleResult;
        evt.status = EventStatus.Finished;

        emit EventResolved(h, oracleResult);
    }

    // ============ Admin Functions ============
    function updateFeeAuthority(address _new) external onlyAdmin { global.feeAuthority = _new; }
    function updateFees(uint256 _betting, uint256 _fund) external onlyAdmin {
        global.bettingFeePercentage = _betting;
        global.fundFeePercentage = _fund;
    }
    function transferAdmin(address _new) external onlyAdmin { global.admin = _new; }

    receive() external payable {}
}
