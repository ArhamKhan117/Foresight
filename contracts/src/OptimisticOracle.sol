// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title OptimisticOracle
 * @notice Optimistic oracle for Hedera Prediction Market
 * @dev Anyone can propose/dispute. Admin pays 2 HBAR, users pay 10,000 HBAR
 * 
 * FLOW:
 * 1. Market timer ends
 * 2. Anyone proposes answer (Admin: 2 HBAR, User: 10,000 HBAR)
 * 3. 2-hour dispute window
 * 4. Anyone can dispute (Admin: 2 HBAR, User: 10,000 HBAR)
 * 5. If NO dispute → Answer accepted
 * 6. If disputed → Admin resolves, loser loses bond
 */
contract OptimisticOracle {
    
    // ============ Structs ============
    struct Request {
        address requester;
        bytes32 questionId;
        string question;
        uint256 requestTime;
        uint256 resolutionTime;
        bool resolved;
        int256 resolvedValue;       // 1 = YES, -1 = NO
    }
    
    struct Proposal {
        address proposer;
        int256 proposedValue;       // 1 = YES, -1 = NO
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
        uint256 resolutionTime
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
    
    /**
     * @notice Get required bond amount based on caller
     */
    function getRequiredBond(address _caller) public view returns (uint256) {
        return _caller == admin ? adminBond : userBond;
    }
    
    // ============ Request Functions ============
    
    /**
     * @notice Create oracle request (called by PredictionMarket)
     */
    function requestResolution(
        string calldata _question,
        uint256 _resolutionTime
    ) external returns (bytes32 questionId) {
        questionId = keccak256(abi.encodePacked(_question, _resolutionTime, msg.sender, block.timestamp));
        
        requests[questionId] = Request({
            requester: msg.sender,
            questionId: questionId,
            question: _question,
            requestTime: block.timestamp,
            resolutionTime: _resolutionTime,
            resolved: false,
            resolvedValue: 0
        });
        
        questionIds.push(questionId);
        
        emit OracleRequestCreated(questionId, msg.sender, _question, _resolutionTime);
        return questionId;
    }
    
    // ============ Propose Function (Anyone) ============
    
    /**
     * @notice Propose an answer (anyone can call)
     * @dev Admin pays 2 HBAR, users pay 10,000 HBAR
     * @param _questionId The question to answer
     * @param _value 1 = YES, -1 = NO
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
        if (_value != 1 && _value != -1) revert InvalidValue();
        
        // Check bond: Admin = 2 HBAR, User = 10,000 HBAR
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
    
    /**
     * @notice Dispute a proposed answer (anyone can call)
     * @dev Admin pays 2 HBAR, users pay 10,000 HBAR
     * @param _questionId The question to dispute
     */
    function disputeAnswer(bytes32 _questionId) external payable {
        Proposal storage proposal = proposals[_questionId];
        
        if (proposal.proposer == address(0)) revert ProposalNotFound();
        if (proposal.disputed) revert AlreadyDisputed();
        if (proposal.settled) revert AlreadySettled();
        if (block.timestamp > proposal.proposalTime + disputeWindow) revert DisputeWindowExpired();
        
        // Check bond: Admin = 2 HBAR, User = 10,000 HBAR
        uint256 requiredBond = getRequiredBond(msg.sender);
        if (msg.value < requiredBond) revert InsufficientBond();
        
        proposal.disputed = true;
        proposal.disputer = msg.sender;
        proposal.disputeBond = msg.value;
        
        emit AnswerDisputed(_questionId, msg.sender, msg.value);
    }
    
    // ============ Settlement Functions ============
    
    /**
     * @notice Settle undisputed proposal (anyone can call after dispute window)
     */
    function settleProposal(bytes32 _questionId) external {
        Request storage request = requests[_questionId];
        Proposal storage proposal = proposals[_questionId];
        
        if (proposal.proposer == address(0)) revert ProposalNotFound();
        if (proposal.settled) revert AlreadySettled();
        if (proposal.disputed) revert AlreadyDisputed();
        if (block.timestamp < proposal.proposalTime + disputeWindow) revert DisputeWindowActive();
        
        // No dispute = Proposer's answer accepted!
        proposal.settled = true;
        request.resolved = true;
        request.resolvedValue = proposal.proposedValue;
        
        // Return bond to proposer
        (bool success, ) = proposal.proposer.call{value: proposal.bondAmount}("");
        if (!success) revert TransferFailed();
        
        emit AnswerSettled(_questionId, proposal.proposedValue, proposal.proposer, 0);
    }
    
    /**
     * @notice Admin resolves a disputed proposal
     * @param _questionId The question to resolve
     * @param _finalValue The correct answer (1 = YES, -1 = NO)
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
        if (_finalValue != 1 && _finalValue != -1) revert InvalidValue();
        
        proposal.settled = true;
        request.resolved = true;
        request.resolvedValue = _finalValue;
        
        // Determine winner
        uint256 totalBonds = proposal.bondAmount + proposal.disputeBond;
        address winner;
        
        if (proposal.proposedValue == _finalValue) {
            // Proposer was right
            winner = proposal.proposer;
        } else {
            // Disputer was right
            winner = proposal.disputer;
        }
        
        // Winner gets all bonds
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
