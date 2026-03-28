// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title RoleRegistry — Sovereign role assignment for MANDATE governance
/// @notice Tracks 5 sovereign roles (Talent Hub, Regulatory Power, Data Sovereign, 
///         Compute Superpower, CHIPS Magnate) and assigns them via governance.
///         Supports epoch-scoped resets for role reassignment.
/// @dev Uses OpenZeppelin AccessControl with OPERATOR_ROLE for role assignments and epoch resets.
///      All role holders are stored in a simple mapping per role.
///      Epoch increments on each reset to track role assignment cycles.
/// @custom:invariant Each role (0-4) maps to exactly one address (or address(0) if unassigned)
/// @custom:invariant currentEpoch is monotonically increasing (never decreases)
/// @custom:invariant Only addresses with OPERATOR_ROLE can modify role assignments or reset epochs
/// @custom:invariant resetEpoch() clears all 5 role holders atomically and increments currentEpoch
/// @custom:security Access control enforced via OpenZeppelin AccessControl (OPERATOR_ROLE required for writes)
contract RoleRegistry is AccessControl {
    // =========================================================================
    // Roles & Enums
    // =========================================================================

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    /// @notice The 5 sovereign roles in MANDATE
    enum Role {
        TALENT_HUB,           // 0
        REGULATORY_POWER,     // 1
        DATA_SOVEREIGN,       // 2
        COMPUTE_SUPERPOWER,   // 3
        CHIPS_MAGNATE         // 4
    }

    // =========================================================================
    // State
    // =========================================================================

    /// @notice Maps role => current holder address (zero address = unassigned)
    mapping(uint8 => address) public roleHolders;

    /// @notice Current epoch (incremented by resetEpoch)
    uint256 public currentEpoch;

    // =========================================================================
    // Events
    // =========================================================================

    /// @notice Emitted when a role is assigned to a new holder
    /// @param role The role being assigned (0-4)
    /// @param newHolder The new holder address
    /// @param epoch The epoch in which the assignment occurred
    event RoleAssigned(uint8 indexed role, address indexed newHolder, uint256 indexed epoch);

    /// @notice Emitted when an epoch is reset (clearing all role holders)
    /// @param newEpoch The new epoch number
    event EpochReset(uint256 indexed newEpoch);

    // =========================================================================
    // Constructor
    // =========================================================================

    /// @notice Initializes the RoleRegistry with a designated admin
    /// @dev Grants DEFAULT_ADMIN_ROLE to the admin address, which can then grant OPERATOR_ROLE.
    ///      Sets currentEpoch to 0, all role holders start unassigned (address(0)).
    /// @param admin Address that receives DEFAULT_ADMIN_ROLE (must not be address(0))
    /// @custom:security Admin validation prevents deployment with zero admin
    constructor(address admin) {
        require(admin != address(0), "RoleRegistry: zero admin");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        currentEpoch = 0;
    }

    // =========================================================================
    // Role Assignment
    // =========================================================================

    /// @notice Assign a role to an address (operator-only)
    /// @dev Only callable by accounts with OPERATOR_ROLE. Overwrites previous holder.
    ///      Does not check if newHolder is already assigned to another role (allows multi-role holders).
    /// @param role The role to assign (0-4, corresponding to Role enum)
    /// @param newHolder The new holder of the role (must not be address(0))
    /// @custom:security Requires OPERATOR_ROLE, enforced by onlyRole modifier
    /// @custom:security Validates role index < 5 and newHolder != address(0)
    function assignRole(Role role, address newHolder) external onlyRole(OPERATOR_ROLE) {
        require(uint8(role) < 5, "RoleRegistry: invalid role");
        require(newHolder != address(0), "RoleRegistry: zero address");

        uint8 roleIndex = uint8(role);
        roleHolders[roleIndex] = newHolder;

        emit RoleAssigned(roleIndex, newHolder, currentEpoch);
    }

    /// @notice Get the current holder of a role (view)
    /// @param role The role to query (0-4, corresponding to Role enum)
    /// @return holder The current holder of the role (address(0) if unassigned)
    function getRole(Role role) external view returns (address holder) {
        require(uint8(role) < 5, "RoleRegistry: invalid role");
        return roleHolders[uint8(role)];
    }

    // =========================================================================
    // Epoch Management
    // =========================================================================

    /// @notice Reset the current epoch, clearing all role assignments (operator-only)
    /// @dev Only callable by accounts with OPERATOR_ROLE.
    ///      Clears all 5 role holders and increments epoch counter.
    ///      Allows reassignment of roles for the next epoch.
    ///      Uses delete to zero out all mappings for gas efficiency.
    /// @custom:security Requires OPERATOR_ROLE, enforced by onlyRole modifier
    /// @custom:security Atomic state change: all roles cleared before epoch increment
    function resetEpoch() external onlyRole(OPERATOR_ROLE) {
        // Clear all role holders
        delete roleHolders[uint8(Role.TALENT_HUB)];
        delete roleHolders[uint8(Role.REGULATORY_POWER)];
        delete roleHolders[uint8(Role.DATA_SOVEREIGN)];
        delete roleHolders[uint8(Role.COMPUTE_SUPERPOWER)];
        delete roleHolders[uint8(Role.CHIPS_MAGNATE)];

        // Increment epoch
        ++currentEpoch;

        emit EpochReset(currentEpoch);
    }
}
