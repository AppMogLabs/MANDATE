// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Minimal interface for minting RATE tokens.
interface IRateTokenMint {
    function mint(address to, uint256 amount) external;
}

/// @notice Minimal interface for querying epoch state.
interface IEpochManager {
    function getCurrentEpoch() external view returns (uint256);
    function isEpochActive() external view returns (bool);
}

/// @notice Minimal interface for checking agent registration.
interface IAgentRegistryCheck {
    function agentIdOf(address agent) external view returns (uint256);
}

/// @title EpochRewardManager
/// @notice Faucet drip and milestone reward distribution for the MANDATE strategy game.
///         Mints RATE tokens to registered agents via daily drip claims and one-time
///         milestone achievements per epoch.
/// @dev Relies on MINTER_ROLE being granted to this contract on the RateToken.
///      All economic parameters are PHASE_3_PLACEHOLDER values subject to rebalancing.
/// @custom:security This contract mints unbacked RATE. The OPERATOR_ROLE must be tightly
///                  controlled; compromised operators can award arbitrary milestone rewards.
contract EpochRewardManager is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ──────────────────────────────────────────────
    //  Constants
    // ──────────────────────────────────────────────

    /// @notice Daily drip amount per agent (PHASE_3_PLACEHOLDER)
    uint256 public constant DAILY_DRIP_AMOUNT = 4_500 * 1e18;

    /// @notice Minimum interval between drip claims
    uint256 public constant DRIP_INTERVAL = 1 days;

    /// @notice Role for operators that can award milestones and update rewards
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    // ── Milestone IDs ────────────────────────────

    uint256 public constant MILESTONE_FIRST_BUILDING = 1;
    uint256 public constant MILESTONE_FIRST_TRADE = 2;
    uint256 public constant MILESTONE_FIRST_TRAINING_CLUSTER = 3;
    uint256 public constant MILESTONE_FIRST_DEPLOYED_MODEL = 4;
    uint256 public constant MILESTONE_SURVIVED_EPOCH = 5;
    uint256 public constant MILESTONE_WINNER_1ST = 6;
    uint256 public constant MILESTONE_WINNER_2ND = 7;
    uint256 public constant MILESTONE_WINNER_3RD = 8;
    uint256 public constant MILESTONE_TOP_10 = 9;

    // ──────────────────────────────────────────────
    //  Immutables
    // ──────────────────────────────────────────────

    /// @notice RATE token contract (must grant MINTER_ROLE to this contract)
    IRateTokenMint public immutable rateToken;

    /// @notice Epoch manager for current-epoch queries
    IEpochManager public immutable epochManager;

    /// @notice Agent registry for registration checks
    IAgentRegistryCheck public immutable agentRegistry;

    // ──────────────────────────────────────────────
    //  State
    // ──────────────────────────────────────────────

    /// @notice Tracks the last timestamp each agent claimed their daily drip
    mapping(address => uint256) public lastDripTimestamp;

    /// @notice Reward amount in RATE for each milestone ID (PHASE_3_PLACEHOLDER values)
    mapping(uint256 => uint256) public milestoneRewards;

    /// @notice Tracks whether an agent has claimed a specific milestone in a given epoch
    /// @dev epoch => agent => milestoneId => claimed
    mapping(uint256 => mapping(address => mapping(uint256 => bool))) public milestoneClaimed;

    // ──────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────

    /// @notice Emitted when an agent claims their daily RATE drip
    event DripClaimed(address indexed agent, uint256 amount, uint256 epoch);

    /// @notice Emitted when a milestone reward is claimed or awarded
    event MilestoneClaimed(address indexed agent, uint256 indexed milestoneId, uint256 amount, uint256 epoch);

    /// @notice Emitted when an operator updates a milestone reward amount
    event MilestoneRewardUpdated(uint256 indexed milestoneId, uint256 oldAmount, uint256 newAmount);

    // ──────────────────────────────────────────────
    //  Errors
    // ──────────────────────────────────────────────

    error ZeroAddress();
    error AgentNotRegistered();
    error DripCooldownActive();
    error InvalidMilestone();
    error MilestoneAlreadyClaimed();

    // ──────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────

    /// @notice Initialises the reward manager with core contract references and default milestone rewards.
    /// @param _rateToken   Address of the RATE token contract (must support mint)
    /// @param _epochManager Address of the EpochManager contract
    /// @param _agentRegistry Address of the AgentRegistry contract
    /// @param admin        Address that receives DEFAULT_ADMIN_ROLE and OPERATOR_ROLE
    constructor(
        address _rateToken,
        address _epochManager,
        address _agentRegistry,
        address admin
    ) {
        if (_rateToken == address(0)) revert ZeroAddress();
        if (_epochManager == address(0)) revert ZeroAddress();
        if (_agentRegistry == address(0)) revert ZeroAddress();
        if (admin == address(0)) revert ZeroAddress();

        rateToken = IRateTokenMint(_rateToken);
        epochManager = IEpochManager(_epochManager);
        agentRegistry = IAgentRegistryCheck(_agentRegistry);

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);

        // PHASE_3_PLACEHOLDER — all reward amounts subject to economic rebalancing
        milestoneRewards[MILESTONE_FIRST_BUILDING] = 5_000e18;
        milestoneRewards[MILESTONE_FIRST_TRADE] = 2_000e18;
        milestoneRewards[MILESTONE_FIRST_TRAINING_CLUSTER] = 10_000e18;
        milestoneRewards[MILESTONE_FIRST_DEPLOYED_MODEL] = 20_000e18;
        milestoneRewards[MILESTONE_SURVIVED_EPOCH] = 10_000e18;
        milestoneRewards[MILESTONE_WINNER_1ST] = 500_000e18;
        milestoneRewards[MILESTONE_WINNER_2ND] = 200_000e18;
        milestoneRewards[MILESTONE_WINNER_3RD] = 100_000e18;
        milestoneRewards[MILESTONE_TOP_10] = 50_000e18;
    }

    // ──────────────────────────────────────────────
    //  External — Agent-callable
    // ──────────────────────────────────────────────

    /// @notice Claim the daily RATE drip. May be called once per DRIP_INTERVAL per agent.
    /// @dev Follows CEI pattern: checks registration + cooldown, updates timestamp, then mints.
    /// @custom:security nonReentrant guard protects against reentrancy via rateToken.mint callback.
    function claimDailyDrip() external nonReentrant {
        if (agentRegistry.agentIdOf(msg.sender) == 0) revert AgentNotRegistered();
        if (block.timestamp < lastDripTimestamp[msg.sender] + DRIP_INTERVAL) revert DripCooldownActive(); // D: D0{sec} < D0{sec} + D0{sec} ✓

        lastDripTimestamp[msg.sender] = block.timestamp;

        rateToken.mint(msg.sender, DAILY_DRIP_AMOUNT);

        emit DripClaimed(msg.sender, DAILY_DRIP_AMOUNT, epochManager.getCurrentEpoch());
    }

    /// @notice Claim a milestone reward for the current epoch. Each milestone may only be
    ///         claimed once per agent per epoch.
    /// @param milestoneId The milestone identifier (use MILESTONE_* constants)
    /// @custom:security nonReentrant guard protects against reentrancy via rateToken.mint callback.
    function claimMilestone(uint256 milestoneId) external nonReentrant {
        if (agentRegistry.agentIdOf(msg.sender) == 0) revert AgentNotRegistered();
        if (milestoneRewards[milestoneId] == 0) revert InvalidMilestone();

        uint256 epoch = epochManager.getCurrentEpoch();
        if (milestoneClaimed[epoch][msg.sender][milestoneId]) revert MilestoneAlreadyClaimed();

        milestoneClaimed[epoch][msg.sender][milestoneId] = true;

        uint256 reward = milestoneRewards[milestoneId];
        rateToken.mint(msg.sender, reward);

        emit MilestoneClaimed(msg.sender, milestoneId, reward, epoch);
    }

    // ──────────────────────────────────────────────
    //  External — Operator-only
    // ──────────────────────────────────────────────

    /// @notice Award a milestone to a specific agent. Used by operators for milestones that
    ///         cannot be self-claimed (e.g., epoch winners, top-10 placements).
    /// @param agent       The agent address to receive the reward
    /// @param milestoneId The milestone identifier
    /// @dev Follows the same claim logic as claimMilestone but is operator-initiated.
    /// @custom:security Only callable by OPERATOR_ROLE. Operator must verify off-chain that
    ///                  the agent legitimately achieved the milestone.
    function awardMilestone(address agent, uint256 milestoneId) external onlyRole(OPERATOR_ROLE) nonReentrant {
        if (agentRegistry.agentIdOf(agent) == 0) revert AgentNotRegistered();
        if (milestoneRewards[milestoneId] == 0) revert InvalidMilestone();

        uint256 epoch = epochManager.getCurrentEpoch();
        if (milestoneClaimed[epoch][agent][milestoneId]) revert MilestoneAlreadyClaimed();

        milestoneClaimed[epoch][agent][milestoneId] = true;

        uint256 reward = milestoneRewards[milestoneId];
        rateToken.mint(agent, reward);

        emit MilestoneClaimed(agent, milestoneId, reward, epoch);
    }

    /// @notice Update the reward amount for a milestone.
    /// @param milestoneId The milestone identifier to update
    /// @param amount      New reward amount in RATE (18 decimals)
    /// @custom:security Only callable by OPERATOR_ROLE.
    function setMilestoneReward(uint256 milestoneId, uint256 amount) external onlyRole(OPERATOR_ROLE) {
        uint256 oldAmount = milestoneRewards[milestoneId];
        milestoneRewards[milestoneId] = amount;

        emit MilestoneRewardUpdated(milestoneId, oldAmount, amount);
    }
}
