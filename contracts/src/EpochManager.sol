// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title EpochManager — Central epoch lifecycle management for MANDATE
/// @notice Phase 2: Manages epoch state transitions (start → settle → advance) for the
///         MANDATE strategy game on MegaETH (Chain ID 4326, 10ms blocks).
///         Epochs are 28-day windows. Settlement must occur before advancing to a new epoch.
/// @dev All time logic uses `block.timestamp` (not `block.number`) because MegaETH's 10ms
///      block times make block numbers unreliable for calendar-based logic.
///      This contract is intentionally minimal — it manages epoch state only. Carry-over
///      logic is executed by the operator calling individual contracts' batch functions,
///      then calling `markSettled()` before `advanceEpoch()`.
/// @custom:invariant currentEpochNumber is monotonically increasing and never decremented
/// @custom:invariant epochStartTimes[n] is immutable once written
/// @custom:invariant epochSettled must be true before advanceEpoch() can be called
/// @custom:security startFirstEpoch() can only be called once (when currentEpochNumber == 0)
/// @custom:security Only OPERATOR_ROLE can start/advance epochs; only SETTLER_ROLE can mark settled
contract EpochManager is AccessControl {
    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------

    /// @notice Duration of each epoch in seconds (28 days)
    uint256 public constant EPOCH_DURATION = 2_419_200;

    // -------------------------------------------------------------------------
    // Roles
    // -------------------------------------------------------------------------

    /// @notice Role for addresses that can start and advance epochs
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    /// @notice Role for addresses that can mark an epoch as settled after carry-over
    bytes32 public constant SETTLER_ROLE = keccak256("SETTLER_ROLE");

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    /// @notice Current epoch number (0 = no epoch started yet)
    uint256 public currentEpochNumber;

    /// @notice Timestamp when the current epoch started
    uint256 public epochStartTimestamp;

    /// @notice Whether an epoch is currently running
    bool public epochActive;

    /// @notice Whether carry-over has been executed for the current epoch
    bool public epochSettled;

    /// @notice Historical record of epoch start timestamps
    mapping(uint256 => uint256) public epochStartTimes;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    /// @notice Emitted when the first epoch begins
    /// @param epochNumber The epoch number (always 1)
    /// @param startTimestamp The block.timestamp when the epoch started
    event EpochStarted(uint256 indexed epochNumber, uint256 startTimestamp);

    /// @notice Emitted when an epoch's carry-over settlement is complete
    /// @param epochNumber The epoch that was settled
    event EpochSettled(uint256 indexed epochNumber);

    /// @notice Emitted when the epoch advances to a new period
    /// @param oldEpoch The epoch that just ended
    /// @param newEpoch The epoch that is now active
    event EpochAdvanced(uint256 indexed oldEpoch, uint256 indexed newEpoch);

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    /// @notice Thrown when a zero address is provided for admin
    error ZeroAddress();

    /// @notice Thrown when startFirstEpoch() is called but an epoch already exists
    error EpochAlreadyStarted();

    /// @notice Thrown when an operation requires an active epoch but none is running
    error EpochNotActive();

    /// @notice Thrown when the current epoch duration has not yet elapsed
    error EpochNotExpired();

    /// @notice Thrown when advanceEpoch() is called before settlement
    error EpochNotSettled();

    /// @notice Thrown when markSettled() is called but epoch is already settled
    error EpochAlreadySettled();

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /// @notice Initializes the EpochManager with an admin who receives all roles
    /// @param admin The address to receive DEFAULT_ADMIN_ROLE, OPERATOR_ROLE, and SETTLER_ROLE
    constructor(address admin) {
        if (admin == address(0)) revert ZeroAddress();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);
        _grantRole(SETTLER_ROLE, admin);
    }

    // -------------------------------------------------------------------------
    // Epoch Lifecycle
    // -------------------------------------------------------------------------

    /// @notice Starts the very first epoch. Can only be called once.
    /// @dev Sets currentEpochNumber to 1 and records the start timestamp.
    ///      After this call, the epoch is active and the 28-day countdown begins.
    function startFirstEpoch() external onlyRole(OPERATOR_ROLE) {
        if (currentEpochNumber != 0) revert EpochAlreadyStarted();

        currentEpochNumber = 1;
        epochStartTimestamp = block.timestamp;
        epochActive = true;

        epochStartTimes[1] = block.timestamp;

        emit EpochStarted(1, block.timestamp);
    }

    /// @notice Advances to the next epoch after the current one has expired and been settled.
    /// @dev The operator must first ensure all carry-over logic has been executed and
    ///      `markSettled()` has been called before this function will succeed.
    function advanceEpoch() external onlyRole(OPERATOR_ROLE) {
        if (!epochActive) revert EpochNotActive();
        if (block.timestamp < epochStartTimestamp + EPOCH_DURATION) revert EpochNotExpired(); // D: D0{sec} < D0{sec} + D0{sec} ✓
        if (!epochSettled) revert EpochNotSettled();

        uint256 oldEpoch = currentEpochNumber;
        currentEpochNumber += 1;
        epochStartTimestamp = block.timestamp;
        epochSettled = false;

        epochStartTimes[currentEpochNumber] = block.timestamp;

        emit EpochAdvanced(oldEpoch, currentEpochNumber);
    }

    /// @notice Marks the current epoch as settled after carry-over has been executed.
    /// @dev Called by the settler after executing all carry-over batch operations.
    ///      The epoch must have expired (duration elapsed) before settlement is allowed.
    function markSettled() external onlyRole(SETTLER_ROLE) {
        if (!epochActive) revert EpochNotActive();
        if (epochSettled) revert EpochAlreadySettled();
        if (block.timestamp < epochStartTimestamp + EPOCH_DURATION) revert EpochNotExpired(); // D: D0{sec} < D0{sec} + D0{sec} ✓

        epochSettled = true;

        emit EpochSettled(currentEpochNumber);
    }

    // -------------------------------------------------------------------------
    // View Functions
    // -------------------------------------------------------------------------

    /// @notice Returns the current epoch number (0 if no epoch has started)
    /// @return The current epoch number
    function getCurrentEpoch() external view returns (uint256) {
        return currentEpochNumber;
    }

    /// @notice Returns the epoch duration in seconds
    /// @return The epoch duration (28 days = 2,419,200 seconds)
    function getEpochDuration() external pure returns (uint256) {
        return EPOCH_DURATION;
    }

    /// @notice Returns the start timestamp of the current epoch
    /// @return The block.timestamp when the current epoch started
    function getEpochStartTimestamp() external view returns (uint256) {
        return epochStartTimestamp;
    }

    /// @notice Returns whether an epoch is currently active
    /// @return True if an epoch is running
    function isEpochActive() external view returns (bool) {
        return epochActive;
    }

    /// @notice Returns whether the current epoch has expired (duration elapsed)
    /// @return True if an epoch is active and its duration has elapsed
    function isEpochExpired() external view returns (bool) {
        return epochActive && block.timestamp >= epochStartTimestamp + EPOCH_DURATION; // D: D0{sec} >= D0{sec} + D0{sec} ✓
    }

    /// @notice Returns the timestamp when the current epoch ends
    /// @return The epoch start timestamp plus EPOCH_DURATION
    function getEpochEndTimestamp() external view returns (uint256) {
        return epochStartTimestamp + EPOCH_DURATION; // D: D0{sec} + D0{sec} = D0{sec} ✓
    }
}
