// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title ClearanceRegistry — Agent clearance levels and burn rate tracking
/// @notice Tracks agent clearance levels and burn rates for CLEARANCE resource.
///         GuardClauseMarketplace burns 1% CLEARANCE on activation.
///         ComplianceDriftOracle burns 2% CLEARANCE on recalibration.
/// @dev Security: AccessControl (OPERATOR_ROLE). MegaETH compatible (block.timestamp).
/// @custom:invariant burnRate[agent] is always in range [0, 10000] basis points (0-100%)
/// @custom:invariant clearanceLevel[agent] can only be modified by OPERATOR_ROLE
/// @custom:invariant burnClearance() decrements burnRate and requires sufficient balance (underflow protection)
/// @custom:security All state-modifying functions require OPERATOR_ROLE via AccessControl
/// @custom:security burnClearance() validates bps <= currentBurnRate to prevent underflow
contract ClearanceRegistry is AccessControl {
    /* ══════════════════════════════════════════════════════════════════════════════
       CONSTANTS & ROLES
       ══════════════════════════════════════════════════════════════════════════════ */

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    /* ══════════════════════════════════════════════════════════════════════════════
       STATE VARIABLES
       ══════════════════════════════════════════════════════════════════════════════ */

    /// @notice Mapping: agent => clearance level
    mapping(address => uint256) public clearanceLevel;

    /// @notice Mapping: agent => burn rate (in basis points, 0-10000)
    mapping(address => uint256) public burnRate;

    /* ══════════════════════════════════════════════════════════════════════════════
       EVENTS
       ══════════════════════════════════════════════════════════════════════════════ */

    /// @notice Emitted when an agent's clearance level is updated
    /// @param agent The agent whose clearance was modified
    /// @param newLevel The new clearance level (uint256, no upper bound)
    event ClearanceUpdated(address indexed agent, uint256 newLevel);

    /// @notice Emitted when clearance burn rate is reduced (burned)
    /// @param agent The agent whose burn rate was reduced
    /// @param burnAmount The amount of basis points burned
    event ClearanceBurned(address indexed agent, uint256 burnAmount);

    /// @notice Emitted when an agent's burn rate is set
    /// @param agent The agent whose burn rate was modified
    /// @param newRate The new burn rate in basis points (0-10000)
    event BurnRateUpdated(address indexed agent, uint256 newRate);

    /* ══════════════════════════════════════════════════════════════════════════════
       CONSTRUCTOR
       ══════════════════════════════════════════════════════════════════════════════ */

    /// @notice Initializes the ClearanceRegistry with the deployer as admin
    /// @dev Grants DEFAULT_ADMIN_ROLE to msg.sender, allowing them to grant OPERATOR_ROLE.
    ///      All clearance levels and burn rates start at 0.
    /// @custom:security Deployer receives DEFAULT_ADMIN_ROLE automatically
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /* ══════════════════════════════════════════════════════════════════════════════
       CORE FUNCTIONS
       ══════════════════════════════════════════════════════════════════════════════ */

    /// @notice Update agent clearance level (Operator-only)
    /// @dev Only OPERATOR_ROLE can call this function. No validation on level value (unbounded).
    ///      Overwrites previous clearance level for the agent.
    /// @param agent Address of the agent (must not be address(0) in production usage)
    /// @param level New clearance level (uint256, no upper bound enforced)
    /// @custom:security Requires OPERATOR_ROLE via onlyRole modifier
    function updateClearance(address agent, uint256 level) external onlyRole(OPERATOR_ROLE) {
        clearanceLevel[agent] = level;
        emit ClearanceUpdated(agent, level);
    }

    /// @notice Burn clearance (decrease burn rate)
    /// @dev Called by GuardClauseMarketplace (1% burn) and ComplianceDriftOracle (2% burn).
    ///      Validates that burn amount does not exceed current burn rate (underflow protection).
    /// @param agent Address of the agent whose burn rate is being reduced
    /// @param bps Basis points to burn (must be <= current burnRate[agent])
    /// @custom:security Requires OPERATOR_ROLE via onlyRole modifier
    /// @custom:security Validates bps <= currentBurnRate to prevent underflow
    function burnClearance(address agent, uint256 bps) external onlyRole(OPERATOR_ROLE) {
        uint256 currentBurnRate = burnRate[agent];
        require(bps <= currentBurnRate, "Burn exceeds available rate");
        
        uint256 newBurnRate = currentBurnRate - bps; // D: D0{bps} = D0{bps} - D0{bps} ✓
        burnRate[agent] = newBurnRate;
        
        emit ClearanceBurned(agent, bps);
    }

    /// @notice Set burn rate for an agent (Operator-only, internal helper)
    /// @dev Used in tests and initialization. Validates burn rate is within 0-10000 basis points (0-100%).
    ///      Overwrites previous burn rate for the agent.
    /// @param agent Address of the agent whose burn rate is being set
    /// @param bps Basis points for burn rate (must be <= 10000, representing 0-100%)
    /// @custom:security Requires OPERATOR_ROLE via onlyRole modifier
    /// @custom:security Validates bps <= 10000 to maintain invariant
    function setBurnRate(address agent, uint256 bps) external onlyRole(OPERATOR_ROLE) {
        require(bps <= 10000, "Invalid burn rate");
        burnRate[agent] = bps;
        emit BurnRateUpdated(agent, bps);
    }

    /* ══════════════════════════════════════════════════════════════════════════════
       VIEW FUNCTIONS
       ══════════════════════════════════════════════════════════════════════════════ */

    /// @notice Get current clearance level for an agent
    /// @dev Returns 0 if agent has never been assigned a clearance level.
    /// @param agent Address of the agent to query
    /// @return Current clearance level (uint256, 0 if unassigned)
    function getClearance(address agent) external view returns (uint256) {
        return clearanceLevel[agent];
    }

    /// @notice Get current burn rate for an agent
    /// @dev Returns 0 if agent has never been assigned a burn rate.
    /// @param agent Address of the agent to query
    /// @return Current burn rate in basis points (0-10000, representing 0-100%)
    function getBurnRate(address agent) external view returns (uint256) {
        return burnRate[agent];
    }
}
