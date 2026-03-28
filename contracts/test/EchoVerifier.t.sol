// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../src/EchoVerifier.sol";
import "../src/MandateEchoOracle.sol";
import "../src/RateToken.sol";
import "../src/AgentRegistry.sol";
import "../src/ReputationLedger.sol";
import "../src/AuditLog.sol";
import "../src/InformationMarket.sol";

contract EchoVerifierTest is Test {
    EchoVerifier public verifier;
    MandateEchoOracle public oracle;
    RateToken public rateToken;
    AgentRegistry public agentRegistry;
    ReputationLedger public reputationLedger;
    AuditLog public auditLog;
    InformationMarket public infoMarket;

    address public admin = address(1);
    address public publisher = address(2);
    address public challenger = address(3);
    address public unauthorized = address(4);

    uint256 public publisherAgentId;
    uint256 public challengerAgentId;

    uint256 constant INITIAL_RATE = 1_000_000 * 1e18;
    uint8 constant ACTION_ECHO_VERIFY = 13;
    uint8 constant ACTION_ECHO_CHALLENGE = 14;

    event EchoSelfVerified(bytes32 indexed commitmentHash, address indexed publisher, bytes32 echoHash, uint256 timestamp);
    event EchoChallenged(bytes32 indexed commitmentHash, address indexed publisher, address indexed challenger, uint256 timestamp);
    event ChallengeResolved(bytes32 indexed commitmentHash, address indexed publisher, address indexed challenger, bool isValid, uint256 timestamp);
    event EscrowDeposited(bytes32 indexed commitmentHash, address indexed publisher, uint256 amount);

    function setUp() public {
        rateToken = new RateToken(admin);
        agentRegistry = new AgentRegistry(admin);
        reputationLedger = new ReputationLedger(admin);
        auditLog = new AuditLog(admin);
        infoMarket = new InformationMarket(address(rateToken), admin);

        oracle = new MandateEchoOracle();
        verifier = new EchoVerifier(
            address(agentRegistry), address(oracle), address(reputationLedger),
            address(auditLog), address(infoMarket), address(rateToken), admin
        );

        vm.startPrank(admin);
        reputationLedger.grantRole(reputationLedger.RECORDER_ROLE(), address(verifier));
        reputationLedger.grantRole(reputationLedger.BURNER_ROLE(), address(verifier));
        auditLog.grantRole(auditLog.LOGGER_ROLE(), address(verifier));

        publisherAgentId = agentRegistry.registerAgent(publisher, "ipfs://publisher");
        challengerAgentId = agentRegistry.registerAgent(challenger, "ipfs://challenger");
        agentRegistry.grantAction(publisherAgentId, ACTION_ECHO_VERIFY);
        agentRegistry.grantAction(challengerAgentId, ACTION_ECHO_CHALLENGE);

        rateToken.mint(publisher, INITIAL_RATE);
        rateToken.mint(challenger, INITIAL_RATE);

        reputationLedger.grantRole(reputationLedger.RECORDER_ROLE(), admin);
        reputationLedger.recordTransactionByAddress(publisher, challenger, 1000 * 1e18);
        vm.stopPrank();

        vm.prank(publisher);
        rateToken.approve(address(verifier), type(uint256).max);
        vm.prank(challenger);
        rateToken.approve(address(verifier), type(uint256).max);
        vm.prank(challenger);
        rateToken.approve(address(infoMarket), type(uint256).max);
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    function _makeCommitment(bytes32 echoHash, uint256 nonce) internal pure returns (bytes32) {
        return keccak256(abi.encode(echoHash, nonce));
    }

    function _commitEcho(bytes32 echoHash, uint256 nonce) internal returns (bytes32 commitmentHash) {
        commitmentHash = _makeCommitment(echoHash, nonce);
        vm.prank(publisher);
        oracle.commitVector(commitmentHash);
    }

    /// @dev Commit + fund escrow + attest trade match (full happy path setup)
    function _commitAndPrepare(bytes32 echoHash, uint256 nonce) internal returns (bytes32 commitmentHash) {
        commitmentHash = _commitEcho(echoHash, nonce);
        // Fund escrow
        vm.prank(publisher);
        verifier.fundEscrow(commitmentHash);
        // Operator attests trade match
        vm.prank(admin);
        verifier.attestTradeMatch(commitmentHash);
    }

    function _subscribeChallengerPremium() internal {
        vm.prank(challenger);
        infoMarket.subscribe(2);
    }

    // =========================================================================
    // Deployment Tests
    // =========================================================================

    function test_deployment() public view {
        assertEq(address(verifier.agentRegistry()), address(agentRegistry));
        assertEq(address(verifier.echoOracle()), address(oracle));
        assertEq(verifier.VERIFICATION_WINDOW(), 86_400);
        assertEq(verifier.CHALLENGE_BOUNTY(), 500 * 1e18);
        assertEq(verifier.MAX_SELF_VERIFIES_PER_EPOCH(), 5);
    }

    function test_deployment_reverts_zero_addresses() public {
        vm.expectRevert(EchoVerifier.ZeroAddress.selector);
        new EchoVerifier(address(0), address(oracle), address(reputationLedger),
            address(auditLog), address(infoMarket), address(rateToken), admin);
    }

    // =========================================================================
    // [FIX #1] Escrow Tests
    // =========================================================================

    function test_fund_escrow_success() public {
        bytes32 commitHash = _commitEcho(keccak256("echo"), 42);

        uint256 balBefore = rateToken.balanceOf(publisher);
        vm.prank(publisher);
        verifier.fundEscrow(commitHash);

        assertEq(verifier.publisherEscrow(commitHash), 500 * 1e18);
        assertEq(rateToken.balanceOf(publisher), balBefore - 500 * 1e18);
    }

    function test_revert_fund_escrow_not_publisher() public {
        bytes32 commitHash = _commitEcho(keccak256("echo"), 42);

        vm.prank(challenger);
        vm.expectRevert(
            abi.encodeWithSelector(EchoVerifier.NotPublisher.selector, challenger, publisher)
        );
        verifier.fundEscrow(commitHash);
    }

    function test_revert_fund_escrow_already_funded() public {
        bytes32 commitHash = _commitEcho(keccak256("echo"), 42);
        vm.prank(publisher);
        verifier.fundEscrow(commitHash);

        vm.prank(publisher);
        vm.expectRevert(
            abi.encodeWithSelector(EchoVerifier.EscrowAlreadyFunded.selector, commitHash)
        );
        verifier.fundEscrow(commitHash);
    }

    function test_revert_self_verify_without_escrow() public {
        bytes32 echoHash = keccak256("echo");
        uint256 nonce = 42;
        bytes32 commitHash = _commitEcho(echoHash, nonce);

        // Attest trade but don't fund escrow
        vm.prank(admin);
        verifier.attestTradeMatch(commitHash);

        vm.prank(publisher);
        vm.expectRevert(
            abi.encodeWithSelector(EchoVerifier.EscrowNotFunded.selector, commitHash)
        );
        verifier.selfVerify(commitHash, echoHash, nonce);
    }

    function test_challenge_requires_escrow() public {
        bytes32 commitHash = _commitEcho(keccak256("echo"), 42);
        // Don't fund escrow
        vm.warp(block.timestamp + 86_401);
        _subscribeChallengerPremium();

        vm.prank(challenger);
        vm.expectRevert(
            abi.encodeWithSelector(EchoVerifier.EscrowNotFunded.selector, commitHash)
        );
        verifier.challengeEcho(commitHash);
    }

    function test_valid_challenge_transfers_escrow_to_challenger() public {
        bytes32 echoHash = keccak256("echo");
        bytes32 commitHash = _commitEcho(echoHash, 42);
        vm.prank(publisher);
        verifier.fundEscrow(commitHash);

        vm.warp(block.timestamp + 86_401);
        _subscribeChallengerPremium();

        vm.prank(challenger);
        verifier.challengeEcho(commitHash);

        uint256 challengerBefore = rateToken.balanceOf(challenger);

        vm.prank(admin);
        verifier.resolveChallenge(commitHash, true);

        // Challenger receives: 500 RATE escrow + 200 RATE stake refund
        assertEq(rateToken.balanceOf(challenger), challengerBefore + 500 * 1e18 + 200 * 1e18);
        // Escrow cleared
        assertEq(verifier.publisherEscrow(commitHash), 0);
    }

    function test_self_verify_refunds_escrow() public {
        bytes32 echoHash = keccak256("echo");
        uint256 nonce = 42;
        bytes32 commitHash = _commitAndPrepare(echoHash, nonce);

        uint256 balBefore = rateToken.balanceOf(publisher);
        vm.prank(publisher);
        verifier.selfVerify(commitHash, echoHash, nonce);

        // Escrow refunded
        assertEq(rateToken.balanceOf(publisher), balBefore + 500 * 1e18);
        assertEq(verifier.publisherEscrow(commitHash), 0);
    }

    // =========================================================================
    // [FIX #2] Trade Attestation Tests
    // =========================================================================

    function test_revert_self_verify_without_attestation() public {
        bytes32 echoHash = keccak256("echo");
        uint256 nonce = 42;
        bytes32 commitHash = _commitEcho(echoHash, nonce);

        // Fund escrow but don't attest
        vm.prank(publisher);
        verifier.fundEscrow(commitHash);

        vm.prank(publisher);
        vm.expectRevert(
            abi.encodeWithSelector(EchoVerifier.TradeNotAttested.selector, commitHash)
        );
        verifier.selfVerify(commitHash, echoHash, nonce);
    }

    function test_self_verify_with_attestation_succeeds() public {
        bytes32 echoHash = keccak256("echo");
        uint256 nonce = 42;
        bytes32 commitHash = _commitAndPrepare(echoHash, nonce);

        vm.prank(publisher);
        verifier.selfVerify(commitHash, echoHash, nonce);

        assertEq(uint8(verifier.verificationStatus(commitHash)), uint8(EchoVerifier.VerificationStatus.SELF_VERIFIED));
    }

    function test_only_operator_can_attest() public {
        bytes32 commitHash = _commitEcho(keccak256("echo"), 42);

        vm.prank(unauthorized);
        vm.expectRevert();
        verifier.attestTradeMatch(commitHash);
    }

    // =========================================================================
    // [FIX #5] Epoch Cap Tests
    // =========================================================================

    function test_self_verify_cap_per_epoch() public {
        // Verify 5 times (max)
        for (uint256 i = 0; i < 5; i++) {
            // Advance 101 blocks to clear both 30-block interval AND 100-block spam window
            if (i > 0) vm.roll(block.number + 101);

            bytes32 echoHash = keccak256(abi.encode("echo", i));
            uint256 nonce = i;
            bytes32 commitHash = _commitAndPrepare(echoHash, nonce);

            vm.prank(publisher);
            verifier.selfVerify(commitHash, echoHash, nonce);
        }

        // 6th should revert
        vm.roll(block.number + 101);
        bytes32 echoHash6 = keccak256(abi.encode("echo", uint256(5)));
        bytes32 commitHash6 = _commitAndPrepare(echoHash6, 5);

        vm.prank(publisher);
        vm.expectRevert(
            abi.encodeWithSelector(EchoVerifier.SelfVerifyEpochCapReached.selector, publisher, 5)
        );
        verifier.selfVerify(commitHash6, echoHash6, 5);
    }

    // =========================================================================
    // Self-Verification Tests (existing, updated for escrow+attestation)
    // =========================================================================

    function test_self_verify_success() public {
        bytes32 echoHash = keccak256("test_echo");
        uint256 nonce = 42;
        bytes32 commitHash = _commitAndPrepare(echoHash, nonce);

        vm.prank(publisher);
        verifier.selfVerify(commitHash, echoHash, nonce);

        assertEq(uint8(verifier.verificationStatus(commitHash)), uint8(EchoVerifier.VerificationStatus.SELF_VERIFIED));
        assertEq(verifier.revealedEchoHashes(commitHash), echoHash);
        assertEq(verifier.totalSelfVerifications(), 1);
    }

    function test_revert_self_verify_expired() public {
        bytes32 echoHash = keccak256("echo");
        uint256 nonce = 1;
        bytes32 commitHash = _commitAndPrepare(echoHash, nonce);

        vm.warp(block.timestamp + 86_401);

        vm.prank(publisher);
        vm.expectRevert();
        verifier.selfVerify(commitHash, echoHash, nonce);
    }

    function test_revert_self_verify_wrong_hash() public {
        bytes32 echoHash = keccak256("echo");
        uint256 nonce = 42;
        bytes32 commitHash = _commitAndPrepare(echoHash, nonce);

        vm.prank(publisher);
        vm.expectRevert();
        verifier.selfVerify(commitHash, keccak256("wrong"), nonce);
    }

    function test_revert_self_verify_not_publisher() public {
        bytes32 echoHash = keccak256("echo");
        uint256 nonce = 42;
        bytes32 commitHash = _commitAndPrepare(echoHash, nonce);

        vm.prank(challenger);
        vm.expectRevert(
            abi.encodeWithSelector(EchoVerifier.NotPublisher.selector, challenger, publisher)
        );
        verifier.selfVerify(commitHash, echoHash, nonce);
    }

    function test_revert_self_verify_already_verified() public {
        bytes32 echoHash = keccak256("echo");
        uint256 nonce = 42;
        bytes32 commitHash = _commitAndPrepare(echoHash, nonce);

        vm.prank(publisher);
        verifier.selfVerify(commitHash, echoHash, nonce);

        vm.prank(publisher);
        vm.expectRevert();
        verifier.selfVerify(commitHash, echoHash, nonce);
    }

    // =========================================================================
    // Challenge Tests (updated for escrow)
    // =========================================================================

    function test_challenge_success() public {
        bytes32 commitHash = _commitEcho(keccak256("echo"), 42);
        vm.prank(publisher);
        verifier.fundEscrow(commitHash);

        vm.warp(block.timestamp + 86_401);
        _subscribeChallengerPremium();

        vm.prank(challenger);
        verifier.challengeEcho(commitHash);

        assertEq(uint8(verifier.verificationStatus(commitHash)), uint8(EchoVerifier.VerificationStatus.CHALLENGED));
        assertEq(verifier.challengers(commitHash), challenger);
    }

    function test_revert_challenge_within_window() public {
        bytes32 commitHash = _commitEcho(keccak256("echo"), 42);
        vm.prank(publisher);
        verifier.fundEscrow(commitHash);

        _subscribeChallengerPremium();

        vm.prank(challenger);
        vm.expectRevert();
        verifier.challengeEcho(commitHash);
    }

    function test_revert_challenge_already_verified() public {
        bytes32 echoHash = keccak256("echo");
        uint256 nonce = 42;
        bytes32 commitHash = _commitAndPrepare(echoHash, nonce);

        vm.prank(publisher);
        verifier.selfVerify(commitHash, echoHash, nonce);

        vm.warp(block.timestamp + 86_401);
        _subscribeChallengerPremium();

        vm.prank(challenger);
        vm.expectRevert();
        verifier.challengeEcho(commitHash);
    }

    function test_revert_challenge_no_premium() public {
        bytes32 commitHash = _commitEcho(keccak256("echo"), 42);
        vm.prank(publisher);
        verifier.fundEscrow(commitHash);

        vm.warp(block.timestamp + 86_401);

        vm.prank(challenger);
        vm.expectRevert();
        verifier.challengeEcho(commitHash);
    }

    // =========================================================================
    // Resolution Tests (updated for escrow)
    // =========================================================================

    function test_resolve_valid_challenge() public {
        bytes32 commitHash = _commitEcho(keccak256("echo"), 42);
        vm.prank(publisher);
        verifier.fundEscrow(commitHash);

        vm.warp(block.timestamp + 86_401);
        _subscribeChallengerPremium();

        vm.prank(challenger);
        verifier.challengeEcho(commitHash);

        uint256 challengerBefore = rateToken.balanceOf(challenger);

        vm.prank(admin);
        verifier.resolveChallenge(commitHash, true);

        assertEq(uint8(verifier.verificationStatus(commitHash)), uint8(EchoVerifier.VerificationStatus.CHALLENGE_VALID));
        // Challenger gets 500 escrow + 200 stake refund
        assertEq(rateToken.balanceOf(challenger), challengerBefore + 700 * 1e18);
    }

    function test_resolve_invalid_challenge() public {
        bytes32 commitHash = _commitEcho(keccak256("echo"), 42);
        vm.prank(publisher);
        verifier.fundEscrow(commitHash);

        vm.warp(block.timestamp + 86_401);
        _subscribeChallengerPremium();

        vm.prank(challenger);
        verifier.challengeEcho(commitHash);

        vm.prank(admin);
        verifier.resolveChallenge(commitHash, false);

        assertEq(uint8(verifier.verificationStatus(commitHash)), uint8(EchoVerifier.VerificationStatus.CHALLENGE_INVALID));
    }

    function test_revert_resolve_not_challenged() public {
        vm.prank(admin);
        vm.expectRevert();
        verifier.resolveChallenge(keccak256("x"), true);
    }

    // =========================================================================
    // View Function Tests
    // =========================================================================

    function test_verification_deadline() public {
        bytes32 commitHash = _commitEcho(keccak256("echo"), 42);
        uint256 deadline = verifier.getVerificationDeadline(commitHash);
        assertEq(deadline, block.timestamp + 86_400);
    }

    function test_is_in_verification_window() public {
        bytes32 commitHash = _commitEcho(keccak256("echo"), 42);
        assertTrue(verifier.isInVerificationWindow(commitHash));

        vm.warp(block.timestamp + 86_401);
        assertFalse(verifier.isInVerificationWindow(commitHash));
    }

    // =========================================================================
    // Full Lifecycle Tests
    // =========================================================================

    function test_full_lifecycle_self_verify() public {
        bytes32 echoHash = keccak256("honest_echo");
        uint256 nonce = 100;
        bytes32 commitHash = _commitAndPrepare(echoHash, nonce);

        vm.warp(block.timestamp + 3600);
        vm.prank(publisher);
        verifier.selfVerify(commitHash, echoHash, nonce);

        assertEq(uint8(verifier.verificationStatus(commitHash)), uint8(EchoVerifier.VerificationStatus.SELF_VERIFIED));

        vm.warp(block.timestamp + 86_400);
        _subscribeChallengerPremium();

        vm.prank(challenger);
        vm.expectRevert();
        verifier.challengeEcho(commitHash);
    }

    function test_full_lifecycle_valid_challenge() public {
        bytes32 commitHash = _commitEcho(keccak256("dishonest_echo"), 200);
        vm.prank(publisher);
        verifier.fundEscrow(commitHash);

        vm.warp(block.timestamp + 86_401);
        _subscribeChallengerPremium();

        vm.prank(challenger);
        verifier.challengeEcho(commitHash);

        vm.prank(admin);
        verifier.resolveChallenge(commitHash, true);

        assertEq(uint8(verifier.verificationStatus(commitHash)), uint8(EchoVerifier.VerificationStatus.CHALLENGE_VALID));
    }

    // =========================================================================
    // Fuzz Tests
    // =========================================================================

    function testFuzz_commitment_verification(bytes32 echoHash, uint256 nonce) public {
        vm.assume(echoHash != bytes32(0));
        bytes32 commitHash = _makeCommitment(echoHash, nonce);
        vm.assume(commitHash != bytes32(0));

        vm.prank(publisher);
        oracle.commitVector(commitHash);

        // Fund escrow
        vm.prank(publisher);
        verifier.fundEscrow(commitHash);

        // Attest
        vm.prank(admin);
        verifier.attestTradeMatch(commitHash);

        vm.prank(publisher);
        verifier.selfVerify(commitHash, echoHash, nonce);

        assertEq(uint8(verifier.verificationStatus(commitHash)), uint8(EchoVerifier.VerificationStatus.SELF_VERIFIED));
    }
}
