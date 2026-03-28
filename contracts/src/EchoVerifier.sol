// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

interface IAgentRegistry {
    function validateAction(address agent, uint8 actionType) external view returns (bool);
    function agentIdOf(address agent) external view returns (uint256);
}

interface IMandateEchoOracle {
    struct Echo {
        bytes32 hash;
        address agent;
        uint64 timestamp;
        uint64 revealTimestamp;
        bool revealed;
    }

    function echos(bytes32 hash) external view returns (
        bytes32 echoHash, address agent, uint64 timestamp, uint64 revealTimestamp, bool revealed
    );
    function matchCount(address agent) external view returns (uint256);
    function totalCommitments(address agent) external view returns (uint256);
}

interface IReputationLedger {
    enum Signal { DEAL_RATE, DISINFO, ANOMALY }
    function burnReputation(address agent, uint256 bps, Signal signal) external;
    function recordTransactionByAddress(address buyer, address seller, uint256 amount) external;
}

interface IAuditLog {
    function logAction(uint256 agentId, bytes32 action, bytes calldata metadata) external;
}

interface IInformationMarket {
    function getTierAccess(address user) external view returns (uint8);
}

/// @title EchoVerifier — Self-verification and challenger mechanism for MandateEchoOracle
/// @notice Phase 4 spec §16 (Phase 3 Tokenomics). Publishers self-verify echoes within 24 hours
///         for a +200 bps deal completion bonus. After 24 hours, premium-tier challengers can
///         prove mismatches for a 500 RATE bounty. Creates the "auditor" player archetype.
/// @dev Reads commitments from MandateEchoOracle. All time logic uses block.timestamp.
///      CEI pattern enforced. SafeERC20 for all RATE transfers.
///      [FIX #1] Publisher escrow on commitment. [FIX #2] Trade attestation required.
///      [FIX #4] Typed burn calls. [FIX #5] Per-epoch self-verify cap.
contract EchoVerifier is ReentrancyGuard, AccessControl {
    using SafeERC20 for IERC20;

    // -------------------------------------------------------------------------
    // Roles
    // -------------------------------------------------------------------------

    /// @notice OPERATOR_ROLE: Can resolve challenges and attest trade matches.
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    // -------------------------------------------------------------------------
    // Action type constants (bitmap positions)
    // -------------------------------------------------------------------------

    uint8 public constant ACTION_ECHO_VERIFY = 13;
    uint8 public constant ACTION_ECHO_CHALLENGE = 14;

    // -------------------------------------------------------------------------
    // AuditLog action type constants
    // -------------------------------------------------------------------------

    bytes32 public constant ECHO_SELF_VERIFIED = keccak256("ECHO_SELF_VERIFIED");
    bytes32 public constant ECHO_CHALLENGED = keccak256("ECHO_CHALLENGED");
    bytes32 public constant CHALLENGE_RESOLVED = keccak256("CHALLENGE_RESOLVED");
    bytes32 public constant ECHO_ESCROWED = keccak256("ECHO_ESCROWED");

    // -------------------------------------------------------------------------
    // Parameters (from Phase 3 Tokenomics v2 §16)
    // -------------------------------------------------------------------------

    uint256 public constant VERIFICATION_WINDOW = 86_400;
    uint256 public constant SELF_VERIFY_BONUS_BPS = 200;
    uint256 public constant CHALLENGE_PENALTY_BPS = 500;
    uint256 public constant CHALLENGE_BOUNTY = 500 * 1e18;
    uint256 public constant INVALID_CHALLENGE_COST = 200 * 1e18;
    uint8 public constant MIN_CHALLENGER_TIER = 2;

    /// @notice [FIX #5] Maximum self-verifications per agent per epoch.
    uint256 public constant MAX_SELF_VERIFIES_PER_EPOCH = 5;

    // -------------------------------------------------------------------------
    // Verification status enum
    // -------------------------------------------------------------------------

    enum VerificationStatus {
        UNVERIFIED,
        SELF_VERIFIED,
        CHALLENGED,
        CHALLENGE_VALID,
        CHALLENGE_INVALID
    }

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    IAgentRegistry public immutable agentRegistry;
    IMandateEchoOracle public immutable echoOracle;
    IReputationLedger public immutable reputationLedger;
    IAuditLog public immutable auditLog;
    IInformationMarket public immutable informationMarket;
    IERC20 public immutable rateToken;

    mapping(bytes32 => VerificationStatus) public verificationStatus;
    mapping(bytes32 => bytes32) public revealedEchoHashes;
    mapping(bytes32 => uint256) public revealedNonces;
    mapping(bytes32 => address) public challengers;

    /// @notice [FIX #1] Publisher escrow per commitment hash.
    mapping(bytes32 => uint256) public publisherEscrow;

    /// @notice [FIX #2] Operator attestation that publisher's trades matched echo.
    mapping(bytes32 => bool) public tradeAttested;

    /// @notice [FIX #5] Self-verify count per agent per epoch.
    mapping(address => uint256) public selfVerifyCount;

    /// @notice [FIX #5] Last known epoch for self-verify counter reset.
    mapping(address => uint256) public selfVerifyEpoch;

    uint256 public totalSelfVerifications;
    uint256 public totalValidChallenges;
    uint256 public totalInvalidChallenges;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event EchoSelfVerified(bytes32 indexed commitmentHash, address indexed publisher, bytes32 echoHash, uint256 timestamp);
    event EchoChallenged(bytes32 indexed commitmentHash, address indexed publisher, address indexed challenger, uint256 timestamp);
    event ChallengeResolved(bytes32 indexed commitmentHash, address indexed publisher, address indexed challenger, bool isValid, uint256 timestamp);
    event EscrowDeposited(bytes32 indexed commitmentHash, address indexed publisher, uint256 amount);
    event EscrowRefunded(bytes32 indexed commitmentHash, address indexed publisher, uint256 amount);
    event TradeAttested(bytes32 indexed commitmentHash);

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error ZeroAddress();
    error EchoNotFound(bytes32 commitmentHash);
    error NotPublisher(address caller, address publisher);
    error AlreadyVerified(bytes32 commitmentHash);
    error VerificationWindowExpired(bytes32 commitmentHash, uint256 deadline);
    error VerificationWindowActive(bytes32 commitmentHash, uint256 deadline);
    error CommitmentMismatch(bytes32 expected, bytes32 computed);
    error AlreadyChallenged(bytes32 commitmentHash);
    error NotChallenged(bytes32 commitmentHash);
    error InsufficientTier(uint8 required, uint8 actual);
    error CannotChallengeSelf();
    error CannotChallengeVerified(bytes32 commitmentHash);
    error EscrowNotFunded(bytes32 commitmentHash);
    error EscrowAlreadyFunded(bytes32 commitmentHash);
    error TradeNotAttested(bytes32 commitmentHash);
    error SelfVerifyEpochCapReached(address agent, uint256 maxPerEpoch);

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(
        address _agentRegistry,
        address _echoOracle,
        address _reputationLedger,
        address _auditLog,
        address _informationMarket,
        address _rateToken,
        address admin
    ) {
        if (_agentRegistry == address(0)) revert ZeroAddress();
        if (_echoOracle == address(0)) revert ZeroAddress();
        if (_reputationLedger == address(0)) revert ZeroAddress();
        if (_auditLog == address(0)) revert ZeroAddress();
        if (_informationMarket == address(0)) revert ZeroAddress();
        if (_rateToken == address(0)) revert ZeroAddress();
        if (admin == address(0)) revert ZeroAddress();

        agentRegistry = IAgentRegistry(_agentRegistry);
        echoOracle = IMandateEchoOracle(_echoOracle);
        reputationLedger = IReputationLedger(_reputationLedger);
        auditLog = IAuditLog(_auditLog);
        informationMarket = IInformationMarket(_informationMarket);
        rateToken = IERC20(_rateToken);

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);
    }

    // -------------------------------------------------------------------------
    // [FIX #1] Publisher Escrow
    // -------------------------------------------------------------------------

    /// @notice Publisher funds their bounty escrow for a commitment.
    /// @dev Must be called after committing to MandateEchoOracle. Locks CHALLENGE_BOUNTY RATE.
    ///      Escrow is refunded on successful self-verification, or transferred to challenger
    ///      on valid challenge resolution.
    /// @param commitmentHash The commitment hash from MandateEchoOracle.
    function fundEscrow(bytes32 commitmentHash) external nonReentrant {
        (, address publisher,,,) = echoOracle.echos(commitmentHash);
        if (publisher == address(0)) revert EchoNotFound(commitmentHash);
        if (msg.sender != publisher) revert NotPublisher(msg.sender, publisher);
        if (publisherEscrow[commitmentHash] > 0) revert EscrowAlreadyFunded(commitmentHash);

        // --- EFFECTS ---
        publisherEscrow[commitmentHash] = CHALLENGE_BOUNTY;

        // --- INTERACTIONS ---
        rateToken.safeTransferFrom(msg.sender, address(this), CHALLENGE_BOUNTY);

        emit EscrowDeposited(commitmentHash, publisher, CHALLENGE_BOUNTY);
    }

    // -------------------------------------------------------------------------
    // [FIX #2] Trade Attestation
    // -------------------------------------------------------------------------

    /// @notice Operator attests that a publisher's post-event trades match their echo commitment.
    /// @dev Called after the operator reads AuditLog events off-chain and compares actual trades
    ///      in the 60-second post-event window against the revealed echo.
    /// @param commitmentHash The commitment hash to attest.
    function attestTradeMatch(bytes32 commitmentHash) external onlyRole(OPERATOR_ROLE) {
        tradeAttested[commitmentHash] = true;
        emit TradeAttested(commitmentHash);
    }

    // -------------------------------------------------------------------------
    // Self-Verification
    // -------------------------------------------------------------------------

    /// @notice Publisher reveals their echo commitment within the 24-hour window.
    /// @dev [FIX #1] Requires funded escrow. [FIX #2] Requires trade attestation.
    ///      [FIX #5] Capped at MAX_SELF_VERIFIES_PER_EPOCH per agent.
    function selfVerify(
        bytes32 commitmentHash,
        bytes32 echoHash,
        uint256 nonce
    ) external nonReentrant {
        // --- CHECKS ---
        (, address publisher, uint64 commitTimestamp,,) =
            echoOracle.echos(commitmentHash);
        if (publisher == address(0)) revert EchoNotFound(commitmentHash);
        if (msg.sender != publisher) revert NotPublisher(msg.sender, publisher);

        if (verificationStatus[commitmentHash] != VerificationStatus.UNVERIFIED) {
            revert AlreadyVerified(commitmentHash);
        }

        uint256 deadline = uint256(commitTimestamp) + VERIFICATION_WINDOW;
        if (block.timestamp > deadline) {
            revert VerificationWindowExpired(commitmentHash, deadline);
        }

        // [FIX #9] Wrap validateAction with require for defensive coding
        require(agentRegistry.validateAction(msg.sender, ACTION_ECHO_VERIFY), "Action not permitted");

        bytes32 computed = keccak256(abi.encode(echoHash, nonce));
        if (computed != commitmentHash) {
            revert CommitmentMismatch(commitmentHash, computed);
        }

        // [FIX #1] Escrow must be funded
        if (publisherEscrow[commitmentHash] == 0) revert EscrowNotFunded(commitmentHash);

        // [FIX #2] Trade attestation required before bonus
        if (!tradeAttested[commitmentHash]) revert TradeNotAttested(commitmentHash);

        // [FIX #5] Per-epoch self-verify cap
        uint256 currentEpoch = block.timestamp / 28 days; // Simple epoch derivation
        if (selfVerifyEpoch[msg.sender] != currentEpoch) {
            selfVerifyEpoch[msg.sender] = currentEpoch;
            selfVerifyCount[msg.sender] = 0;
        }
        if (selfVerifyCount[msg.sender] >= MAX_SELF_VERIFIES_PER_EPOCH) {
            revert SelfVerifyEpochCapReached(msg.sender, MAX_SELF_VERIFIES_PER_EPOCH);
        }

        // --- EFFECTS ---
        verificationStatus[commitmentHash] = VerificationStatus.SELF_VERIFIED;
        revealedEchoHashes[commitmentHash] = echoHash;
        revealedNonces[commitmentHash] = nonce;
        totalSelfVerifications++;
        selfVerifyCount[msg.sender]++;

        // [FIX #1] Refund publisher's escrow
        uint256 escrowAmount = publisherEscrow[commitmentHash];
        publisherEscrow[commitmentHash] = 0;

        // --- INTERACTIONS ---
        // Refund escrow
        rateToken.safeTransfer(msg.sender, escrowAmount);

        // Award +200 bps deal completion
        _awardDealCompletionBonus(publisher);

        uint256 publisherAgentId = agentRegistry.agentIdOf(publisher);
        bytes memory metadata = abi.encode(commitmentHash, echoHash, nonce);
        auditLog.logAction(publisherAgentId, ECHO_SELF_VERIFIED, metadata);

        emit EscrowRefunded(commitmentHash, publisher, escrowAmount);
        emit EchoSelfVerified(commitmentHash, publisher, echoHash, block.timestamp);
    }

    // -------------------------------------------------------------------------
    // Challenge Mechanism
    // -------------------------------------------------------------------------

    /// @notice Challenge an unverified echo after the 24-hour window expires.
    /// @dev [FIX #1] Requires publisher to have funded escrow (otherwise no bounty to win).
    function challengeEcho(bytes32 commitmentHash) external nonReentrant {
        // --- CHECKS ---
        (, address publisher, uint64 commitTimestamp,,) =
            echoOracle.echos(commitmentHash);
        if (publisher == address(0)) revert EchoNotFound(commitmentHash);
        if (msg.sender == publisher) revert CannotChallengeSelf();

        VerificationStatus status = verificationStatus[commitmentHash];
        if (status == VerificationStatus.SELF_VERIFIED) {
            revert CannotChallengeVerified(commitmentHash);
        }
        if (status != VerificationStatus.UNVERIFIED) {
            revert AlreadyChallenged(commitmentHash);
        }

        uint256 deadline = uint256(commitTimestamp) + VERIFICATION_WINDOW;
        if (block.timestamp <= deadline) {
            revert VerificationWindowActive(commitmentHash, deadline);
        }

        uint8 tier = informationMarket.getTierAccess(msg.sender);
        if (tier < MIN_CHALLENGER_TIER) {
            revert InsufficientTier(MIN_CHALLENGER_TIER, tier);
        }

        // [FIX #9] Wrap validateAction with require
        require(agentRegistry.validateAction(msg.sender, ACTION_ECHO_CHALLENGE), "Action not permitted");

        // [FIX #1] Publisher must have funded escrow (otherwise no bounty to pay)
        if (publisherEscrow[commitmentHash] == 0) revert EscrowNotFunded(commitmentHash);

        // --- EFFECTS ---
        verificationStatus[commitmentHash] = VerificationStatus.CHALLENGED;
        challengers[commitmentHash] = msg.sender;

        // --- INTERACTIONS ---
        rateToken.safeTransferFrom(msg.sender, address(this), INVALID_CHALLENGE_COST);

        uint256 challengerAgentId = agentRegistry.agentIdOf(msg.sender);
        bytes memory metadata = abi.encode(commitmentHash, publisher, msg.sender);
        auditLog.logAction(challengerAgentId, ECHO_CHALLENGED, metadata);

        emit EchoChallenged(commitmentHash, publisher, msg.sender, block.timestamp);
    }

    /// @notice Resolve a pending challenge.
    /// @dev [FIX #1] Uses escrowed RATE for bounty, not safeTransferFrom on publisher.
    function resolveChallenge(
        bytes32 commitmentHash,
        bool isValid
    ) external nonReentrant onlyRole(OPERATOR_ROLE) {
        VerificationStatus status = verificationStatus[commitmentHash];
        if (status != VerificationStatus.CHALLENGED) revert NotChallenged(commitmentHash);

        (, address publisher,,,) = echoOracle.echos(commitmentHash);
        address challenger = challengers[commitmentHash];

        // --- EFFECTS ---
        if (isValid) {
            verificationStatus[commitmentHash] = VerificationStatus.CHALLENGE_VALID;
            totalValidChallenges++;
        } else {
            verificationStatus[commitmentHash] = VerificationStatus.CHALLENGE_INVALID;
            totalInvalidChallenges++;
        }

        // --- INTERACTIONS ---
        if (isValid) {
            // Valid challenge: penalise publisher, reward challenger

            // 1. Burn publisher's disinformation reputation (-500 bps)
            reputationLedger.burnReputation(
                publisher,
                CHALLENGE_PENALTY_BPS,
                IReputationLedger.Signal.DISINFO
            );

            // 2. [FIX #1] Transfer bounty from escrow (not safeTransferFrom on publisher)
            uint256 escrowAmount = publisherEscrow[commitmentHash];
            publisherEscrow[commitmentHash] = 0;
            rateToken.safeTransfer(challenger, escrowAmount);

            // 3. Refund challenger's 200 RATE stake
            rateToken.safeTransfer(challenger, INVALID_CHALLENGE_COST);
        } else {
            // Invalid challenge: burn challenger's 200 RATE stake
            // [FIX #4] Typed interface call instead of low-level .call()
            ERC20Burnable(address(rateToken)).burn(INVALID_CHALLENGE_COST);
        }

        uint256 publisherAgentId = agentRegistry.agentIdOf(publisher);
        bytes memory metadata = abi.encode(commitmentHash, publisher, challenger, isValid);
        auditLog.logAction(publisherAgentId, CHALLENGE_RESOLVED, metadata);

        emit ChallengeResolved(commitmentHash, publisher, challenger, isValid, block.timestamp);
    }

    // -------------------------------------------------------------------------
    // View Functions
    // -------------------------------------------------------------------------

    function getVerificationStatus(bytes32 commitmentHash) external view returns (VerificationStatus) {
        return verificationStatus[commitmentHash];
    }

    function getVerificationDeadline(bytes32 commitmentHash) external view returns (uint256 deadline) {
        (, , uint64 commitTimestamp,,) = echoOracle.echos(commitmentHash);
        return uint256(commitTimestamp) + VERIFICATION_WINDOW;
    }

    function isInVerificationWindow(bytes32 commitmentHash) external view returns (bool) {
        (, , uint64 commitTimestamp,,) = echoOracle.echos(commitmentHash);
        return block.timestamp <= uint256(commitTimestamp) + VERIFICATION_WINDOW;
    }

    // -------------------------------------------------------------------------
    // Internal Helpers
    // -------------------------------------------------------------------------

    function _awardDealCompletionBonus(address publisher) internal {
        reputationLedger.recordTransactionByAddress(publisher, address(this), 1);
        reputationLedger.recordTransactionByAddress(publisher, address(this), 1);
    }
}
