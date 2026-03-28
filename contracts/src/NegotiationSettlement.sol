// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

interface IAgentRegistry {
    function validateAction(address agent, uint8 actionType) external view returns (bool);
    function agentIdOf(address agent) external view returns (uint256);
}

interface IReputationLedger {
    function recordTransaction(uint256 buyerAgentId, uint256 sellerAgentId, uint256 amount) external;
}

interface IAuditLog {
    function logAction(uint256 agentId, bytes32 action, bytes calldata metadata) external;
}

/// @title NegotiationSettlement — On-chain atomic settlement for bilateral deals
/// @notice Two agents negotiate off-chain and co-sign a Deal struct. Either agent submits
///         the co-signed deal to settleDeal() for atomic multi-leg token transfers.
/// @dev Phase 4 spec §6.5. Uses EIP-712 typed data for signature verification.
///      All write paths gated by AgentRegistry.validateAction(). CEI pattern enforced.
///      Nonce tracked per sorted agent pair to prevent replay of settled deals.
contract NegotiationSettlement is ReentrancyGuard, AccessControl, EIP712 {
    using SafeERC20 for IERC20;

    // -------------------------------------------------------------------------
    // Roles
    // -------------------------------------------------------------------------
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    // -------------------------------------------------------------------------
    // Action type constants (bitmap positions — must match AgentRegistry)
    // -------------------------------------------------------------------------
    uint8 public constant ACTION_NEGOTIATE = 9;
    uint8 public constant ACTION_DEAL_SETTLE = 10;

    // -------------------------------------------------------------------------
    // AuditLog action type constants
    // -------------------------------------------------------------------------
    bytes32 public constant DEAL_SETTLED = keccak256("DEAL_SETTLED");

    // -------------------------------------------------------------------------
    // Limits
    // -------------------------------------------------------------------------
    /// @notice Maximum number of legs per side of a deal.
    /// @dev Tentative limit from Phase 4 spec §10 open questions. Bounds gas cost.
    uint8 public constant MAX_LEGS_PER_SIDE = 8;

    // -------------------------------------------------------------------------
    // Structs
    // -------------------------------------------------------------------------

    /// @notice A single leg of a deal — one token transfer.
    struct DealLeg {
        address resource; // ERC-20 token address (ResourceToken or RateToken)
        uint256 amount;   // Amount to transfer (18 decimals)
    }

    /// @notice A bilateral deal between two agents.
    /// @dev Signed by both parties via EIP-712. Submitted by either party.
    struct Deal {
        address agentA;
        address agentB;
        DealLeg[] agentAGives; // What agentA sends to agentB
        DealLeg[] agentBGives; // What agentB sends to agentA
        uint256 nonce;         // Per-pair nonce (must equal current pair nonce)
        uint256 expiresAt;     // block.timestamp deadline
    }

    // -------------------------------------------------------------------------
    // EIP-712 type hashes
    // -------------------------------------------------------------------------
    bytes32 public constant DEAL_LEG_TYPEHASH =
        keccak256("DealLeg(address resource,uint256 amount)");

    bytes32 public constant DEAL_TYPEHASH = keccak256(
        "Deal(address agentA,address agentB,DealLeg[] agentAGives,DealLeg[] agentBGives,uint256 nonce,uint256 expiresAt)DealLeg(address resource,uint256 amount)"
    );

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    IAgentRegistry public immutable agentRegistry;
    IReputationLedger public immutable reputationLedger;
    IAuditLog public immutable auditLog;

    /// @notice Nonce per sorted agent pair. Key = keccak256(abi.encodePacked(lower, higher)).
    mapping(bytes32 => uint256) public pairNonces;

    /// @notice Total number of deals settled (for indexing).
    uint256 public totalDealsSettled;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event DealSettled(
        uint256 indexed dealId,
        address indexed agentA,
        address indexed agentB,
        uint256 nonce,
        uint256 timestamp
    );

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error DealExpired(uint256 expiresAt, uint256 currentTime);
    error InvalidSignature(address expected, address recovered);
    error InvalidNonce(uint256 expected, uint256 provided);
    error EmptyDeal();
    error TooManyLegs(uint256 count, uint256 max);
    error ZeroAmount();
    error ZeroAddress();
    error SameAgent();

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /// @param _agentRegistry AgentRegistry contract address.
    /// @param _reputationLedger ReputationLedger contract address.
    /// @param _auditLog AuditLog contract address.
    /// @param admin Address that receives DEFAULT_ADMIN_ROLE and OPERATOR_ROLE.
    constructor(
        address _agentRegistry,
        address _reputationLedger,
        address _auditLog,
        address admin
    ) EIP712("MANDATE NegotiationSettlement", "1") {
        if (_agentRegistry == address(0)) revert ZeroAddress();
        if (_reputationLedger == address(0)) revert ZeroAddress();
        if (_auditLog == address(0)) revert ZeroAddress();
        if (admin == address(0)) revert ZeroAddress();

        agentRegistry = IAgentRegistry(_agentRegistry);
        reputationLedger = IReputationLedger(_reputationLedger);
        auditLog = IAuditLog(_auditLog);

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);
    }

    // -------------------------------------------------------------------------
    // Settlement
    // -------------------------------------------------------------------------

    /// @notice Settle a co-signed bilateral deal atomically.
    /// @dev NOTE: Any address can submit a co-signed deal. This is intentional — it enables
    ///      relay-friendly settlement. Both agents' signatures are verified regardless of msg.sender.
    ///      Both agents must have ACTION_DEAL_SETTLE on their allowlist bitmap.
    ///      All token transfers use SafeERC20. If any transfer fails, everything reverts.
    /// @param deal The Deal struct defining the terms.
    /// @param sigA EIP-712 signature from agentA.
    /// @param sigB EIP-712 signature from agentB.
    function settleDeal(
        Deal calldata deal,
        bytes calldata sigA,
        bytes calldata sigB
    ) external nonReentrant {
        // --- CHECKS ---
        _validateDealParams(deal);
        _verifySignatures(deal, sigA, sigB);

        // --- EFFECTS ---
        bytes32 pairKey = _pairKey(deal.agentA, deal.agentB);
        pairNonces[pairKey] = deal.nonce + 1; // D: D0{nonce} + D0{scalar} → D0{nonce} ✓
        uint256 dealId = ++totalDealsSettled;

        // --- INTERACTIONS ---
        _executeLegs(deal.agentAGives, deal.agentA, deal.agentB);
        _executeLegs(deal.agentBGives, deal.agentB, deal.agentA);
        _recordSettlement(deal, dealId);
    }

    // -------------------------------------------------------------------------
    // View functions
    // -------------------------------------------------------------------------

    /// @notice Get the current nonce for an agent pair.
    /// @param agentA First agent address.
    /// @param agentB Second agent address.
    /// @return The current nonce (next expected nonce for settlement).
    function getPairNonce(address agentA, address agentB) external view returns (uint256) {
        return pairNonces[_pairKey(agentA, agentB)];
    }

    /// @notice Compute the EIP-712 digest for a Deal struct.
    /// @dev Useful for agents to compute the digest they need to sign off-chain.
    /// @param deal The Deal struct.
    /// @return The EIP-712 typed data hash (ready for signing).
    function getDealDigest(Deal calldata deal) external view returns (bytes32) {
        return _hashTypedDataV4(_hashDeal(deal));
    }

    /// @notice Returns the EIP-712 domain separator.
    /// @dev Exposed for off-chain signature construction.
    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    /// @dev Validate deal parameters: addresses, leg counts, amounts, expiry, allowlist, nonce.
    function _validateDealParams(Deal calldata deal) internal view {
        if (deal.agentA == address(0) || deal.agentB == address(0)) revert ZeroAddress();
        if (deal.agentA == deal.agentB) revert SameAgent();
        if (deal.agentAGives.length == 0 && deal.agentBGives.length == 0) revert EmptyDeal();
        if (deal.agentAGives.length > MAX_LEGS_PER_SIDE) {
            revert TooManyLegs(deal.agentAGives.length, MAX_LEGS_PER_SIDE);
        }
        if (deal.agentBGives.length > MAX_LEGS_PER_SIDE) {
            revert TooManyLegs(deal.agentBGives.length, MAX_LEGS_PER_SIDE);
        }
        _validateLegs(deal.agentAGives);
        _validateLegs(deal.agentBGives);

        // block.timestamp — never block.number on MegaETH (10ms blocks)
        if (block.timestamp > deal.expiresAt) { // D: D0{sec} > D0{sec} → bool ✓
            revert DealExpired(deal.expiresAt, block.timestamp);
        }

        // [FIX #9] Allowlist gate with require wrapper for defensive coding
        require(agentRegistry.validateAction(deal.agentA, ACTION_DEAL_SETTLE), "Action not permitted");
        require(agentRegistry.validateAction(deal.agentB, ACTION_DEAL_SETTLE), "Action not permitted");

        // Nonce check (per sorted agent pair)
        bytes32 pairKey = _pairKey(deal.agentA, deal.agentB);
        if (deal.nonce != pairNonces[pairKey]) {
            revert InvalidNonce(pairNonces[pairKey], deal.nonce);
        }
    }

    /// @dev Verify EIP-712 signatures from both agents.
    function _verifySignatures(
        Deal calldata deal,
        bytes calldata sigA,
        bytes calldata sigB
    ) internal view {
        bytes32 digest = _hashTypedDataV4(_hashDeal(deal));

        address recoveredA = ECDSA.recover(digest, sigA);
        if (recoveredA != deal.agentA) {
            revert InvalidSignature(deal.agentA, recoveredA);
        }

        address recoveredB = ECDSA.recover(digest, sigB);
        if (recoveredB != deal.agentB) {
            revert InvalidSignature(deal.agentB, recoveredB);
        }
    }

    /// @dev Record settlement in ReputationLedger and AuditLog, emit event.
    function _recordSettlement(Deal calldata deal, uint256 dealId) internal {
        uint256 agentAId = agentRegistry.agentIdOf(deal.agentA);
        uint256 agentBId = agentRegistry.agentIdOf(deal.agentB);
        uint256 totalValue = _sumLegValues(deal.agentAGives) + _sumLegValues(deal.agentBGives); // D: D18{tok} + D18{tok} → D18{tok} ✓ ⚠ mixed token types summed

        reputationLedger.recordTransaction(agentAId, agentBId, totalValue);

        bytes memory metadata = abi.encode(
            dealId, deal.agentA, deal.agentB, deal.nonce,
            deal.agentAGives.length, deal.agentBGives.length, totalValue
        );
        auditLog.logAction(agentAId, DEAL_SETTLED, metadata);

        emit DealSettled(dealId, deal.agentA, deal.agentB, deal.nonce, block.timestamp);
    }

    /// @dev Compute the sorted pair key for nonce tracking.
    function _pairKey(address a, address b) internal pure returns (bytes32) {
        (address lower, address higher) = a < b ? (a, b) : (b, a);
        return keccak256(abi.encodePacked(lower, higher));
    }

    /// @dev Hash a DealLeg for EIP-712.
    function _hashDealLeg(DealLeg calldata leg) internal pure returns (bytes32) {
        return keccak256(abi.encode(DEAL_LEG_TYPEHASH, leg.resource, leg.amount));
    }

    /// @dev Hash an array of DealLegs for EIP-712.
    function _hashDealLegArray(DealLeg[] calldata legs) internal pure returns (bytes32) {
        bytes32[] memory legHashes = new bytes32[](legs.length);
        for (uint256 i = 0; i < legs.length; i++) {
            legHashes[i] = _hashDealLeg(legs[i]);
        }
        return keccak256(abi.encodePacked(legHashes));
    }

    /// @dev Hash a Deal struct for EIP-712.
    function _hashDeal(Deal calldata deal) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                DEAL_TYPEHASH,
                deal.agentA,
                deal.agentB,
                _hashDealLegArray(deal.agentAGives),
                _hashDealLegArray(deal.agentBGives),
                deal.nonce,
                deal.expiresAt
            )
        );
    }

    /// @dev Validate that all legs have non-zero resource address and non-zero amount.
    function _validateLegs(DealLeg[] calldata legs) internal pure {
        for (uint256 i = 0; i < legs.length; i++) {
            if (legs[i].resource == address(0)) revert ZeroAddress();
            if (legs[i].amount == 0) revert ZeroAmount();
        }
    }

    /// @dev Execute all transfers for one side of the deal.
    function _executeLegs(DealLeg[] calldata legs, address from, address to) internal {
        for (uint256 i = 0; i < legs.length; i++) {
            IERC20(legs[i].resource).safeTransferFrom(from, to, legs[i].amount); // D: transfer D18{tok}
        }
    }

    /// @dev Sum the total token amounts across all legs (for reputation recording).
    ///      NOTE: This sums raw amounts across different token types. The total is used only
    ///      for event emission in ReputationLedger, not for score calculation. If ReputationLedger
    ///      is upgraded to use amounts for scoring, this must be replaced with RATE-denominated valuation.
    function _sumLegValues(DealLeg[] calldata legs) internal pure returns (uint256 total) {
        for (uint256 i = 0; i < legs.length; i++) {
            total += legs[i].amount; // D: D18{tok} += D18{tok} ✓ ⚠ mixed token types summed across legs
        }
    }
}
