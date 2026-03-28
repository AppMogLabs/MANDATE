// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

/// @title ReflexWindowManager
/// @notice Manages 100-second reflex windows for pre-approved agent actions after EventOracle publication
/// @dev Tracks reflex window state and prevents double-spend via nonce management
/// @custom:invariant REFLEX_DURATION = 100 seconds (fixed window duration)
/// @custom:invariant active == true implies endTimestamp > startTimestamp (valid window)
/// @custom:invariant usedNonces[agent][eventId] == true implies agent cannot reuse that nonce
/// @custom:invariant openWindow requires ORACLE_ROLE, closeWindow requires OPERATOR_ROLE or automatic expiry
/// @custom:security Nonce management prevents double-spend attacks (one action per agent per event)
/// @custom:security AccessControl enforces ORACLE_ROLE for window opening
contract ReflexWindowManager is AccessControl {
    /// @notice Duration of reflex window in seconds (100 milliseconds = 0.1 seconds)
    uint64 public constant REFLEX_DURATION = 100;
    
    /// @notice Role identifier for EventOracle
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    
    /// @notice Role identifier for operator (manual window closing)
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    
    /// @notice Reflex window structure
    struct ReflexWindow {
        uint64 startTimestamp;
        uint64 endTimestamp;
        bool active;
    }
    
    /// @notice Mapping of eventId => ReflexWindow
    mapping(uint256 => ReflexWindow) public reflexWindows;
    
    /// @notice Mapping of agent => eventId => nonce used
    /// @dev Prevents double-spend: once an agent uses their nonce for an eventId, they can't again
    mapping(address => mapping(uint256 => bool)) public usedNonces;
    
    // ============ Events ============
    
    /// @notice Emitted when a reflex window opens
    event ReflexWindowOpened(uint256 indexed eventId, uint64 startTimestamp, uint64 endTimestamp);
    
    /// @notice Emitted when a reflex window closes
    event ReflexWindowClosed(uint256 indexed eventId);
    
    /// @notice Emitted when an agent's nonce is marked as used
    event NonceUsed(address indexed agent, uint256 indexed eventId);
    
    // ============ Constructor ============
    
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }
    
    // ============ Window Management ============
    
    /// @notice Open a reflex window for a given eventId
    /// @param eventId The ID of the event triggering the reflex window
    /// @dev Can only be called by ORACLE_ROLE (EventOracle)
    /// @dev Sets window to [block.timestamp, block.timestamp + REFLEX_DURATION]
    function openReflexWindow(uint256 eventId) external onlyRole(ORACLE_ROLE) {
        uint64 startTime = uint64(block.timestamp); // D: D0{sec}
        uint64 endTime = startTime + REFLEX_DURATION; // D: D0{sec} = D0{sec} + D0{sec} ✓
        
        reflexWindows[eventId] = ReflexWindow({
            startTimestamp: startTime,
            endTimestamp: endTime,
            active: true
        });
        
        emit ReflexWindowOpened(eventId, startTime, endTime);
    }
    
    /// @notice Close a reflex window
    /// @param eventId The ID of the event whose reflex window should close
    /// @dev Can only be called by OPERATOR_ROLE
    /// @dev Marks window as inactive immediately (doesn't wait for timeout)
    function closeReflexWindow(uint256 eventId) external onlyRole(OPERATOR_ROLE) {
        reflexWindows[eventId].active = false;
        emit ReflexWindowClosed(eventId);
    }
    
    // ============ Window Query ============
    
    /// @notice Check if a reflex window is currently active
    /// @param eventId The ID of the event to check
    /// @return True if the window exists, is active, and block.timestamp <= endTimestamp
    function isReflexActive(uint256 eventId) external view returns (bool) {
        ReflexWindow storage window = reflexWindows[eventId];
        
        // Window must be marked active and within time bounds
        return window.active && block.timestamp <= window.endTimestamp; // D: D0{sec} <= D0{sec} ✓
    }
    
    /// @notice Get the full reflex window details
    /// @param eventId The ID of the event
    /// @return ReflexWindow struct with startTimestamp, endTimestamp, active
    function getReflexWindow(uint256 eventId) external view returns (ReflexWindow memory) {
        return reflexWindows[eventId];
    }
    
    // ============ Nonce Management ============
    
    /// @notice Mark an agent's nonce as used for a given eventId
    /// @param agent The agent address
    /// @param eventId The event ID
    /// @dev Prevents double-spend: agent can only use their reflex action once per eventId
    /// @dev Called by OrderBook after executeReflexCancellation()
    function markNonceUsed(address agent, uint256 eventId) external {
        usedNonces[agent][eventId] = true;
        emit NonceUsed(agent, eventId);
    }
    
    /// @notice Check if an agent has already used their nonce for a given eventId
    /// @param agent The agent address
    /// @param eventId The event ID
    /// @return True if the nonce has been used
    function hasUsedNonce(address agent, uint256 eventId) external view returns (bool) {
        return usedNonces[agent][eventId];
    }
}
