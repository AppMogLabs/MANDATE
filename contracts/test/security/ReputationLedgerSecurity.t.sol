// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {ReputationLedger} from "../../src/ReputationLedger.sol";

/// @title ReputationLedger Security Tests (Phase 2)
/// @notice Tests for four-signal composite reputation system security
contract ReputationLedgerSecurityTest is Test {
    ReputationLedger public ledger;
    address public admin = address(1);
    address public lineageLedger = address(2);
    address public recorder = address(3);
    address public agent1 = address(0x101);
    address public agent2 = address(0x102);

    function setUp() public {
        vm.startPrank(admin);
        ledger = new ReputationLedger(admin);
        ledger.grantRole(ledger.BURNER_ROLE(), lineageLedger);
        ledger.grantRole(ledger.RECORDER_ROLE(), recorder);
        vm.stopPrank();
    }

    // -------------------------------------------------------------------------
    // Self-Feedback Prevention
    // -------------------------------------------------------------------------

    function test_SelfFeedback_Reverts() public {
        vm.prank(agent1);
        vm.expectRevert("ReputationLedger: cannot self-rate");
        ledger.postFeedback(agent1, 5000);
    }

    // -------------------------------------------------------------------------
    // Score Validation
    // -------------------------------------------------------------------------

    function test_ScoreAboveMax_Reverts() public {
        vm.prank(agent1);
        vm.expectRevert("ReputationLedger: score exceeds 10000 bps");
        ledger.postFeedback(agent2, 10_001);
    }

    function test_ScoreAtMaxBoundary_Succeeds() public {
        vm.prank(agent1);
        ledger.postFeedback(agent2, 10_000);
        (uint256 dealRate,,,) = ledger.getScoreBreakdown(agent2);
        assertEq(dealRate, 10_000);
    }

    // -------------------------------------------------------------------------
    // Burn Authorization
    // -------------------------------------------------------------------------

    function test_BurnReputation_UnauthorizedReverts() public {
        vm.prank(agent1);
        ledger.postFeedback(agent2, 8000);

        vm.prank(address(0x999));
        vm.expectRevert();
        ledger.burnReputation(agent2, 500);
    }

    function test_BurnReputation_AuthorizedSucceeds() public {
        vm.prank(agent1);
        ledger.postFeedback(agent2, 8000);

        vm.prank(lineageLedger);
        ledger.burnReputation(agent2, 500);
        (uint256 dealRate,,,) = ledger.getScoreBreakdown(agent2);
        assertEq(dealRate, 7600);
    }

    function test_BurnExcessiveBps_Reverts() public {
        vm.prank(agent1);
        ledger.postFeedback(agent2, 5000);

        vm.prank(lineageLedger);
        vm.expectRevert("ReputationLedger: bps exceeds 10000");
        ledger.burnReputation(agent2, 10_001);
    }

    // -------------------------------------------------------------------------
    // Signal-Targeted Burn Security
    // -------------------------------------------------------------------------

    function test_SignalBurn_UnauthorizedReverts() public {
        vm.prank(address(0x999));
        vm.expectRevert();
        ledger.burnReputation(agent2, 500, ReputationLedger.Signal.DISINFO);
    }

    function test_SignalBurn_DisinfoCappedAtMax() public {
        // [DIM-7] Set initial high score, then burn to cap
        vm.prank(recorder);
        ledger.updateDisinfoScore(agent2, 9000);

        // Burn 5000 bps: increase = (9000*5000)/10000 = 4500 → 9000+4500=13500 → capped at 10000
        vm.prank(lineageLedger);
        ledger.burnReputation(agent2, 5000, ReputationLedger.Signal.DISINFO);

        (,uint256 disinfo,,) = ledger.getScoreBreakdown(agent2);
        assertEq(disinfo, 10_000, "Disinfo capped at MAX_BPS");
    }

    // -------------------------------------------------------------------------
    // recordTransaction Security
    // -------------------------------------------------------------------------

    function test_RecordTransaction_ZeroAgentId_Reverts() public {
        vm.prank(recorder);
        vm.expectRevert("ReputationLedger: zero agentId");
        ledger.recordTransaction(0, 1, 1e18);

        vm.prank(recorder);
        vm.expectRevert("ReputationLedger: zero agentId");
        ledger.recordTransaction(1, 0, 1e18);
    }

    function test_RecordTransaction_ZeroAmount_Reverts() public {
        vm.prank(recorder);
        vm.expectRevert("ReputationLedger: zero amount");
        ledger.recordTransaction(1, 2, 0);
    }

    function test_RecordTransaction_UnauthorizedReverts() public {
        vm.prank(address(0x999));
        vm.expectRevert();
        ledger.recordTransaction(1, 2, 1e18);
    }

    // -------------------------------------------------------------------------
    // RECORDER_ROLE Security
    // -------------------------------------------------------------------------

    function test_UpdateDisinfo_UnauthorizedReverts() public {
        vm.prank(address(0x999));
        vm.expectRevert();
        ledger.updateDisinfoScore(agent1, 5000);
    }

    function test_IncrementAnomaly_UnauthorizedReverts() public {
        vm.prank(address(0x999));
        vm.expectRevert();
        ledger.incrementAnomaly(agent1);
    }

    function test_IncrementActivity_UnauthorizedReverts() public {
        vm.prank(address(0x999));
        vm.expectRevert();
        ledger.incrementActivity(agent1);
    }

    // -------------------------------------------------------------------------
    // Average Calculation Edge Cases
    // -------------------------------------------------------------------------

    function test_AverageCalculation_MultipleFeeds() public {
        vm.prank(agent1);
        ledger.postFeedback(agent2, 10_000);

        vm.prank(address(0x103));
        ledger.postFeedback(agent2, 0);

        (uint256 dealRate,,,) = ledger.getScoreBreakdown(agent2);
        assertEq(dealRate, 5000);
        assertEq(ledger.getFeedbackCount(agent2), 2);
    }

    function test_AverageCalculation_LargeCount() public {
        for (uint160 i = 100; i < 200; i++) {
            vm.prank(address(i));
            ledger.postFeedback(agent2, 7000);
        }

        (uint256 dealRate,,,) = ledger.getScoreBreakdown(agent2);
        assertEq(dealRate, 7000);
        assertEq(ledger.getFeedbackCount(agent2), 100);
    }

    // -------------------------------------------------------------------------
    // getTopAgents Edge Cases
    // -------------------------------------------------------------------------

    function test_GetTopAgents_InvalidPercentile() public {
        address[] memory agents = new address[](2);
        agents[0] = agent1;
        agents[1] = agent2;

        vm.expectRevert("ReputationLedger: percentile must be 1-100");
        ledger.getTopAgents(agents, 0);

        vm.expectRevert("ReputationLedger: percentile must be 1-100");
        ledger.getTopAgents(agents, 101);
    }

    function test_GetTopAgents_EmptyArray() public view {
        address[] memory empty = new address[](0);
        (address[] memory top, uint256[] memory scores) = ledger.getTopAgents(empty, 20);
        assertEq(top.length, 0);
        assertEq(scores.length, 0);
    }

    // -------------------------------------------------------------------------
    // Decay Security
    // -------------------------------------------------------------------------

    function test_Decay_NoDecayAtTimestampZero() public {
        // Fresh agent with no updates — scores should not have decay applied
        (uint256 dealRate,,,) = ledger.getScoreBreakdown(agent1);
        assertEq(dealRate, 0, "No decay on never-updated signal");
    }

    function test_Decay_CannotExceedNeutral() public {
        vm.prank(agent1);
        ledger.postFeedback(agent2, 10_000);

        // Even with extreme time advancement, should cap at neutral
        // With DECAY_RATE_PRECISION=1000, need elapsed >= 10,000,000 for full decay
        vm.warp(block.timestamp + 100_000_000);
        (uint256 dealRate,,,) = ledger.getScoreBreakdown(agent2);
        assertEq(dealRate, 5000, "Cannot decay past neutral");
    }

    // -------------------------------------------------------------------------
    // Overflow/Underflow Protection
    // -------------------------------------------------------------------------

    function test_AverageCalculation_NoOverflow() public {
        for (uint160 i = 100; i < 110; i++) {
            vm.prank(address(i));
            ledger.postFeedback(agent2, 10_000);
        }

        (uint256 dealRate,,,) = ledger.getScoreBreakdown(agent2);
        assertEq(dealRate, 10_000);
        assertEq(ledger.getFeedbackCount(agent2), 10);
    }

    function testFuzz_PostFeedback_NoOverflow(address from, address to, uint256 score) public {
        vm.assume(from != address(0) && to != address(0));
        vm.assume(from != to);
        score = bound(score, 0, 10_000);

        vm.prank(from);
        ledger.postFeedback(to, score);

        (uint256 dealRate,,,) = ledger.getScoreBreakdown(to);
        assertEq(dealRate, score);
    }

    function testFuzz_BurnReputation_MathematicalCorrectness(
        uint256 initialScore,
        uint256 bps
    ) public {
        initialScore = bound(initialScore, 1, 10_000);
        bps = bound(bps, 0, 10_000);

        vm.prank(agent1);
        ledger.postFeedback(agent2, initialScore);

        vm.prank(lineageLedger);
        ledger.burnReputation(agent2, bps);

        uint256 expected = initialScore - (initialScore * bps / 10_000);
        (uint256 dealRate,,,) = ledger.getScoreBreakdown(agent2);
        assertEq(dealRate, expected);
    }

    // -------------------------------------------------------------------------
    // Feedback History
    // -------------------------------------------------------------------------

    function test_GetFeedback_ValidIndex() public {
        vm.prank(agent1);
        ledger.postFeedback(agent2, 7500);

        ReputationLedger.Feedback memory fb = ledger.getFeedback(0);
        assertEq(fb.from, agent1);
        assertEq(fb.to, agent2);
        assertEq(fb.score, 7500);
        assertEq(fb.timestamp, block.timestamp);
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
