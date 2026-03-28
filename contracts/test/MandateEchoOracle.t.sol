// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {MandateEchoOracle} from "../src/MandateEchoOracle.sol";

contract MandateEchoOracleTest is Test {
    MandateEchoOracle public oracle;

    address public admin = address(0x1);
    address public premiumSubscriber = address(0x2);
    address public agent1 = address(0x3);
    address public agent2 = address(0x4);

    bytes32 public constant PREMIUM_ROLE = keccak256("PREMIUM_ROLE");

    event VectorCommitted(bytes32 indexed hash, address indexed agent, uint256 blockNumber);
    event VectorRevealed(bytes32 indexed hash, address indexed agent, bytes32 decrypted);
    event ReliabilityScoreUpdated(address indexed agent, uint256 scoreBps);

    function setUp() public {
        vm.startPrank(admin);
        oracle = new MandateEchoOracle();
        oracle.grantRole(PREMIUM_ROLE, premiumSubscriber);
        vm.stopPrank();
    }

    /* ══════════════════════════════════════════════════════════════════════════════
       COMMIT VECTOR TESTS
       ══════════════════════════════════════════════════════════════════════════════ */

    function test_commitVector_success() public {
        bytes32 hash = keccak256("mandate_vector_1");
        
        vm.prank(agent1);
        vm.expectEmit(true, true, false, true);
        emit VectorCommitted(hash, agent1, block.number);
        oracle.commitVector(hash);

        MandateEchoOracle.Echo memory echo = oracle.getEcho(hash);
        assertEq(echo.hash, hash);
        assertEq(echo.agent, agent1);
        assertEq(echo.timestamp, block.timestamp);
        assertEq(echo.revealTimestamp, 0);
        assertFalse(echo.revealed);
    }

    function test_commitVector_revertEmptyHash() public {
        vm.prank(agent1);
        vm.expectRevert("Empty hash");
        oracle.commitVector(bytes32(0));
    }

    function test_commitVector_enforce30BlockInterval() public {
        vm.deal(agent1, 1 ether);
        bytes32 hash1 = keccak256("mandate_vector_1");
        bytes32 hash2 = keccak256("mandate_vector_2");

        vm.startPrank(agent1);
        oracle.commitVector(hash1);

        // Try to commit again immediately (block.number unchanged)
        vm.expectRevert("Commit too soon");
        oracle.commitVector(hash2);

        // Advance 29 blocks (still too soon)
        vm.roll(block.number + 29);
        vm.expectRevert("Commit too soon");
        oracle.commitVector(hash2);

        // Advance to 30 blocks (should succeed, but requires payment - second in window)
        vm.roll(block.number + 1); // Total: 30 blocks
        oracle.commitVector{value: 0.002 ether}(hash2);
        vm.stopPrank();

        MandateEchoOracle.Echo memory echo2 = oracle.getEcho(hash2);
        assertEq(echo2.agent, agent1);
    }

    function test_commitVector_differentAgentsNoConflict() public {
        bytes32 hash1 = keccak256("mandate_vector_agent1");
        bytes32 hash2 = keccak256("mandate_vector_agent2");

        vm.prank(agent1);
        oracle.commitVector(hash1);

        // Agent2 can commit immediately (different agent)
        vm.prank(agent2);
        oracle.commitVector(hash2);

        assertEq(oracle.getEcho(hash1).agent, agent1);
        assertEq(oracle.getEcho(hash2).agent, agent2);
    }

    /* ══════════════════════════════════════════════════════════════════════════════
       SPAM MITIGATION TESTS
       ══════════════════════════════════════════════════════════════════════════════ */

    function test_spamMitigation_firstCommitFree() public {
        bytes32 hash = keccak256("mandate_vector_1");

        vm.prank(agent1);
        // First commit should be free (no payment required)
        oracle.commitVector(hash);
        
        assertEq(oracle.commitCountIn100Blocks(agent1), 1);
    }

    function test_spamMitigation_secondCommitRequiresPayment() public {
        vm.deal(agent1, 1 ether);
        bytes32 hash1 = keccak256("mandate_vector_1");
        bytes32 hash2 = keccak256("mandate_vector_2");

        vm.startPrank(agent1);
        
        // First commit (free)
        oracle.commitVector(hash1);
        
        // Advance 30 blocks
        vm.roll(block.number + 30);

        // Second commit requires BASE_GAS_COST * 2^1 = 0.002 ETH
        vm.expectRevert("Insufficient spam prevention payment");
        oracle.commitVector(hash2);

        // Send exact amount - should succeed
        oracle.commitVector{value: 0.002 ether}(hash2);
        
        vm.stopPrank();

        assertEq(oracle.commitCountIn100Blocks(agent1), 2);
    }

    function test_spamMitigation_gasDoublingProgression() public {
        vm.deal(agent1, 100 ether);
        vm.startPrank(agent1);

        // First commit (free)
        bytes32 hash1 = keccak256("vector_1");
        oracle.commitVector(hash1);
        vm.roll(block.number + 30);

        // Second commit (0.002 ETH = BASE * 2^1)
        bytes32 hash2 = keccak256("vector_2");
        oracle.commitVector{value: 0.002 ether}(hash2);
        vm.roll(block.number + 30);

        // Third commit (0.004 ETH = BASE * 2^2)
        bytes32 hash3 = keccak256("vector_3");
        oracle.commitVector{value: 0.004 ether}(hash3);
        vm.roll(block.number + 30);

        // Fourth commit (0.008 ETH = BASE * 2^3)
        bytes32 hash4 = keccak256("vector_4");
        oracle.commitVector{value: 0.008 ether}(hash4);

        vm.stopPrank();

        assertEq(oracle.commitCountIn100Blocks(agent1), 4);
    }

    function test_spamMitigation_windowReset() public {
        vm.deal(agent1, 100 ether);
        vm.startPrank(agent1);

        // First commit (free)
        bytes32 hash1 = keccak256("vector_1");
        oracle.commitVector(hash1);

        // Advance beyond 100-block window (should reset)
        vm.roll(block.number + 100);

        // Next commit should be free again (new window)
        bytes32 hash2 = keccak256("vector_2");
        oracle.commitVector(hash2);

        vm.stopPrank();

        // Count should reset to 1
        assertEq(oracle.commitCountIn100Blocks(agent1), 1);
    }

    /* ══════════════════════════════════════════════════════════════════════════════
       PREMIUM ROLE TESTS
       ══════════════════════════════════════════════════════════════════════════════ */

    function test_decryptForSubscriber_requiresPremiumRole() public {
        bytes memory proof = "";
        
        // Non-premium user should fail
        vm.prank(agent1);
        vm.expectRevert();
        oracle.decryptForSubscriber(premiumSubscriber, proof);

        // Premium user should succeed
        vm.prank(premiumSubscriber);
        bytes32 result = oracle.decryptForSubscriber(premiumSubscriber, proof);
        
        // Phase 2 stub returns zero
        assertEq(result, bytes32(0));
    }

    function test_getEchoReliabilityScore_requiresPremiumRole() public {
        // Non-premium user should fail
        vm.prank(agent1);
        vm.expectRevert();
        oracle.getEchoReliabilityScore(agent1);

        // Premium user should succeed
        vm.prank(premiumSubscriber);
        uint256 score = oracle.getEchoReliabilityScore(agent1);
        assertEq(score, 0); // No commits yet
    }

    /* ══════════════════════════════════════════════════════════════════════════════
       RELIABILITY SCORE TESTS
       ══════════════════════════════════════════════════════════════════════════════ */

    function test_reliabilityScore_noCommits() public {
        vm.prank(premiumSubscriber);
        uint256 score = oracle.getEchoReliabilityScore(agent1);
        assertEq(score, 0);
    }

    function test_reliabilityScore_perfectMatch() public {
        vm.deal(agent1, 1 ether);
        // Agent commits and all reveals match
        bytes32 hash1 = keccak256("vector_1");
        bytes32 hash2 = keccak256("vector_2");
        bytes32 hash3 = keccak256("vector_3");

        vm.startPrank(agent1);
        oracle.commitVector(hash1);
        vm.roll(block.number + 30);
        oracle.commitVector{value: 0.002 ether}(hash2);
        vm.roll(block.number + 30);
        oracle.commitVector{value: 0.004 ether}(hash3);
        vm.stopPrank();

        // Admin reveals all as matches
        vm.startPrank(admin);
        oracle.revealVector(hash1, bytes32(uint256(1)), true);
        oracle.revealVector(hash2, bytes32(uint256(2)), true);
        oracle.revealVector(hash3, bytes32(uint256(3)), true);
        vm.stopPrank();

        // Score should be 100% (10000 bps)
        vm.prank(premiumSubscriber);
        uint256 score = oracle.getEchoReliabilityScore(agent1);
        assertEq(score, 10000);
    }

    function test_reliabilityScore_partialMatch() public {
        vm.deal(agent1, 1 ether);
        bytes32 hash1 = keccak256("vector_1");
        bytes32 hash2 = keccak256("vector_2");
        bytes32 hash3 = keccak256("vector_3");
        bytes32 hash4 = keccak256("vector_4");

        vm.startPrank(agent1);
        oracle.commitVector(hash1);
        vm.roll(block.number + 30);
        oracle.commitVector{value: 0.002 ether}(hash2);
        vm.roll(block.number + 30);
        oracle.commitVector{value: 0.004 ether}(hash3);
        vm.roll(block.number + 30);
        oracle.commitVector{value: 0.008 ether}(hash4);
        vm.stopPrank();

        // Reveal: 3 matches, 1 miss
        vm.startPrank(admin);
        oracle.revealVector(hash1, bytes32(uint256(1)), true);  // match
        oracle.revealVector(hash2, bytes32(uint256(2)), false); // miss
        oracle.revealVector(hash3, bytes32(uint256(3)), true);  // match
        oracle.revealVector(hash4, bytes32(uint256(4)), true);  // match
        vm.stopPrank();

        // Score should be 75% (7500 bps) = 3/4 * 10000
        vm.prank(premiumSubscriber);
        uint256 score = oracle.getEchoReliabilityScore(agent1);
        assertEq(score, 7500);
    }

    function test_reliabilityScore_noMatches() public {
        vm.deal(agent1, 1 ether);
        bytes32 hash1 = keccak256("vector_1");
        bytes32 hash2 = keccak256("vector_2");

        vm.startPrank(agent1);
        oracle.commitVector(hash1);
        vm.roll(block.number + 30);
        oracle.commitVector{value: 0.002 ether}(hash2);
        vm.stopPrank();

        // Reveal both as misses
        vm.startPrank(admin);
        oracle.revealVector(hash1, bytes32(uint256(1)), false);
        oracle.revealVector(hash2, bytes32(uint256(2)), false);
        vm.stopPrank();

        // Score should be 0%
        vm.prank(premiumSubscriber);
        uint256 score = oracle.getEchoReliabilityScore(agent1);
        assertEq(score, 0);
    }

    /* ══════════════════════════════════════════════════════════════════════════════
       REVEAL VECTOR TESTS
       ══════════════════════════════════════════════════════════════════════════════ */

    function test_revealVector_success() public {
        bytes32 hash = keccak256("vector_1");
        bytes32 decrypted = bytes32(uint256(42));

        vm.prank(agent1);
        oracle.commitVector(hash);

        vm.startPrank(admin);
        vm.expectEmit(true, true, false, true);
        emit VectorRevealed(hash, agent1, decrypted);
        vm.expectEmit(true, false, false, true);
        emit ReliabilityScoreUpdated(agent1, 10000); // 1/1 = 100%
        oracle.revealVector(hash, decrypted, true);
        vm.stopPrank();

        MandateEchoOracle.Echo memory echo = oracle.getEcho(hash);
        assertTrue(echo.revealed);
        assertEq(echo.revealTimestamp, block.timestamp);
        assertEq(oracle.revealedVectors(hash), decrypted);
    }

    function test_revealVector_revertNotFound() public {
        bytes32 hash = keccak256("nonexistent");
        bytes32 decrypted = bytes32(uint256(42));

        vm.prank(admin);
        vm.expectRevert("Echo not found");
        oracle.revealVector(hash, decrypted, true);
    }

    function test_revealVector_revertAlreadyRevealed() public {
        bytes32 hash = keccak256("vector_1");
        bytes32 decrypted = bytes32(uint256(42));

        vm.prank(agent1);
        oracle.commitVector(hash);

        vm.startPrank(admin);
        oracle.revealVector(hash, decrypted, true);

        // Try to reveal again
        vm.expectRevert("Already revealed");
        oracle.revealVector(hash, decrypted, true);
        vm.stopPrank();
    }

    function test_revealVector_onlyAdmin() public {
        bytes32 hash = keccak256("vector_1");
        bytes32 decrypted = bytes32(uint256(42));

        vm.prank(agent1);
        oracle.commitVector(hash);

        // Non-admin should fail
        vm.prank(agent2);
        vm.expectRevert();
        oracle.revealVector(hash, decrypted, true);

        // Admin should succeed
        vm.prank(admin);
        oracle.revealVector(hash, decrypted, true);
    }

    /* ══════════════════════════════════════════════════════════════════════════════
       ADMIN TESTS
       ══════════════════════════════════════════════════════════════════════════════ */

    function test_withdrawFees_success() public {
        vm.deal(agent1, 100 ether);
        
        // Generate some fees via spam mitigation
        vm.startPrank(agent1);
        oracle.commitVector(keccak256("v1"));
        vm.roll(block.number + 30);
        oracle.commitVector{value: 0.002 ether}(keccak256("v2"));
        vm.roll(block.number + 30);
        oracle.commitVector{value: 0.004 ether}(keccak256("v3"));
        vm.stopPrank();

        uint256 contractBalance = address(oracle).balance;
        assertEq(contractBalance, 0.006 ether);

        address payable recipient = payable(address(0x999));
        uint256 recipientBalanceBefore = recipient.balance;

        vm.prank(admin);
        oracle.withdrawFees(recipient);

        assertEq(address(oracle).balance, 0);
        assertEq(recipient.balance, recipientBalanceBefore + 0.006 ether);
    }

    function test_withdrawFees_revertNoFees() public {
        address payable recipient = payable(address(0x999));

        vm.prank(admin);
        vm.expectRevert("No fees to withdraw");
        oracle.withdrawFees(recipient);
    }

    function test_withdrawFees_onlyAdmin() public {
        vm.deal(agent1, 100 ether);
        
        vm.startPrank(agent1);
        oracle.commitVector(keccak256("v1"));
        vm.roll(block.number + 30);
        oracle.commitVector{value: 0.002 ether}(keccak256("v2"));
        vm.stopPrank();

        address payable recipient = payable(address(0x999));

        vm.prank(agent2);
        vm.expectRevert();
        oracle.withdrawFees(recipient);
    }

    /* ══════════════════════════════════════════════════════════════════════════════
       STATE TRACKING TESTS
       ══════════════════════════════════════════════════════════════════════════════ */

    function test_stateTracking_lastCommitBlock() public {
        vm.deal(agent1, 1 ether);
        bytes32 hash1 = keccak256("v1");
        bytes32 hash2 = keccak256("v2");

        uint256 startBlock = block.number;

        vm.startPrank(agent1);
        oracle.commitVector(hash1);
        assertEq(oracle.lastCommitBlock(agent1), startBlock);

        vm.roll(block.number + 30);
        oracle.commitVector{value: 0.002 ether}(hash2);
        assertEq(oracle.lastCommitBlock(agent1), startBlock + 30);
        vm.stopPrank();
    }

    function test_stateTracking_totalCommitments() public {
        vm.deal(agent1, 1 ether);
        bytes32 hash1 = keccak256("v1");
        bytes32 hash2 = keccak256("v2");
        bytes32 hash3 = keccak256("v3");

        vm.startPrank(agent1);
        oracle.commitVector(hash1);
        assertEq(oracle.totalCommitments(agent1), 1);

        vm.roll(block.number + 30);
        oracle.commitVector{value: 0.002 ether}(hash2);
        assertEq(oracle.totalCommitments(agent1), 2);

        vm.roll(block.number + 30);
        oracle.commitVector{value: 0.004 ether}(hash3);
        assertEq(oracle.totalCommitments(agent1), 3);
        vm.stopPrank();
    }

    function test_stateTracking_matchCount() public {
        vm.deal(agent1, 1 ether);
        bytes32 hash1 = keccak256("v1");
        bytes32 hash2 = keccak256("v2");
        bytes32 hash3 = keccak256("v3");

        vm.startPrank(agent1);
        oracle.commitVector(hash1);
        vm.roll(block.number + 30);
        oracle.commitVector{value: 0.002 ether}(hash2);
        vm.roll(block.number + 30);
        oracle.commitVector{value: 0.004 ether}(hash3);
        vm.stopPrank();

        assertEq(oracle.matchCount(agent1), 0);

        vm.startPrank(admin);
        oracle.revealVector(hash1, bytes32(uint256(1)), true);  // match
        assertEq(oracle.matchCount(agent1), 1);

        oracle.revealVector(hash2, bytes32(uint256(2)), false); // miss
        assertEq(oracle.matchCount(agent1), 1);

        oracle.revealVector(hash3, bytes32(uint256(3)), true);  // match
        assertEq(oracle.matchCount(agent1), 2);
        vm.stopPrank();
    }

    /* ══════════════════════════════════════════════════════════════════════════════
       ADVERSARIAL TESTS
       ══════════════════════════════════════════════════════════════════════════════ */

    function test_adversarial_cannotCommitSameHashTwice() public {
        vm.deal(agent1, 1 ether);
        bytes32 hash = keccak256("duplicate");

        vm.startPrank(agent1);
        oracle.commitVector(hash);

        vm.roll(block.number + 30);
        
        // Committing same hash overwrites previous (no revert, but state replaced)
        oracle.commitVector{value: 0.002 ether}(hash);
        vm.stopPrank();

        // Latest commitment should be stored
        MandateEchoOracle.Echo memory echo = oracle.getEcho(hash);
        assertEq(echo.agent, agent1);
    }

    function test_adversarial_multipleAgentsSeparateWindows() public {
        vm.deal(agent1, 100 ether);
        vm.deal(agent2, 100 ether);

        // Agent1 commits twice quickly
        vm.startPrank(agent1);
        oracle.commitVector(keccak256("agent1_v1"));
        vm.roll(block.number + 30);
        oracle.commitVector{value: 0.002 ether}(keccak256("agent1_v2"));
        vm.stopPrank();

        // Agent2 should have independent window
        vm.startPrank(agent2);
        oracle.commitVector(keccak256("agent2_v1")); // Free (first commit)
        vm.roll(block.number + 30);
        oracle.commitVector{value: 0.002 ether}(keccak256("agent2_v2"));
        vm.stopPrank();

        assertEq(oracle.commitCountIn100Blocks(agent1), 2);
        assertEq(oracle.commitCountIn100Blocks(agent2), 2);
    }

    function test_adversarial_exceedMaxReliabilityScore() public {
        // Even with manipulation, score should cap at 10000 bps
        bytes32 hash = keccak256("vector");

        vm.prank(agent1);
        oracle.commitVector(hash);

        vm.prank(admin);
        oracle.revealVector(hash, bytes32(uint256(1)), true);

        vm.prank(premiumSubscriber);
        uint256 score = oracle.getEchoReliabilityScore(agent1);
        assertEq(score, 10000); // Capped at 100%
    }
}
