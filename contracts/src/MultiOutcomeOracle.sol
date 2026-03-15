// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MultiOutcomeOracle
 * @notice Optimistic oracle for multi-outcome prediction markets on Hedera
 * @dev Same flow as OptimisticOracle but proposedValue/resolvedValue is an outcome index
 *      (0..N-1 = winning outcome, -1 = no winner / void)
 *
 * FLOW:
 * 1. Event timer ends
 * 2. Anyone proposes winning outcome index (Admin: 2 HBAR, User: 10,000 HBAR)
 * 3. 2-hour dispute window
 * 4. Anyone can dispute (Admin: 2 HBAR, User: 10,000 HBAR)
 * 5. If NO dispute → Answer accepted
 * 6. If disputed → Admin resolves, loser loses bond
 */
contract MultiOutcomeOracle {

    // ============ Structs ============
    struct Request {
        address requester;
        bytes32 questionId;
        string question;
        uint256 requestTime;
        uint256 resolutionTime;
        bool resolved;
        int256 resolvedValue;       // outcome index: 0..N-1 or -1 (no winner)
        uint256 outcomeCount;       // how many outcomes this question has
    }

    struct Proposal {
        address proposer;
        int256 proposedValue;       // outcome index: 0..N-1 or -1
        uint256 proposalTime;
        uint256 bondAmount;
        bool disputed;
        address disputer;
        uint256 disputeBond;
        bool settled;
    }

    // ============ State Variables ============
    address public admin;
    uint256 public disputeWindow = 2 hours;
    uint256 public adminBond = 2 * 10**8;           // 2 HBAR
    uint256 public userBond = 10000 * 10**8;        // 10,000 HBAR

    mapping(bytes32 => Request) public requests;
    mapping(bytes32 => Proposal) public proposals;
    bytes32[] public questionIds;

    // ============ Events ============
    event OracleRequestCreated(
        bytes32 indexed questionId,
        address indexed requester,
        string question,
        uint256 resolutionTime,
        uint256 outcomeCount
    );

    event AnswerProposed(
        bytes32 indexed questionId,
        address indexed proposer,
        int256 proposedValue,
        uint256 bondAmount,
        uint256 disputeDeadline
    );

    event AnswerDisputed(
        bytes32 indexed questionId,
        address indexed disputer,
        uint256 bondAmount
    );

    event AnswerSettled(
        bytes32 indexed questionId,
        int256 finalValue,
        address winner,
        uint256 reward
    );

    // ============ Errors ============
    error NotAdmin();
    error RequestNotFound();
    error RequestAlreadyResolved();
    error ProposalAlreadyExists();
    error ProposalNotFound();
    error InsufficientBond();
    error DisputeWindowActive();
    error DisputeWindowExpired();
    error AlreadyDisputed();
    error AlreadySettled();
    error NotDisputed();
    error InvalidValue();
    error ResolutionTimeNotReached();
    error TransferFailed();

    // ============ Modifiers ============
    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    // ============ Constructor ============
    constructor() {
        admin = msg.sender;
    }

    // ============ Helper Functions ============
    function getRequiredBond(address _caller) public view returns (uint256) {
        return _caller == admin ? adminBond : userBond;
    }

    // ============ Request Functions ============

    /**
     * @notice Create oracle request (called by MultiOutcomeEvent)
     * @param _question The event question
     * @param _resolutionTime When the event can be resolved
     * @param _outcomeCount Number of outcomes (for validation)
     */
    function requestResolution(
        string calldata _question,
        uint256 _resolutionTime,
        uint256 _outcomeCount
    ) external returns (bytes32 questionId) {
        questionId = keccak256(abi.encodePacked(_question, _resolutionTime, msg.sender, block.timestamp));

        requests[questionId] = Request({
            requester: msg.sender,
            questionId: questionId,
            question: _question,
            requestTime: block.timestamp,
            resolutionTime: _resolutionTime,
            resolved: false,
            resolvedValue: 0,
            outcomeCount: _outcomeCount
        });

        questionIds.push(questionId);

        emit OracleRequestCreated(questionId, msg.sender, _question, _resolutionTime, _outcomeCount);
        return questionId;
    }

    // ============ Propose Function (Anyone) ============

    /**
     * @notice Propose a winning outcome (anyone can call)
     * @param _questionId The question to answer
     * @param _value Outcome index (0..N-1) or -1 (no winner)
     */
    function proposeAnswer(
        bytes32 _questionId,
        int256 _value
    ) external payable {
        Request storage request = requests[_questionId];

        if (request.requester == address(0)) revert RequestNotFound();
        if (request.resolved) revert RequestAlreadyResolved();
        if (proposals[_questionId].proposer != address(0)) revert ProposalAlreadyExists();
        if (block.timestamp < request.resolutionTime) revert ResolutionTimeNotReached();
        // Validate: must be -1 (no winner) or 0..outcomeCount-1
        if (_value < -1 || _value >= int256(request.outcomeCount)) revert InvalidValue();

        uint256 requiredBond = getRequiredBond(msg.sender);
        if (msg.value < requiredBond) revert InsufficientBond();

        proposals[_questionId] = Proposal({
            proposer: msg.sender,
            proposedValue: _value,
            proposalTime: block.timestamp,
            bondAmount: msg.value,
            disputed: false,
            disputer: address(0),
            disputeBond: 0,
            settled: false
        });

        emit AnswerProposed(
            _questionId,
            msg.sender,
            _value,
            msg.value,
            block.timestamp + disputeWindow
        );
    }

    // ============ Dispute Function (Anyone) ============
    function disputeAnswer(bytes32 _questionId) external payable {
        Proposal storage proposal = proposals[_questionId];

        if (proposal.proposer == address(0)) revert ProposalNotFound();
        if (proposal.disputed) revert AlreadyDisputed();
        if (proposal.settled) revert AlreadySettled();
        if (block.timestamp > proposal.proposalTime + disputeWindow) revert DisputeWindowExpired();

        uint256 requiredBond = getRequiredBond(msg.sender);
        if (msg.value < requiredBond) revert InsufficientBond();

        proposal.disputed = true;
        proposal.disputer = msg.sender;
        proposal.disputeBond = msg.value;

        emit AnswerDisputed(_questionId, msg.sender, msg.value);
    }

    // ============ Settlement Functions ============

    function settleProposal(bytes32 _questionId) external {
        Request storage request = requests[_questionId];
        Proposal storage proposal = proposals[_questionId];

        if (proposal.proposer == address(0)) revert ProposalNotFound();
        if (proposal.settled) revert AlreadySettled();
        if (proposal.disputed) revert AlreadyDisputed();
        if (block.timestamp < proposal.proposalTime + disputeWindow) revert DisputeWindowActive();

        proposal.settled = true;
        request.resolved = true;
        request.resolvedValue = proposal.proposedValue;

        (bool success, ) = proposal.proposer.call{value: proposal.bondAmount}("");
        if (!success) revert TransferFailed();

        emit AnswerSettled(_questionId, proposal.proposedValue, proposal.proposer, 0);
    }

    /**
     * @notice Admin resolves a disputed proposal
     * @param _questionId The question to resolve
     * @param _finalValue The correct outcome index (0..N-1 or -1)
     */
    function resolveDispute(
        bytes32 _questionId,
        int256 _finalValue
    ) external onlyAdmin {
        Request storage request = requests[_questionId];
        Proposal storage proposal = proposals[_questionId];

        if (proposal.proposer == address(0)) revert ProposalNotFound();
        if (!proposal.disputed) revert NotDisputed();
        if (proposal.settled) revert AlreadySettled();
        if (_finalValue < -1 || _finalValue >= int256(request.outcomeCount)) revert InvalidValue();

        proposal.settled = true;
        request.resolved = true;
        request.resolvedValue = _finalValue;

        uint256 totalBonds = proposal.bondAmount + proposal.disputeBond;
        address winner;

        if (proposal.proposedValue == _finalValue) {
            winner = proposal.proposer;
        } else {
            winner = proposal.disputer;
        }

        (bool success, ) = winner.call{value: totalBonds}("");
        if (!success) revert TransferFailed();

        emit AnswerSettled(_questionId, _finalValue, winner, totalBonds);
    }

    // ============ View Functions ============

    function getResolvedValue(bytes32 _questionId) external view returns (int256) {
        require(requests[_questionId].resolved, "Not resolved");
        return requests[_questionId].resolvedValue;
    }

    function isResolved(bytes32 _questionId) external view returns (bool) {
        return requests[_questionId].resolved;
    }

    function getProposal(bytes32 _questionId) external view returns (Proposal memory) {
        return proposals[_questionId];
    }

    function getRequest(bytes32 _questionId) external view returns (Request memory) {
        return requests[_questionId];
    }

    function canSettle(bytes32 _questionId) external view returns (bool) {
        Proposal storage proposal = proposals[_questionId];
        return proposal.proposer != address(0)
            && !proposal.settled
            && !proposal.disputed
            && block.timestamp >= proposal.proposalTime + disputeWindow;
    }

    function canDispute(bytes32 _questionId) external view returns (bool) {
        Proposal storage proposal = proposals[_questionId];
        return proposal.proposer != address(0)
            && !proposal.settled
            && !proposal.disputed
            && block.timestamp < proposal.proposalTime + disputeWindow;
    }

    function disputeTimeRemaining(bytes32 _questionId) external view returns (uint256) {
        Proposal storage proposal = proposals[_questionId];
        uint256 deadline = proposal.proposalTime + disputeWindow;
        if (block.timestamp >= deadline) return 0;
        return deadline - block.timestamp;
    }

    // ============ Admin Functions ============

    function setDisputeWindow(uint256 _newWindow) external onlyAdmin {
        disputeWindow = _newWindow;
    }

    function setAdminBond(uint256 _newBond) external onlyAdmin {
        adminBond = _newBond;
    }

    function setUserBond(uint256 _newBond) external onlyAdmin {
        userBond = _newBond;
    }

    function transferAdmin(address _newAdmin) external onlyAdmin {
        admin = _newAdmin;
    }

    receive() external payable {}
}
