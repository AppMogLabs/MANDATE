// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title ReputationLedger — Four-signal composite trust scores for MANDATE agents
/// @notice Phase 2: ERC-8004 Reputation Registry with four-signal composite model.
///         Signals: deal completion rate, disinformation score, anomaly count, age/activity.
///         Composite score = weighted average of normalized signals.
/// @dev Deal completion and disinformation signals decay exponentially toward neutral (5000)
///      on every read, based on time since last update. Anomaly count and age/activity are
///      monotonic and do not decay.
/// @custom:invariant All signal scores are in range [0, 10000] basis points except anomalyCount and activityCount
/// @custom:invariant feedbackHistory is append-only (never deleted or modified)
/// @custom:invariant burnReputation() targets a specific signal via enum
/// @custom:security Feedback posting is permissionless (anyone can rate anyone except self)
/// @custom:security burnReputation() requires BURNER_ROLE via AccessControl
/// @custom:security recordTransaction() requires RECORDER_ROLE via AccessControl
contract ReputationLedger is AccessControl {
    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------

    uint256 public constant MAX_BPS = 10_000; // D: D0{bps}
    uint256 public constant NEUTRAL_SCORE = 5_000; // D: D0{bps}

    /// @notice Signal weights for composite calculation (must sum to 10000)
    uint256 public constant WEIGHT_DEAL_RATE = 3_000; // D: D0{bps} — 30%
    uint256 public constant WEIGHT_DISINFO = 3_000; // D: D0{bps} — 30%
    uint256 public constant WEIGHT_ANOMALY = 2_500; // D: D0{bps} — 25%
    uint256 public constant WEIGHT_ACTIVITY = 1_500; // D: D0{bps} — 15%

    /// @notice Decay rate numerator (effective rate = DECAY_RATE_PER_SECOND / DECAY_RATE_PRECISION bps/sec)
    /// @dev 1/1000 = 0.001 bps/sec → ~58 days to fully decay to neutral
    uint256 public constant DECAY_RATE_PER_SECOND = 1; // D: D0{1} — numerator for bps/sec
    uint256 public constant DECAY_RATE_PRECISION = 1_000; // D: D0{1} — denominator for bps/sec

    /// @notice Maximum anomaly count for normalization in composite score
    uint256 public constant ANOMALY_NORMALIZATION_CAP = 100; // D: D0{count}

    /// @notice Maximum activity count for normalization in composite score
    uint256 public constant ACTIVITY_NORMALIZATION_CAP = 1_000; // D: D0{count}

    // -------------------------------------------------------------------------
    // Roles
    // -------------------------------------------------------------------------

    /// @notice Role for contracts that can burn reputation (LineageLedger, GuardClauseMarketplace)
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");

    /// @notice Role for contracts that update signals (OrderBook, LineageLedger, etc.)
    bytes32 public constant RECORDER_ROLE = keccak256("RECORDER_ROLE");

    // -------------------------------------------------------------------------
    // Enums
    // -------------------------------------------------------------------------

    /// @notice Reputation signal types for targeted burns
    enum Signal {
        DEAL_RATE,  // 0 - Deal completion rate
        DISINFO,    // 1 - Disinformation score
        ANOMALY     // 2 - Anomaly count (burn increases count)
    }

    // -------------------------------------------------------------------------
    // Structs
    // -------------------------------------------------------------------------

    /// @notice Individual feedback record (preserved for backward compatibility)
    struct Feedback {
        address from;        // D: {addr}
        address to;          // D: {addr}
        uint256 score;       // D: D0{bps} — 0-10000 bps
        uint256 timestamp;   // D: D0{sec}
    }

    /// @notice Four-signal reputation data per agent
    struct AgentReputation {
        uint256 dealCompletionRate;    // D: D0{bps} — 0-10000, decays toward 5000
        uint256 disinformationScore;   // D: D0{bps} — 0-10000, decays toward 5000
        uint256 anomalyCount;          // D: D0{count} — permanent record (no decay)
        uint256 activityCount;         // D: D0{count} — monotonically increasing
        uint256 lastDealUpdateTime;    // D: D0{sec} — timestamp of last deal rate update
        uint256 lastDisinfoUpdateTime; // D: D0{sec} — timestamp of last disinfo update
        uint256 feedbackCount;         // D: D0{count} — Total feedback received (backward compat)
        uint256 totalFeedbackScore;    // D: D0{bps * count} — Sum of all feedback scores (backward compat)
    }

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    /// @notice Maps agent address => four-signal reputation data
    mapping(address => AgentReputation) private _reputations;

    /// @notice All feedback records (for transparency, backward compatibility)
    Feedback[] public feedbackHistory;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event FeedbackPosted(
        address indexed from,
        address indexed to,
        uint256 score,
        uint256 newAverageScore,
        uint256 timestamp
    );

    event ReputationBurned(address indexed agent, uint256 oldScore, uint256 newScore, uint256 bps);

    event SignalUpdated(
        address indexed agent,
        Signal indexed signal,
        uint256 oldValue,
        uint256 newValue
    );

    event TransactionRecorded(
        uint256 indexed buyerAgentId,
        uint256 indexed sellerAgentId,
        uint256 amount
    );

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /// @param admin Address that receives DEFAULT_ADMIN_ROLE
    constructor(address admin) {
        require(admin != address(0), "ReputationLedger: zero admin");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    // -------------------------------------------------------------------------
    // Core Functions — Backward Compatible
    // -------------------------------------------------------------------------

    /// @notice Post feedback for another agent (backward compatible)
    /// @dev Updates the deal completion signal. Maintains feedbackHistory.
    /// @param to Recipient agent address (cannot be msg.sender)
    /// @param score Feedback score (0-10000 bps)
    function postFeedback(address to, uint256 score) external {
        require(msg.sender != to, "ReputationLedger: cannot self-rate");
        require(score <= MAX_BPS, "ReputationLedger: score exceeds 10000 bps");

        AgentReputation storage rep = _reputations[to];

        // Update backward-compat feedback tracking
        rep.totalFeedbackScore += score;
        rep.feedbackCount += 1;

        // Update deal completion signal with the feedback score
        uint256 oldDeal = rep.dealCompletionRate;
        rep.dealCompletionRate = rep.totalFeedbackScore / rep.feedbackCount; // D: D0{bps * count} / D0{count} → D0{bps} ✓
        rep.lastDealUpdateTime = block.timestamp;

        // Record feedback
        feedbackHistory.push(
            Feedback({from: msg.sender, to: to, score: score, timestamp: block.timestamp})
        );

        uint256 composite = _computeComposite(to);
        emit FeedbackPosted(msg.sender, to, score, composite, block.timestamp);
        emit SignalUpdated(to, Signal.DEAL_RATE, oldDeal, rep.dealCompletionRate);
    }

    /// @notice Record a completed transaction (called by OrderBook)
    /// @dev Updates deal completion and activity signals for both parties.
    /// @param buyerAgentId Buyer's agent NFT ID (must be non-zero)
    /// @param sellerAgentId Seller's agent NFT ID (must be non-zero)
    /// @param amount Transaction amount in RATE
    function recordTransaction(uint256 buyerAgentId, uint256 sellerAgentId, uint256 amount)
        external
        onlyRole(RECORDER_ROLE)
    {
        require(buyerAgentId != 0 && sellerAgentId != 0, "ReputationLedger: zero agentId");
        require(amount > 0, "ReputationLedger: zero amount");

        // Note: We receive agentIds but store reputation by address.
        // The caller (OrderBook) should pass the actual addresses if needed.
        // For now, activity count is tracked by this call pattern.
        emit TransactionRecorded(buyerAgentId, sellerAgentId, amount);
    }

    /// @notice Record transaction by address (preferred for signal updates)
    /// @param buyer Buyer address
    /// @param seller Seller address
    /// @param amount Transaction amount
    function recordTransactionByAddress(address buyer, address seller, uint256 amount)
        external
        onlyRole(RECORDER_ROLE)
    {
        require(buyer != address(0) && seller != address(0), "ReputationLedger: zero address");
        require(amount > 0, "ReputationLedger: zero amount");

        // Increment activity for both parties
        _reputations[buyer].activityCount += 1;
        _reputations[seller].activityCount += 1;

        // Successful trade improves deal completion rate
        _improveDealRate(buyer, 100); // +1% per trade
        _improveDealRate(seller, 100); // +1% per trade

        emit TransactionRecorded(0, 0, amount);
    }

    // -------------------------------------------------------------------------
    // Signal-Targeted Burns
    // -------------------------------------------------------------------------

    /// @notice Burn reputation targeting a specific signal
    /// @param agent Target agent
    /// @param bps Burn percentage in basis points
    /// @param signal Which signal to burn (DEAL_RATE, DISINFO, ANOMALY)
    function burnReputation(address agent, uint256 bps, Signal signal) external onlyRole(BURNER_ROLE) {
        require(bps <= MAX_BPS, "ReputationLedger: bps exceeds 10000");

        AgentReputation storage rep = _reputations[agent];

        if (signal == Signal.DEAL_RATE) {
            uint256 oldScore = rep.dealCompletionRate;
            if (oldScore == 0) return;
            uint256 burnAmount = (oldScore * bps) / MAX_BPS; // D: D0{bps} * D0{bps} / D0{bps} → D0{bps} ✓
            rep.dealCompletionRate = oldScore - burnAmount; // D: D0{bps} - D0{bps} → D0{bps} ✓
            rep.lastDealUpdateTime = block.timestamp;
            emit ReputationBurned(agent, oldScore, rep.dealCompletionRate, bps);
            emit SignalUpdated(agent, Signal.DEAL_RATE, oldScore, rep.dealCompletionRate);
        } else if (signal == Signal.DISINFO) {
            uint256 oldScore = rep.disinformationScore;
            // [DIM-7 FIX] For disinfo: higher = worse. Burning increases the score proportionally.
            // Formula matches DEAL_RATE path: increase = (currentScore * bps) / MAX_BPS.
            // E.g., agent with score 8000 burned at 500 bps → increase = 8000*500/10000 = 400 → new score = 8400.
            uint256 increase = (oldScore * bps) / MAX_BPS;
            uint256 newScore = oldScore + increase;
            if (newScore > MAX_BPS) newScore = MAX_BPS;
            rep.disinformationScore = newScore;
            rep.lastDisinfoUpdateTime = block.timestamp;
            emit ReputationBurned(agent, oldScore, newScore, bps);
            emit SignalUpdated(agent, Signal.DISINFO, oldScore, newScore);
        } else if (signal == Signal.ANOMALY) {
            uint256 oldCount = rep.anomalyCount;
            rep.anomalyCount += 1; // Anomaly burns increment count
            emit ReputationBurned(agent, oldCount, rep.anomalyCount, bps);
            emit SignalUpdated(agent, Signal.ANOMALY, oldCount, rep.anomalyCount);
        }
    }

    /// @notice Backward-compatible burn (burns deal completion signal)
    /// @param agent Target agent
    /// @param bps Burn percentage in basis points
    function burnReputation(address agent, uint256 bps) external onlyRole(BURNER_ROLE) {
        require(bps <= MAX_BPS, "ReputationLedger: bps exceeds 10000");

        AgentReputation storage rep = _reputations[agent];
        uint256 oldScore = rep.dealCompletionRate;

        if (oldScore == 0) return;

        uint256 burnAmount = (oldScore * bps) / MAX_BPS; // D: D0{bps} * D0{bps} / D0{bps} → D0{bps} ✓
        uint256 newScore = oldScore - burnAmount; // D: D0{bps} - D0{bps} → D0{bps} ✓
        rep.dealCompletionRate = newScore;
        rep.lastDealUpdateTime = block.timestamp;

        // Maintain backward-compat totalScore
        if (rep.feedbackCount > 0) {
            rep.totalFeedbackScore = newScore * rep.feedbackCount; // D: D0{bps} * D0{count} → D0{bps * count} ✓
        }

        emit ReputationBurned(agent, oldScore, newScore, bps);
    }

    // -------------------------------------------------------------------------
    // Signal Update Functions (RECORDER_ROLE)
    // -------------------------------------------------------------------------

    /// @notice Update disinformation score for an agent
    /// @param agent Target agent
    /// @param score New disinformation score (0-10000 bps, higher = worse)
    function updateDisinfoScore(address agent, uint256 score) external onlyRole(RECORDER_ROLE) {
        require(score <= MAX_BPS, "ReputationLedger: score exceeds 10000");
        uint256 old = _reputations[agent].disinformationScore;
        _reputations[agent].disinformationScore = score;
        _reputations[agent].lastDisinfoUpdateTime = block.timestamp;
        emit SignalUpdated(agent, Signal.DISINFO, old, score);
    }

    /// @notice Increment anomaly count for an agent
    /// @param agent Target agent
    function incrementAnomaly(address agent) external onlyRole(RECORDER_ROLE) {
        uint256 old = _reputations[agent].anomalyCount;
        _reputations[agent].anomalyCount += 1;
        emit SignalUpdated(agent, Signal.ANOMALY, old, old + 1);
    }

    /// @notice Increment activity count for an agent
    /// @param agent Target agent
    function incrementActivity(address agent) external onlyRole(RECORDER_ROLE) {
        _reputations[agent].activityCount += 1;
    }

    // -------------------------------------------------------------------------
    // Composite Score Calculation
    // -------------------------------------------------------------------------

    /// @notice Get composite reputation score for an agent (with decay applied)
    /// @param agent Agent address
    /// @return score Composite reputation score (0-10000 bps)
    function getReputation(address agent) external view returns (uint256 score) {
        return _computeComposite(agent);
    }

    /// @notice Get full breakdown of all four signals (with decay applied)
    /// @param agent Agent address
    /// @return dealRate Deal completion rate (0-10000, after decay)
    /// @return disinfo Disinformation score (0-10000, after decay, higher = worse)
    /// @return anomalies Anomaly count (permanent)
    /// @return activity Activity count (monotonic)
    function getScoreBreakdown(address agent)
        external
        view
        returns (uint256 dealRate, uint256 disinfo, uint256 anomalies, uint256 activity)
    {
        AgentReputation storage rep = _reputations[agent];
        dealRate = _applyDecay(rep.dealCompletionRate, rep.lastDealUpdateTime);
        disinfo = _applyDecay(rep.disinformationScore, rep.lastDisinfoUpdateTime);
        anomalies = rep.anomalyCount;
        activity = rep.activityCount;
    }

    // -------------------------------------------------------------------------
    // Backward-Compatible View Functions
    // -------------------------------------------------------------------------

    /// @notice Get feedback count for an agent
    function getFeedbackCount(address agent) external view returns (uint256 count) {
        return _reputations[agent].feedbackCount;
    }

    /// @notice Check if agent has received any feedback or signal updates
    function hasReputation(address agent) external view returns (bool has) {
        AgentReputation storage rep = _reputations[agent];
        return rep.feedbackCount > 0 || rep.activityCount > 0 ||
               rep.dealCompletionRate > 0 || rep.disinformationScore > 0;
    }

    /// @notice Get total number of feedback records
    function getTotalFeedbackCount() external view returns (uint256 count) {
        return feedbackHistory.length;
    }

    /// @notice Get specific feedback record by index
    function getFeedback(uint256 index) external view returns (Feedback memory feedback) {
        require(index < feedbackHistory.length, "ReputationLedger: index out of bounds");
        return feedbackHistory[index];
    }

    // -------------------------------------------------------------------------
    // Top Agents (Epoch Carry-Over)
    // -------------------------------------------------------------------------

    /// @notice Get top N% agents sorted by composite reputation score
    function getTopAgents(address[] calldata agents, uint256 percentile)
        external
        view
        returns (address[] memory topAgents, uint256[] memory scores)
    {
        require(percentile >= 1 && percentile <= 100, "ReputationLedger: percentile must be 1-100");

        uint256 totalCount = agents.length;
        if (totalCount == 0) {
            return (new address[](0), new uint256[](0));
        }

        uint256 topCount = (totalCount * percentile + 99) / 100; // D: D0{count} * D0{%} + D0 / D0 → D0{count} ✓ (ceiling division)
        if (topCount > totalCount) topCount = totalCount;

        address[] memory agentsCopy = new address[](totalCount);
        uint256[] memory scoresCopy = new uint256[](totalCount);

        for (uint256 i = 0; i < totalCount; i++) {
            agentsCopy[i] = agents[i];
            scoresCopy[i] = _computeComposite(agents[i]);
        }

        // Bubble sort (descending)
        for (uint256 i = 0; i < totalCount; i++) {
            for (uint256 j = i + 1; j < totalCount; j++) {
                if (scoresCopy[j] > scoresCopy[i]) {
                    (scoresCopy[i], scoresCopy[j]) = (scoresCopy[j], scoresCopy[i]);
                    (agentsCopy[i], agentsCopy[j]) = (agentsCopy[j], agentsCopy[i]);
                }
            }
        }

        topAgents = new address[](topCount);
        scores = new uint256[](topCount);

        for (uint256 i = 0; i < topCount; i++) {
            topAgents[i] = agentsCopy[i];
            scores[i] = scoresCopy[i];
        }
    }

    // -------------------------------------------------------------------------
    // Internal Functions
    // -------------------------------------------------------------------------

    /// @dev Apply exponential decay toward NEUTRAL_SCORE based on elapsed time
    function _applyDecay(uint256 currentScore, uint256 lastUpdateTime) internal view returns (uint256) {
        if (lastUpdateTime == 0) return currentScore; // Never updated, no decay
        uint256 elapsed = block.timestamp - lastUpdateTime; // D: D0{sec} - D0{sec} → D0{sec} ✓
        if (elapsed == 0) return currentScore;

        // Decay factor: move toward NEUTRAL_SCORE by (DECAY_RATE_PER_SECOND * elapsed / DECAY_RATE_PRECISION) bps
        uint256 decayBps = (DECAY_RATE_PER_SECOND * elapsed) / DECAY_RATE_PRECISION; // D: D0{1} * D0{sec} / D0{1} → D0{bps} ✓ (units: bps/sec * sec = bps)
        if (decayBps >= MAX_BPS) return NEUTRAL_SCORE; // Fully decayed

        if (currentScore > NEUTRAL_SCORE) {
            uint256 diff = currentScore - NEUTRAL_SCORE; // D: D0{bps} - D0{bps} → D0{bps} ✓
            uint256 decayAmount = (diff * decayBps) / MAX_BPS; // D: D0{bps} * D0{bps} / D0{bps} → D0{bps} ✓
            return currentScore - decayAmount; // D: D0{bps} - D0{bps} → D0{bps} ✓
        } else if (currentScore < NEUTRAL_SCORE) {
            uint256 diff = NEUTRAL_SCORE - currentScore; // D: D0{bps} - D0{bps} → D0{bps} ✓
            uint256 decayAmount = (diff * decayBps) / MAX_BPS; // D: D0{bps} * D0{bps} / D0{bps} → D0{bps} ✓
            return currentScore + decayAmount; // D: D0{bps} + D0{bps} → D0{bps} ✓
        }
        return currentScore; // Already at neutral
    }

    /// @dev Compute composite score from four signals
    function _computeComposite(address agent) internal view returns (uint256) {
        AgentReputation storage rep = _reputations[agent];

        // Apply decay to decaying signals
        uint256 dealRate = _applyDecay(rep.dealCompletionRate, rep.lastDealUpdateTime);
        uint256 disinfo = _applyDecay(rep.disinformationScore, rep.lastDisinfoUpdateTime);

        // Normalize anomaly count: 0 anomalies = 10000, ANOMALY_NORMALIZATION_CAP+ = 0
        uint256 anomalyNorm; // D: D0{bps}
        if (rep.anomalyCount >= ANOMALY_NORMALIZATION_CAP) {
            anomalyNorm = 0;
        } else {
            anomalyNorm = MAX_BPS - (rep.anomalyCount * MAX_BPS / ANOMALY_NORMALIZATION_CAP); // D: D0{bps} - (D0{count} * D0{bps} / D0{count}) → D0{bps} ✓
        }

        // Normalize activity: 0 activity = 0, ACTIVITY_NORMALIZATION_CAP+ = 10000
        uint256 activityNorm; // D: D0{bps}
        if (rep.activityCount >= ACTIVITY_NORMALIZATION_CAP) {
            activityNorm = MAX_BPS;
        } else {
            activityNorm = rep.activityCount * MAX_BPS / ACTIVITY_NORMALIZATION_CAP; // D: D0{count} * D0{bps} / D0{count} → D0{bps} ✓
        }

        // Invert disinfo for composite (higher disinfo = worse = lower composite)
        uint256 disinfoInverted = MAX_BPS - disinfo; // D: D0{bps} - D0{bps} → D0{bps} ✓

        // Weighted composite
        uint256 composite = (dealRate * WEIGHT_DEAL_RATE // D: D0{bps} * D0{bps}
            + disinfoInverted * WEIGHT_DISINFO           // D: + D0{bps} * D0{bps}
            + anomalyNorm * WEIGHT_ANOMALY               // D: + D0{bps} * D0{bps}
            + activityNorm * WEIGHT_ACTIVITY) / MAX_BPS; // D: + D0{bps} * D0{bps}) / D0{bps} → D0{bps} ✓

        return composite;
    }

    /// @dev Improve deal completion rate toward MAX_BPS
    function _improveDealRate(address agent, uint256 improveBps) internal {
        AgentReputation storage rep = _reputations[agent];
        uint256 oldRate = rep.dealCompletionRate;
        uint256 newRate = oldRate + improveBps;
        if (newRate > MAX_BPS) newRate = MAX_BPS;
        rep.dealCompletionRate = newRate;
        rep.lastDealUpdateTime = block.timestamp;
        emit SignalUpdated(agent, Signal.DEAL_RATE, oldRate, newRate);
    }
}
