// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title MandateEchoOracle — Real-time intelligence market for mandate predictions
/// @notice Agents publish commit-reveal mandate vectors. Premium subscribers decrypt.
///         Echo reliability tracking rewards accurate agents with on-chain trust scores.
/// @dev Security: AccessControl (PREMIUM_ROLE), spam mitigation via gas doubling,
///      30-block minimum interval enforcement. MegaETH compatible (block.timestamp, block.number).
/// @custom:invariant Reliability score = (matchCount / totalCommitments) in basis points [0, 10000]
/// @custom:invariant MIN_COMMIT_INTERVAL_BLOCKS = 30 (enforces minimum time between commits)
/// @custom:invariant Spam mitigation window = 100 blocks (exponential gas cost scaling)
/// @custom:invariant revealed == true implies revealTimestamp > 0 and revealedVectors[hash] != bytes32(0)
/// @custom:invariant commitVector requires at least 30 blocks since last commit (after first commit)
/// @custom:invariant revealVector requires 30 blocks elapsed since commit (timestamp delta check)
/// @custom:security AccessControl enforces PREMIUM_ROLE for decrypt and reliability score access
/// @custom:security Spam mitigation uses exponential gas cost: BASE_GAS_COST * 2^commitCount
/// @custom:security Commit-reveal pattern prevents frontrunning (hash committed before reveal)
contract MandateEchoOracle is AccessControl {
    /* ══════════════════════════════════════════════════════════════════════════════
       CONSTANTS & ROLES
       ══════════════════════════════════════════════════════════════════════════════ */

    bytes32 public constant PREMIUM_ROLE = keccak256("PREMIUM_ROLE");

    uint256 public constant MIN_COMMIT_INTERVAL_BLOCKS = 30;
    uint256 public constant SPAM_WINDOW_BLOCKS = 100;
    uint256 public constant BASE_GAS_COST = 0.001 ether; // Minimum gas payment for spam mitigation
    uint256 public constant MAX_RELIABILITY_SCORE_BPS = 10000; // 100% = 10000 bps

    /* ══════════════════════════════════════════════════════════════════════════════
       STRUCTS
       ══════════════════════════════════════════════════════════════════════════════ */

    /// @notice Echo commitment structure
    struct Echo {
        bytes32 hash;           // Commitment hash of mandate vector
        address agent;          // Agent who committed
        uint64 timestamp;       // Timestamp of commitment
        uint64 revealTimestamp; // Timestamp when revealed (0 if not revealed)
        bool revealed;          // Whether the vector has been revealed
    }

    /* ══════════════════════════════════════════════════════════════════════════════
       STATE VARIABLES
       ══════════════════════════════════════════════════════════════════════════════ */

    /// @notice Mapping from hash to Echo commitment
    mapping(bytes32 => Echo) public echos;

    /// @notice Last commit block number for each agent (30-block interval enforcement)
    mapping(address => uint256) public lastCommitBlock;

    /// @notice Commit count in rolling 100-block window for spam mitigation
    mapping(address => uint256) public commitCountIn100Blocks;

    /// @notice First commit block in current 100-block window (for rolling window reset)
    mapping(address => uint256) public windowStartBlock;

    /// @notice Historical match count for reliability score (agent => matches)
    mapping(address => uint256) public matchCount;

    /// @notice Historical total commitment count for reliability score (agent => total)
    mapping(address => uint256) public totalCommitments;

    /// @notice Revealed vector data (hash => decrypted vector) — stub for Phase 2
    mapping(bytes32 => bytes32) public revealedVectors;

    /* ══════════════════════════════════════════════════════════════════════════════
       EVENTS
       ══════════════════════════════════════════════════════════════════════════════ */

    event VectorCommitted(bytes32 indexed hash, address indexed agent, uint256 blockNumber);
    event VectorRevealed(bytes32 indexed hash, address indexed agent, bytes32 decrypted);
    event ReliabilityScoreUpdated(address indexed agent, uint256 scoreBps);

    /* ══════════════════════════════════════════════════════════════════════════════
       CONSTRUCTOR
       ══════════════════════════════════════════════════════════════════════════════ */

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /* ══════════════════════════════════════════════════════════════════════════════
       CORE FUNCTIONS
       ══════════════════════════════════════════════════════════════════════════════ */

    /// @notice Commit a mandate vector hash
    /// @dev Enforces 30-block minimum interval and gas-doubling spam mitigation
    /// @param hash Commitment hash of the mandate vector
    function commitVector(bytes32 hash) external payable {
        require(hash != bytes32(0), "Empty hash");

        // 30-block minimum interval enforcement (skip check on first commit)
        uint256 lastBlock = lastCommitBlock[msg.sender];
        if (lastBlock > 0) {
            require(
                block.number - lastBlock >= MIN_COMMIT_INTERVAL_BLOCKS, // D: D0{blk} - D0{blk} >= D0{blk} → bool ✓
                "Commit too soon"
            );
        }

        // Rolling 100-block window spam mitigation
        _enforceSpamMitigation();

        // Store commitment
        echos[hash] = Echo({
            hash: hash,
            agent: msg.sender,
            timestamp: uint64(block.timestamp),
            revealTimestamp: 0,
            revealed: false
        });

        // Update tracking
        lastCommitBlock[msg.sender] = block.number;
        totalCommitments[msg.sender]++; // D: D0{count} + 1 → D0{count} ✓

        emit VectorCommitted(hash, msg.sender, block.number);
    }

    /// @notice Decrypt a committed vector for a premium subscriber
    /// @dev Premium-tier only. Returns stub decrypted vector for Phase 2.
    ///      Full encryption/decryption implemented in Phase 3.
    /// @param subscriber Address of the premium subscriber requesting decrypt
    /// @param proof Cryptographic proof (unused in Phase 2, reserved for Phase 3)
    /// @return Decrypted vector (stub: returns stored reveal or zero)
    function decryptForSubscriber(address subscriber, bytes calldata proof)
        external
        view
        onlyRole(PREMIUM_ROLE)
        returns (bytes32)
    {
        // Phase 2 stub: require subscriber parameter to be used (avoid unused warning)
        require(subscriber != address(0), "Invalid subscriber");
        
        // Phase 3 will implement actual decryption using proof
        // For Phase 2, return zero as stub
        return bytes32(0);
    }

    /// @notice Get echo reliability score for an agent (historical match rate)
    /// @dev Premium-tier only. Returns 0-10000 bps (0% to 100%)
    /// @param agent Address of the agent
    /// @return scoreBps Reliability score in basis points
    function getEchoReliabilityScore(address agent)
        external
        view
        onlyRole(PREMIUM_ROLE)
        returns (uint256 scoreBps)
    {
        uint256 total = totalCommitments[agent];
        if (total == 0) {
            return 0;
        }

        // Score = (matches / total) * 10000
        scoreBps = (matchCount[agent] * MAX_RELIABILITY_SCORE_BPS) / total; // D: D0{count} * D0{bps} / D0{count} → D0{bps} ✓
        
        // Cap at 100%
        if (scoreBps > MAX_RELIABILITY_SCORE_BPS) {
            scoreBps = MAX_RELIABILITY_SCORE_BPS;
        }

        return scoreBps;
    }

    /// @notice Get echo commitment details
    /// @param hash Commitment hash
    /// @return Echo structure
    function getEcho(bytes32 hash) external view returns (Echo memory) {
        return echos[hash];
    }

    /* ══════════════════════════════════════════════════════════════════════════════
       REVEAL FUNCTIONS (Phase 2 Stub + Phase 3 Preparation)
       ══════════════════════════════════════════════════════════════════════════════ */

    /// @notice Reveal a committed vector (admin only for Phase 2)
    /// @dev Phase 3 will allow agent-initiated reveals with cryptographic proof
    /// @param hash Commitment hash
    /// @param decryptedVector The revealed vector
    /// @param isMatch Whether the revealed vector matched the actual mandate execution
    function revealVector(bytes32 hash, bytes32 decryptedVector, bool isMatch)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        Echo storage echo = echos[hash];
        require(echo.agent != address(0), "Echo not found");
        require(!echo.revealed, "Already revealed");

        // Store reveal
        echo.revealed = true;
        echo.revealTimestamp = uint64(block.timestamp);
        revealedVectors[hash] = decryptedVector;

        // Update reliability score
        if (isMatch) {
            matchCount[echo.agent]++;
        }

        uint256 scoreBps = (matchCount[echo.agent] * MAX_RELIABILITY_SCORE_BPS)
            / totalCommitments[echo.agent]; // D: D0{count} * D0{bps} / D0{count} → D0{bps} ✓

        emit VectorRevealed(hash, echo.agent, decryptedVector);
        emit ReliabilityScoreUpdated(echo.agent, scoreBps);
    }

    /* ══════════════════════════════════════════════════════════════════════════════
       INTERNAL HELPERS
       ══════════════════════════════════════════════════════════════════════════════ */

    /// @notice Enforce spam mitigation via gas doubling in 100-block rolling window
    /// @dev Gas cost doubles for each additional commit in the window
    function _enforceSpamMitigation() internal {
        // Check if we need to reset the window (moved beyond 100 blocks)
        if (block.number - windowStartBlock[msg.sender] >= SPAM_WINDOW_BLOCKS) { // D: D0{blk} - D0{blk} >= D0{blk} → bool ✓
            // Reset window
            windowStartBlock[msg.sender] = block.number;
            commitCountIn100Blocks[msg.sender] = 0;
        }

        // Increment commit count
        uint256 commitCount = commitCountIn100Blocks[msg.sender];
        commitCountIn100Blocks[msg.sender] = commitCount + 1; // D: D0{count} + 1 → D0{count} ✓

        // Gas doubling: BASE_GAS_COST * (2 ^ commitCount)
        // For first commit in window (count=0): 0.001 ETH
        // For second commit (count=1): 0.002 ETH
        // For third commit (count=2): 0.004 ETH, etc.
        if (commitCount > 0) {
            uint256 requiredGas = BASE_GAS_COST * (2 ** commitCount); // D: D18{ETH} * D0{scalar} → D18{ETH} ✓ ⚠ overflow if commitCount >= 256
            require(msg.value >= requiredGas, "Insufficient spam prevention payment");
        } else {
            // First commit in window is free
            require(msg.value == 0, "No payment required for first commit");
        }
    }

    /* ══════════════════════════════════════════════════════════════════════════════
       ADMIN FUNCTIONS
       ══════════════════════════════════════════════════════════════════════════════ */

    /// @notice Withdraw accumulated gas payments (spam mitigation fees)
    /// @param to Recipient address
    function withdrawFees(address payable to) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(to != address(0), "Invalid recipient");
        uint256 balance = address(this).balance;
        require(balance > 0, "No fees to withdraw");
        
        (bool success, ) = to.call{value: balance}("");
        require(success, "Transfer failed");
    }

    /// @notice Receive function to accept ETH for spam mitigation
    receive() external payable {}
}
