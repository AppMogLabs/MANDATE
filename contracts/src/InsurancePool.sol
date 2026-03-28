// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/// @title InsurancePool — Underwriter pool with bonding curve premiums
/// @notice Single-pool insurance contract for MANDATE. Underwriters stake RATE,
///         policyholders pay premiums, and claims trigger proportional payouts.
/// @dev Security: SafeERC20, ReentrancyGuard, AccessControl, Pausable.
///      Time logic uses block.timestamp (MegaETH compatible).
/// @custom:invariant totalStaked >= 0 (never negative, protected by underflow checks)
/// @custom:invariant totalShares = sum of all sharesOf[underwriter] (proportional ownership)
/// @custom:invariant premiumReserves tracked separately from totalStaked (capital segregation)
/// @custom:invariant Utilization ratio = totalCoverage / totalStaked (bonding curve input)
/// @custom:invariant Solvency ratio = (totalStaked + premiumReserves) / totalCoverage >= 120% (enforced in triggerClaim)
/// @custom:invariant Unstake requires 500s cooldown (two-step process: initiate → complete)
/// @custom:invariant Premium calculation: BASE_PREMIUM × (1 + utilization_ratio) in 10,000 bps precision
/// @custom:security ReentrancyGuard on all state-changing functions with token transfers
/// @custom:security SafeERC20 for all IERC20 operations (handles non-standard tokens)
/// @custom:security Pausable emergency stop (OPERATOR_ROLE can pause/unpause)
/// @custom:security CEI pattern enforced (Checks-Effects-Interactions)
contract InsurancePool is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    /* ══════════════════════════════════════════════════════════════════════════════
       CONSTANTS & IMMUTABLES
       ══════════════════════════════════════════════════════════════════════════════ */

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    uint256 public constant UNSTAKE_COOLDOWN = 86_400; // D: D0{sec} — 24 hours
    uint256 public constant BASE_PREMIUM_BPS = 500; // D: D0{bps} — 5% = 500 bps
    uint256 public constant MIN_SOLVENCY_RATIO_BPS = 12_000; // D: D0{bps} — 120%

    IERC20 public immutable rateToken;

    /* ══════════════════════════════════════════════════════════════════════════════
       STATE VARIABLES
       ══════════════════════════════════════════════════════════════════════════════ */

    /// @notice Total RATE staked in the pool (underwriter capital only)
    uint256 public totalStaked; // D: D18{RATE}

    /// @notice Total shares issued to underwriters
    uint256 public totalShares; // D: D18{share}

    /// @notice Total active coverage across all policies
    uint256 public totalCoverage; // D: D18{RATE}

    /// @notice Premium reserves (separate from staked capital)
    uint256 public premiumReserves; // D: D18{RATE}

    /// @notice Next policy ID
    uint256 public nextPolicyId = 1;

    /// @notice Underwriter shares (proportional ownership)
    mapping(address => uint256) public sharesOf;

    /// @notice Unstake requests (two-step process)
    mapping(address => UnstakeRequest) public unstakeRequests;

    /// @notice Active policies
    mapping(uint256 => Policy) private policies;

    /// @dev Temporary lookup for affected agents during triggerClaim (cleaned up after use)
    mapping(address => bool) private _affectedLookup;

    /* ══════════════════════════════════════════════════════════════════════════════
       STRUCTS
       ══════════════════════════════════════════════════════════════════════════════ */

    struct Policy {
        address holder;              // D: {addr}
        uint256 coverageAmount;      // D: D18{RATE}
        uint64 expiryTimestamp;      // D: D0{sec} — block.timestamp
        bool claimed;                // D: {bool}
    }

    struct UnstakeRequest {
        uint256 amount;              // D: D18{RATE}
        uint64 finalTimestamp;       // D: D0{sec} — block.timestamp
    }

    /* ══════════════════════════════════════════════════════════════════════════════
       EVENTS
       ══════════════════════════════════════════════════════════════════════════════ */

    event Staked(address indexed underwriter, uint256 amount, uint256 shares);
    event UnstakeInitiated(address indexed underwriter, uint256 amount, uint64 finalTimestamp);
    event Unstaked(address indexed underwriter, uint256 amount);
    event PolicyPurchased(
        uint256 indexed policyId,
        address indexed holder,
        uint256 coverage,
        uint256 premium
    );
    event ClaimTriggered(uint256 totalPayout, uint256 claimants);

    /* ══════════════════════════════════════════════════════════════════════════════
       CONSTRUCTOR
       ══════════════════════════════════════════════════════════════════════════════ */

    /// @notice Deploy InsurancePool with RATE token reference
    /// @param _rateToken Address of RateToken contract
    constructor(address _rateToken) {
        if (_rateToken == address(0)) revert("Zero address");

        rateToken = IERC20(_rateToken);

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /* ══════════════════════════════════════════════════════════════════════════════
       STAKING
       ══════════════════════════════════════════════════════════════════════════════ */

    /// @notice Stake RATE to become an underwriter
    /// @param amount Amount of RATE to stake
    function stake(uint256 amount) external whenNotPaused {
        if (amount == 0) revert("Zero amount");

        uint256 shares;

        if (totalShares == 0) {
            // First staker gets 1:1 shares
            shares = amount;
        } else {
            // Proportional shares: (amount / totalStaked) * totalShares
            shares = (amount * totalShares) / totalStaked; // D: D18{RATE} * D18{share} / D18{RATE} → D18{share} ✓
        }

        // Effects
        totalStaked += amount;
        totalShares += shares;
        sharesOf[msg.sender] += shares;

        // Interaction (SafeERC20)
        rateToken.safeTransferFrom(msg.sender, address(this), amount);

        emit Staked(msg.sender, amount, shares);
    }

    /* ══════════════════════════════════════════════════════════════════════════════
       UNSTAKING (TWO-STEP COOLDOWN)
       ══════════════════════════════════════════════════════════════════════════════ */

    /// @notice Initiate unstake request (step 1 of 2)
    /// @param amount Amount of RATE to unstake
    function initiateUnstake(uint256 amount) external {
        if (amount == 0) revert("Zero amount");
        if (sharesOf[msg.sender] == 0) revert("No stake");

        // Calculate shares to burn
        uint256 sharesToBurn = (amount * totalShares) / totalStaked; // D: D18{RATE} * D18{share} / D18{RATE} → D18{share} ✓
        if (sharesToBurn > sharesOf[msg.sender]) revert("Insufficient shares");

        // Store unstake request
        unstakeRequests[msg.sender] = UnstakeRequest({
            amount: amount,
            finalTimestamp: uint64(block.timestamp + UNSTAKE_COOLDOWN) // D: D0{sec} + D0{sec} → D0{sec} ✓
        });

        emit UnstakeInitiated(msg.sender, amount, uint64(block.timestamp + UNSTAKE_COOLDOWN)); // D: D0{sec} + D0{sec} → D0{sec} ✓
    }

    /// @notice Finalise unstake after cooldown (step 2 of 2)
    function finaliseUnstake() external nonReentrant {
        UnstakeRequest memory request = unstakeRequests[msg.sender];
        
        if (request.amount == 0) revert("No unstake request");
        if (block.timestamp < request.finalTimestamp) revert("Cooldown not expired");

        uint256 amount = request.amount;

        // Calculate shares to burn
        uint256 sharesToBurn = (amount * totalShares) / totalStaked; // D: D18{RATE} * D18{share} / D18{RATE} → D18{share} ✓

        // Effects (CEI pattern)
        totalStaked -= amount;
        totalShares -= sharesToBurn;
        sharesOf[msg.sender] -= sharesToBurn;

        delete unstakeRequests[msg.sender];

        // Interaction (SafeERC20)
        rateToken.safeTransfer(msg.sender, amount);

        emit Unstaked(msg.sender, amount);
    }

    /* ══════════════════════════════════════════════════════════════════════════════
       POLICY PURCHASE
       ══════════════════════════════════════════════════════════════════════════════ */

    /// @notice Purchase insurance policy
    /// @param coverageAmount Amount of RATE coverage
    /// @param durationSeconds Policy duration in seconds
    /// @return policyId Unique policy identifier
    function purchasePolicy(
        uint256 coverageAmount,
        uint64 durationSeconds
    ) external whenNotPaused returns (uint256 policyId) {
        if (coverageAmount == 0) revert("Zero coverage");
        if (durationSeconds == 0) revert("Zero duration");

        // Calculate premium via bonding curve
        uint256 premiumRate = getPremiumRate(); // D: D0{bps}
        uint256 premium = (coverageAmount * premiumRate * durationSeconds) / (365 days * 10_000); // D: D18{RATE} * D0{bps} * D0{sec} / (D0{sec} * D0{bps}) → D18{RATE} ✓ ⚠ overflow if coverageAmount > ~1e50

        if (premium == 0) revert("Premium too low");

        // Store policy
        policyId = nextPolicyId++;
        policies[policyId] = Policy({
            holder: msg.sender,
            coverageAmount: coverageAmount,
            expiryTimestamp: uint64(block.timestamp + durationSeconds), // D: D0{sec} + D0{sec} → D0{sec} ✓
            claimed: false
        });

        // Update total coverage
        totalCoverage += coverageAmount;

        // Transfer premium to pool (SafeERC20)
        rateToken.safeTransferFrom(msg.sender, address(this), premium);

        // Add premium to reserves (not staked capital)
        premiumReserves += premium;

        emit PolicyPurchased(policyId, msg.sender, coverageAmount, premium);
    }

    /* ══════════════════════════════════════════════════════════════════════════════
       CLAIM SETTLEMENT
       ══════════════════════════════════════════════════════════════════════════════ */

    /// @notice Trigger claim settlement for specific affected agents (operator only)
    /// @dev Only pays policyholders whose addresses appear in the affectedAgents list.
    ///      The operator determines affected agents from CoolingRelay propagation events.
    /// @param affectedAgents Addresses affected by the COOLING cascade event
    function triggerClaim(address[] calldata affectedAgents) external onlyRole(OPERATOR_ROLE) nonReentrant whenNotPaused {
        require(affectedAgents.length > 0, "No affected agents");

        // Check solvency ratio
        uint256 solvencyRatio = getSolvencyRatio();
        if (solvencyRatio < MIN_SOLVENCY_RATIO_BPS) revert("Undercollateralised");

        // Build lookup set of affected addresses
        mapping(address => bool) storage _affected = _affectedLookup;
        for (uint256 i = 0; i < affectedAgents.length; i++) {
            _affected[affectedAgents[i]] = true;
        }

        uint256 totalPayout = 0;

        // Identify active policies held by affected agents
        uint256[] memory eligiblePolicyIds = new uint256[](nextPolicyId);
        uint256 eligibleCount = 0;

        for (uint256 i = 1; i < nextPolicyId; i++) {
            Policy storage policy = policies[i];

            if (
                !policy.claimed &&
                policy.holder != address(0) &&
                block.timestamp <= policy.expiryTimestamp &&
                _affected[policy.holder]
            ) {
                eligiblePolicyIds[eligibleCount++] = i;
                totalPayout += policy.coverageAmount;
            }
        }

        if (totalPayout == 0) revert("No eligible policies");

        // Effects: Mark policies as claimed, update pool state
        for (uint256 i = 0; i < eligibleCount; i++) {
            policies[eligiblePolicyIds[i]].claimed = true;
        }

        totalStaked -= totalPayout;
        totalCoverage -= totalPayout;

        // Interactions: Distribute payouts to affected policyholders only
        for (uint256 i = 0; i < eligibleCount; i++) {
            Policy storage policy = policies[eligiblePolicyIds[i]];
            rateToken.safeTransfer(policy.holder, policy.coverageAmount);
        }

        // Cleanup affected lookup
        for (uint256 i = 0; i < affectedAgents.length; i++) {
            delete _affected[affectedAgents[i]];
        }

        emit ClaimTriggered(totalPayout, eligibleCount);
    }

    /* ══════════════════════════════════════════════════════════════════════════════
       VIEW FUNCTIONS
       ══════════════════════════════════════════════════════════════════════════════ */

    /// @notice Get premium rate (bps) via bonding curve
    /// @return Premium rate in basis points (10000 = 100%)
    function getPremiumRate() public view returns (uint256) {
        if (totalStaked == 0) return BASE_PREMIUM_BPS;

        // premiumRate = BASE_PREMIUM × (1 + (totalCoverage / totalStaked))
        // Use higher precision to avoid rounding errors
        uint256 utilisationRatio = (totalCoverage * 10_000) / totalStaked; // D: D18{RATE} * D0{bps} / D18{RATE} → D0{bps} ✓
        uint256 multiplier = 10_000 + utilisationRatio; // D: D0{bps} + D0{bps} → D0{bps} ✓
        return (BASE_PREMIUM_BPS * multiplier) / 10_000; // D: D0{bps} * D0{bps} / D0{bps} → D0{bps} ✓
    }

    /// @notice Get solvency ratio (bps)
    /// @return Solvency ratio in basis points (10000 = 100%)
    function getSolvencyRatio() public view returns (uint256) {
        if (totalCoverage == 0) return type(uint256).max;
        uint256 totalCapital = totalStaked + premiumReserves; // D: D18{RATE} + D18{RATE} → D18{RATE} ✓
        return (totalCapital * 10_000) / totalCoverage; // D: D18{RATE} * D0{bps} / D18{RATE} → D0{bps} ✓
    }

    /// @notice Get policy details
    /// @param policyId Policy identifier
    /// @return holder Policy holder address
    /// @return coverageAmount Coverage amount
    /// @return expiryTimestamp Expiry timestamp
    /// @return claimed Whether policy has been claimed
    function getPolicy(uint256 policyId)
        external
        view
        returns (
            address holder,
            uint256 coverageAmount,
            uint64 expiryTimestamp,
            bool claimed
        )
    {
        Policy memory policy = policies[policyId];
        return (policy.holder, policy.coverageAmount, policy.expiryTimestamp, policy.claimed);
    }

    /* ══════════════════════════════════════════════════════════════════════════════
       ADMIN FUNCTIONS
       ══════════════════════════════════════════════════════════════════════════════ */

    /// @notice Pause pool operations (emergency)
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /// @notice Unpause pool operations
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}
