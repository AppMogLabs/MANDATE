// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../src/ReputationLedger.sol";

/// @title ReputationLedger Test Suite
/// @notice Phase 2 — Four-signal composite reputation system tests
contract ReputationLedgerTest is Test {
    ReputationLedger public ledger;

    address public admin = address(1);
    address public agent1 = address(0x101);
    address public agent2 = address(0x102);
    address public agent3 = address(0x103);
    address public agent4 = address(0x104);
    address public lineageLedger = address(0x200);
    address public recorder = address(0x300);
    address public unauthorized = address(0x999);

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
        ReputationLedger.Signal indexed signal,
        uint256 oldValue,
        uint256 newValue
    );

    function setUp() public {
        ledger = new ReputationLedger(admin);

        vm.startPrank(admin);
        ledger.grantRole(ledger.BURNER_ROLE(), lineageLedger);
        ledger.grantRole(ledger.RECORDER_ROLE(), recorder);
        vm.stopPrank();
    }

    // -------------------------------------------------------------------------
    // Constructor Tests
    // -------------------------------------------------------------------------

    function test_Constructor_GrantsAdminRole() public view {
        assertTrue(ledger.hasRole(ledger.DEFAULT_ADMIN_ROLE(), admin));
    }

    function test_Constructor_RevertsOnZeroAdmin() public {
        vm.expectRevert("ReputationLedger: zero admin");
        new ReputationLedger(address(0));
    }

    // -------------------------------------------------------------------------
    // postFeedback Tests
    // -------------------------------------------------------------------------

    function test_PostFeedback_FirstFeedback() public {
        uint256 score = 8000;

        vm.prank(agent1);
        ledger.postFeedback(agent2, score);

        // Deal completion rate should be set to 8000
        (uint256 dealRate,,,) = ledger.getScoreBreakdown(agent2);
        assertEq(dealRate, score, "First feedback sets deal rate");
        assertEq(ledger.getFeedbackCount(agent2), 1, "Feedback count should be 1");
    }

    function test_PostFeedback_UpdatesAverage() public {
        vm.prank(agent1);
        ledger.postFeedback(agent2, 8000);

        vm.prank(agent3);
        ledger.postFeedback(agent2, 6000);

        // Deal completion rate = (8000+6000)/2 = 7000
        (uint256 dealRate,,,) = ledger.getScoreBreakdown(agent2);
        assertEq(dealRate, 7000, "Average should be (8000+6000)/2");
        assertEq(ledger.getFeedbackCount(agent2), 2, "Feedback count should be 2");
    }

    function test_PostFeedback_ThreeFeedbacksAverage() public {
        vm.prank(agent1);
        ledger.postFeedback(agent2, 9000);
        vm.prank(agent3);
        ledger.postFeedback(agent2, 7000);
        vm.prank(agent4);
        ledger.postFeedback(agent2, 8000);

        (uint256 dealRate,,,) = ledger.getScoreBreakdown(agent2);
        assertEq(dealRate, 8000, "Average of 3 feedbacks");
        assertEq(ledger.getFeedbackCount(agent2), 3, "Count should be 3");
    }

    function test_PostFeedback_RevertsOnSelfFeedback() public {
        vm.prank(agent1);
        vm.expectRevert("ReputationLedger: cannot self-rate");
        ledger.postFeedback(agent1, 5000);
    }

    function test_PostFeedback_RevertsOnScoreAboveMax() public {
        vm.prank(agent1);
        vm.expectRevert("ReputationLedger: score exceeds 10000 bps");
        ledger.postFeedback(agent2, 10_001);
    }

    function test_PostFeedback_AllowsZeroScore() public {
        vm.prank(agent1);
        ledger.postFeedback(agent2, 0);

        (uint256 dealRate,,,) = ledger.getScoreBreakdown(agent2);
        assertEq(dealRate, 0, "Zero score should be allowed");
        assertEq(ledger.getFeedbackCount(agent2), 1, "Count incremented");
    }

    function test_PostFeedback_AllowsMaxScore() public {
        vm.prank(agent1);
        ledger.postFeedback(agent2, 10_000);

        (uint256 dealRate,,,) = ledger.getScoreBreakdown(agent2);
        assertEq(dealRate, 10_000, "Max score (10000 bps) allowed");
    }

    // -------------------------------------------------------------------------
    // burnReputation Tests (backward-compatible 2-arg)
    // -------------------------------------------------------------------------

    function test_BurnReputation_ReducesScore() public {
        vm.prank(agent1);
        ledger.postFeedback(agent2, 8000);

        vm.prank(lineageLedger);
        ledger.burnReputation(agent2, 500); // 5%

        // 8000 - (8000 * 500 / 10000) = 7600
        (uint256 dealRate,,,) = ledger.getScoreBreakdown(agent2);
        assertEq(dealRate, 7600, "Score reduced by 5%");
    }

    function test_BurnReputation_100PercentBurn() public {
        vm.prank(agent1);
        ledger.postFeedback(agent2, 5000);

        vm.prank(lineageLedger);
        ledger.burnReputation(agent2, 10_000);

        (uint256 dealRate,,,) = ledger.getScoreBreakdown(agent2);
        assertEq(dealRate, 0, "100% burn sets deal rate to 0");
    }

    function test_BurnReputation_MultiplePartialBurns() public {
        vm.prank(agent1);
        ledger.postFeedback(agent2, 10_000);

        vm.startPrank(lineageLedger);
        ledger.burnReputation(agent2, 1000); // 10% -> 9000
        ledger.burnReputation(agent2, 1000); // 10% of 9000 -> 8100
        vm.stopPrank();

        (uint256 dealRate,,,) = ledger.getScoreBreakdown(agent2);
        assertEq(dealRate, 8100, "Compounding burns");
    }

    function test_BurnReputation_RevertsUnauthorized() public {
        vm.prank(agent1);
        ledger.postFeedback(agent2, 8000);

        vm.prank(unauthorized);
        vm.expectRevert();
        ledger.burnReputation(agent2, 500);
    }

    function test_BurnReputation_RevertsOnExcessiveBps() public {
        vm.prank(agent1);
        ledger.postFeedback(agent2, 5000);

        vm.prank(lineageLedger);
        vm.expectRevert("ReputationLedger: bps exceeds 10000");
        ledger.burnReputation(agent2, 10_001);
    }

    function test_BurnReputation_NoOpOnZeroReputation() public {
        vm.prank(lineageLedger);
        ledger.burnReputation(agent2, 500);

        (uint256 dealRate,,,) = ledger.getScoreBreakdown(agent2);
        assertEq(dealRate, 0, "Burning zero rep is no-op");
    }

    // -------------------------------------------------------------------------
    // Signal-Targeted Burns (3-arg)
    // -------------------------------------------------------------------------

    function test_BurnSignal_DealRate() public {
        vm.prank(agent1);
        ledger.postFeedback(agent2, 8000);

        vm.prank(lineageLedger);
        ledger.burnReputation(agent2, 500, ReputationLedger.Signal.DEAL_RATE);

        (uint256 dealRate,,,) = ledger.getScoreBreakdown(agent2);
        assertEq(dealRate, 7600, "Deal rate burned by 5%");
    }

    function test_BurnSignal_Disinfo() public {
        // [DIM-7] Burn is now proportional: increase = (oldScore * bps) / MAX_BPS
        // First set an initial disinfo score of 8000
        vm.prank(recorder);
        ledger.updateDisinfoScore(agent2, 8000);

        // Burn 500 bps from 8000 → increase = (8000 * 500) / 10000 = 400 → new score = 8400
        vm.prank(lineageLedger);
        ledger.burnReputation(agent2, 500, ReputationLedger.Signal.DISINFO);

        (,uint256 disinfo,,) = ledger.getScoreBreakdown(agent2);
        assertEq(disinfo, 8400, "Disinfo increased proportionally: 8000 + (8000*500/10000) = 8400");
    }

    function test_BurnSignal_Anomaly() public {
        vm.prank(lineageLedger);
        ledger.burnReputation(agent2, 0, ReputationLedger.Signal.ANOMALY);

        (,,uint256 anomalies,) = ledger.getScoreBreakdown(agent2);
        assertEq(anomalies, 1, "Anomaly count incremented");
    }

    // -------------------------------------------------------------------------
    // Composite Score Tests
    // -------------------------------------------------------------------------

    function test_CompositeScore_DefaultIsZero() public view {
        // Fresh agent: dealRate=0, disinfo=0, anomaly=0, activity=0
        // Composite: (0*3000 + 10000*3000 + 10000*2500 + 0*1500) / 10000 = 5500
        uint256 rep = ledger.getReputation(agent2);
        assertEq(rep, 5500, "Default composite = 5500 (neutral disinfo + neutral anomaly)");
    }

    function test_CompositeScore_WithFeedback() public {
        vm.prank(agent1);
        ledger.postFeedback(agent2, 10_000); // Max deal rate

        // Composite: (10000*3000 + 10000*3000 + 10000*2500 + 0*1500) / 10000
        //          = (30000000 + 30000000 + 25000000 + 0) / 10000 = 8500
        uint256 rep = ledger.getReputation(agent2);
        assertEq(rep, 8500, "High deal rate + clean disinfo + clean anomaly");
    }

    function test_CompositeScore_WithDisinfo() public {
        vm.prank(agent1);
        ledger.postFeedback(agent2, 10_000); // Max deal rate

        // [DIM-7] Set disinfo score directly to 5000 (proportional burn from 0 would give 0)
        vm.prank(recorder);
        ledger.updateDisinfoScore(agent2, 5000);

        // disinfo = 5000, inverted = 5000
        // Composite: (10000*3000 + 5000*3000 + 10000*2500 + 0*1500) / 10000 = 7000
        uint256 rep = ledger.getReputation(agent2);
        assertEq(rep, 7000, "Disinfo reduces composite");
    }

    function test_GetScoreBreakdown() public {
        vm.prank(agent1);
        ledger.postFeedback(agent2, 7000);

        // [DIM-7] Set initial disinfo, then burn proportionally
        vm.prank(recorder);
        ledger.updateDisinfoScore(agent2, 3000); // Set base score

        // Burn 1000 bps from 3000 → increase = (3000*1000)/10000 = 300 → new = 3300
        vm.prank(lineageLedger);
        ledger.burnReputation(agent2, 1000, ReputationLedger.Signal.DISINFO);

        vm.prank(lineageLedger);
        ledger.burnReputation(agent2, 0, ReputationLedger.Signal.ANOMALY);

        (uint256 dealRate, uint256 disinfo, uint256 anomalies, uint256 activity) =
            ledger.getScoreBreakdown(agent2);

        assertEq(dealRate, 7000, "Deal rate");
        assertEq(disinfo, 3300, "Disinfo score: 3000 + (3000*1000/10000) = 3300");
        assertEq(anomalies, 1, "Anomaly count");
        assertEq(activity, 0, "Activity count");
    }

    // -------------------------------------------------------------------------
    // recordTransaction Tests
    // -------------------------------------------------------------------------

    function test_RecordTransaction_RequiresRecorderRole() public {
        vm.prank(unauthorized);
        vm.expectRevert();
        ledger.recordTransaction(1, 2, 1e18);
    }

    function test_RecordTransaction_RevertsOnZeroAgentId() public {
        vm.prank(recorder);
        vm.expectRevert("ReputationLedger: zero agentId");
        ledger.recordTransaction(0, 1, 1e18);
    }

    function test_RecordTransaction_Succeeds() public {
        vm.prank(recorder);
        ledger.recordTransaction(1, 2, 1e18);
        // No revert = success
    }

    function test_RecordTransactionByAddress_UpdatesActivity() public {
        vm.prank(recorder);
        ledger.recordTransactionByAddress(agent1, agent2, 1e18);

        (,,,uint256 activity1) = ledger.getScoreBreakdown(agent1);
        (,,,uint256 activity2) = ledger.getScoreBreakdown(agent2);
        assertEq(activity1, 1, "Buyer activity incremented");
        assertEq(activity2, 1, "Seller activity incremented");
    }

    // -------------------------------------------------------------------------
    // Signal Update Functions
    // -------------------------------------------------------------------------

    function test_UpdateDisinfo_RequiresRecorderRole() public {
        vm.prank(unauthorized);
        vm.expectRevert();
        ledger.updateDisinfoScore(agent1, 500);
    }

    function test_UpdateDisinfo_Succeeds() public {
        vm.prank(recorder);
        ledger.updateDisinfoScore(agent1, 3000);

        (,uint256 disinfo,,) = ledger.getScoreBreakdown(agent1);
        assertEq(disinfo, 3000, "Disinfo score updated");
    }

    function test_IncrementAnomaly() public {
        vm.startPrank(recorder);
        ledger.incrementAnomaly(agent1);
        ledger.incrementAnomaly(agent1);
        vm.stopPrank();

        (,,uint256 anomalies,) = ledger.getScoreBreakdown(agent1);
        assertEq(anomalies, 2, "Anomaly count = 2");
    }

    function test_IncrementActivity() public {
        vm.startPrank(recorder);
        ledger.incrementActivity(agent1);
        ledger.incrementActivity(agent1);
        ledger.incrementActivity(agent1);
        vm.stopPrank();

        (,,,uint256 activity) = ledger.getScoreBreakdown(agent1);
        assertEq(activity, 3, "Activity count = 3");
    }

    // -------------------------------------------------------------------------
    // Decay Tests
    // -------------------------------------------------------------------------

    function test_Decay_DealRateDecaysTowardNeutral() public {
        vm.prank(agent1);
        ledger.postFeedback(agent2, 10_000);

        // Advance time
        vm.warp(block.timestamp + 1_000_000); // 1,000,000 seconds

        // Decay: decayBps = 1_000_000 / 1000 = 1000 bps
        // diff = 10000 - 5000 = 5000, decayAmount = 5000 * 1000 / 10000 = 500
        // decayed = 10000 - 500 = 9500
        (uint256 dealRate,,,) = ledger.getScoreBreakdown(agent2);
        assertEq(dealRate, 9500, "Deal rate decays toward neutral");
    }

    function test_Decay_FullDecay() public {
        vm.prank(agent1);
        ledger.postFeedback(agent2, 10_000);

        // Advance time far enough for full decay (need decayBps >= 10000, so elapsed >= 10,000,000)
        vm.warp(block.timestamp + 10_000_001);

        (uint256 dealRate,,,) = ledger.getScoreBreakdown(agent2);
        assertEq(dealRate, 5000, "Fully decayed to neutral");
    }

    function test_Decay_LowScoreDecaysUp() public {
        vm.prank(agent1);
        ledger.postFeedback(agent2, 0); // Below neutral

        vm.warp(block.timestamp + 1_000_000); // 1,000,000 seconds

        // decayBps = 1_000_000 / 1000 = 1000
        // diff = 5000 - 0 = 5000, decayAmount = 5000 * 1000/10000 = 500
        // decayed = 0 + 500 = 500
        (uint256 dealRate,,,) = ledger.getScoreBreakdown(agent2);
        assertEq(dealRate, 500, "Low score decays up toward neutral");
    }

    // -------------------------------------------------------------------------
    // getTopAgents Tests
    // -------------------------------------------------------------------------

    function test_GetTopAgents_EmptyArray() public {
        address[] memory empty = new address[](0);
        (address[] memory topAgents, uint256[] memory scores) = ledger.getTopAgents(empty, 20);
        assertEq(topAgents.length, 0);
        assertEq(scores.length, 0);
    }

    function test_GetTopAgents_SortsByComposite() public {
        // Give agent1 high deal rate, agent2 low
        vm.prank(agent3);
        ledger.postFeedback(agent1, 10_000);
        vm.prank(agent3);
        ledger.postFeedback(agent2, 2000);

        address[] memory allAgents = new address[](2);
        allAgents[0] = agent2;
        allAgents[1] = agent1;

        (address[] memory topAgents,) = ledger.getTopAgents(allAgents, 50);
        assertEq(topAgents[0], agent1, "Agent1 should be first (higher composite)");
    }

    function test_GetTopAgents_RevertsOnInvalidPercentile() public {
        address[] memory agents = new address[](2);
        agents[0] = agent1;
        agents[1] = agent2;

        vm.expectRevert("ReputationLedger: percentile must be 1-100");
        ledger.getTopAgents(agents, 0);

        vm.expectRevert("ReputationLedger: percentile must be 1-100");
        ledger.getTopAgents(agents, 101);
    }

    // -------------------------------------------------------------------------
    // ERC-8004 Compliance Tests
    // -------------------------------------------------------------------------

    function test_ERC8004_GetReputation() public {
        vm.prank(agent1);
        ledger.postFeedback(agent2, 7500);

        uint256 rep = ledger.getReputation(agent2);
        // Composite with dealRate=7500: (7500*3000 + 10000*3000 + 10000*2500 + 0*1500) / 10000
        // = (22500000 + 30000000 + 25000000 + 0) / 10000 = 7750
        assertEq(rep, 7750, "ERC-8004 getReputation returns composite");
    }

    function test_ERC8004_HasReputation_AfterFeedback() public {
        vm.prank(agent1);
        ledger.postFeedback(agent2, 4000);
        assertTrue(ledger.hasReputation(agent2));
    }

    function test_ERC8004_HasReputation_NoFeedback() public view {
        assertFalse(ledger.hasReputation(agent2));
    }

    // -------------------------------------------------------------------------
    // Edge Cases
    // -------------------------------------------------------------------------

    function testFuzz_PostFeedback_ValidScores(address from, address to, uint256 score) public {
        vm.assume(from != address(0) && to != address(0));
        vm.assume(from != to);
        vm.assume(score <= 10_000);

        vm.prank(from);
        ledger.postFeedback(to, score);

        (uint256 dealRate,,,) = ledger.getScoreBreakdown(to);
        assertEq(dealRate, score);
        assertEq(ledger.getFeedbackCount(to), 1);
    }

    function testFuzz_BurnReputation(uint256 initialScore, uint256 bps) public {
        initialScore = bound(initialScore, 1, 10_000);
        bps = bound(bps, 0, 10_000);

        vm.prank(agent1);
        ledger.postFeedback(agent2, initialScore);

        vm.prank(lineageLedger);
        ledger.burnReputation(agent2, bps);

        uint256 expected = initialScore - (initialScore * bps / 10_000);
        (uint256 dealRate,,,) = ledger.getScoreBreakdown(agent2);
        assertEq(dealRate, expected, "Burn calculation");
    }

    // -------------------------------------------------------------------------
    // Feedback History Tests
    // -------------------------------------------------------------------------

    function test_GetFeedback_ValidIndex() public {
        vm.prank(agent1);
        ledger.postFeedback(agent2, 7500);

        ReputationLedger.Feedback memory fb = ledger.getFeedback(0);
        assertEq(fb.from, agent1);
        assertEq(fb.to, agent2);
        assertEq(fb.score, 7500);
    }

    function test_GetFeedback_OutOfBounds() public {
        vm.expectRevert("ReputationLedger: index out of bounds");
        ledger.getFeedback(0);
    }

    function test_GetTotalFeedbackCount() public {
        assertEq(ledger.getTotalFeedbackCount(), 0);

        vm.prank(agent1);
        ledger.postFeedback(agent2, 5000);
        assertEq(ledger.getTotalFeedbackCount(), 1);

        vm.prank(agent2);
        ledger.postFeedback(agent1, 6000);
        assertEq(ledger.getTotalFeedbackCount(), 2);
    }
}
