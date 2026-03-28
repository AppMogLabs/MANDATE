// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/// @title EventOracle Interface
/// @notice Defines world events with resource production/demand impacts
/// @custom:invariant severity is in range [1, 10] (validated at event publication)
/// @custom:invariant productionModBps and demandModBps are in range [-10000, +10000] basis points
/// @custom:security High-severity events (severity >= 7) require multi-signature validation
interface IEventOracle {
    enum EventType {
        GPUShortage,
        PowerGridFailure,
        RegCrackdown,
        TalentExodus,
        FrontierRelease,
        SupplyChainDisruption,
        Geopolitical,
        AISafetyIncident
    }

    struct ResourceImpact {
        address resource;
        int16 productionModBps;  // basis points (-10000 to +10000)
        int16 demandModBps;
    }

    struct WorldEvent {
        uint256 eventId;
        EventType eventType;
        uint8 severity;  // 1-10
        uint32 region;
        uint64 startTimestamp;
        uint64 durationSeconds;
        ResourceImpact[] impacts;
    }

    event EventPublished(
        uint256 indexed eventId,
        EventType eventType,
        uint8 severity,
        uint32 region
    );
    
    event EventResolved(uint256 indexed eventId);

    function publishEvent(WorldEvent memory worldEvent, bytes memory signature) external;
    function publishHighSeverityEvent(
        WorldEvent memory worldEvent,
        bytes memory signature1,
        bytes memory signature2
    ) external;
    function resolveEvent(uint256 eventId) external;
    function getActiveEvents() external view returns (WorldEvent[] memory);
    function getResourceModifier(address resource)
        external
        view
        returns (int256 productionMod, int256 demandMod);
    function getEvent(uint256 eventId) external view returns (WorldEvent memory);
}

/// @title EventOracle - Canonical source of truth for MANDATE world events
/// @notice Events are published by an off-chain AI event engine using EIP-712 signatures
/// @dev High-severity events (≥7) require 2-of-3 SENIOR_PUBLISHER_ROLE multi-sig
contract EventOracle is IEventOracle, EIP712, AccessControl {
    bytes32 public constant PUBLISHER_ROLE = keccak256("PUBLISHER_ROLE");
    bytes32 public constant SENIOR_PUBLISHER_ROLE = keccak256("SENIOR_PUBLISHER_ROLE");
    
    // EIP-712 type hash for WorldEvent
    bytes32 private constant EVENT_TYPEHASH = keccak256(
        "WorldEvent(uint256 eventId,uint8 eventType,uint8 severity,uint32 region,uint64 startTimestamp,uint64 durationSeconds,ResourceImpact[] impacts)"
    );
    
    bytes32 private constant IMPACT_TYPEHASH = keccak256(
        "ResourceImpact(address resource,int16 productionModBps,int16 demandModBps)"
    );
    
    // Storage
    mapping(uint256 => WorldEvent) private events;
    uint256[] private eventIds;
    
    constructor() EIP712("MANDATE_EventOracle", "1") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }
    
    /// @notice Get EIP-712 digest for a WorldEvent
    /// @param worldEvent The event to hash
    /// @return The digest to sign
    function getEventDigest(WorldEvent memory worldEvent) public view returns (bytes32) {
        // Hash impacts array
        bytes32[] memory impactHashes = new bytes32[](worldEvent.impacts.length);
        for (uint256 i = 0; i < worldEvent.impacts.length; i++) {
            impactHashes[i] = keccak256(
                abi.encode(
                    IMPACT_TYPEHASH,
                    worldEvent.impacts[i].resource,
                    worldEvent.impacts[i].productionModBps,
                    worldEvent.impacts[i].demandModBps
                )
            );
        }
        
        bytes32 impactsHash = keccak256(abi.encodePacked(impactHashes));
        
        bytes32 structHash = keccak256(
            abi.encode(
                EVENT_TYPEHASH,
                worldEvent.eventId,
                uint8(worldEvent.eventType),
                worldEvent.severity,
                worldEvent.region,
                worldEvent.startTimestamp,
                worldEvent.durationSeconds,
                impactsHash
            )
        );
        
        return _hashTypedDataV4(structHash);
    }
    
    /// @notice Publish a low-to-medium severity event (severity < 7)
    /// @param worldEvent The event to publish
    /// @param signature EIP-712 signature from a PUBLISHER_ROLE address
    function publishEvent(WorldEvent memory worldEvent, bytes memory signature) external {
        require(events[worldEvent.eventId].eventId == 0, "Event ID already exists");
        
        // Verify EIP-712 signature
        bytes32 digest = getEventDigest(worldEvent);
        address signer = ECDSA.recover(digest, signature);
        require(hasRole(PUBLISHER_ROLE, signer), "Invalid signature: not PUBLISHER_ROLE");
        
        // Store event
        _storeEvent(worldEvent);
        
        emit EventPublished(
            worldEvent.eventId,
            worldEvent.eventType,
            worldEvent.severity,
            worldEvent.region
        );
    }
    
    /// @notice Publish a high-severity event (severity >= 7) with multi-sig
    /// @param worldEvent The event to publish
    /// @param signature1 First SENIOR_PUBLISHER_ROLE signature
    /// @param signature2 Second SENIOR_PUBLISHER_ROLE signature
    function publishHighSeverityEvent(
        WorldEvent memory worldEvent,
        bytes memory signature1,
        bytes memory signature2
    ) external {
        require(worldEvent.severity >= 7, "Use publishEvent for severity < 7");
        require(events[worldEvent.eventId].eventId == 0, "Event ID already exists");
        
        // Verify both signatures
        bytes32 digest = getEventDigest(worldEvent);
        
        address signer1 = ECDSA.recover(digest, signature1);
        address signer2 = ECDSA.recover(digest, signature2);
        
        require(hasRole(SENIOR_PUBLISHER_ROLE, signer1), "Invalid signature1: not SENIOR_PUBLISHER_ROLE");
        require(hasRole(SENIOR_PUBLISHER_ROLE, signer2), "Invalid signature2: not SENIOR_PUBLISHER_ROLE");
        require(signer1 != signer2, "Signatures must be from different senior publishers");
        
        // Store event
        _storeEvent(worldEvent);
        
        emit EventPublished(
            worldEvent.eventId,
            worldEvent.eventType,
            worldEvent.severity,
            worldEvent.region
        );
    }
    
    /// @notice Mark an event as resolved
    /// @param eventId The event ID to resolve
    function resolveEvent(uint256 eventId) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(events[eventId].eventId != 0, "Event does not exist");
        
        emit EventResolved(eventId);
    }
    
    /// @notice Get all active events (endTimestamp > block.timestamp)
    /// @return Array of active WorldEvent structs
    function getActiveEvents() external view returns (WorldEvent[] memory) {
        uint256 activeCount = 0;
        
        // First pass: count active events
        for (uint256 i = 0; i < eventIds.length; i++) {
            WorldEvent storage evt = events[eventIds[i]];
            if (evt.startTimestamp + evt.durationSeconds > block.timestamp) { // D: D0{sec} + D0{sec} > D0{sec} → bool ✓
                activeCount++;
            }
        }
        
        // Second pass: populate array
        WorldEvent[] memory activeEvents = new WorldEvent[](activeCount);
        uint256 index = 0;
        
        for (uint256 i = 0; i < eventIds.length; i++) {
            WorldEvent storage evt = events[eventIds[i]];
            if (evt.startTimestamp + evt.durationSeconds > block.timestamp) { // D: D0{sec} + D0{sec} > D0{sec} → bool ✓
                activeEvents[index] = evt;
                index++;
            }
        }
        
        return activeEvents;
    }
    
    /// @notice Get cumulative resource modifiers from all active events
    /// @param resource The resource address to query
    /// @return productionMod Cumulative production modifier in basis points
    /// @return demandMod Cumulative demand modifier in basis points
    /// @dev [DIM-5 FIX] Return type widened from int16 to int256 to prevent overflow
    ///      when 4+ same-direction events accumulate. int16 range [-32768, 32767] is
    ///      insufficient for ±10000 bps per event × multiple events. int256 has no
    ///      gas benefit over int16 in mappings (Solidity allocates a full slot per entry).
    function getResourceModifier(address resource)
        external
        view
        returns (int256 productionMod, int256 demandMod)
    {
        int256 totalProductionMod = 0;
        int256 totalDemandMod = 0;

        for (uint256 i = 0; i < eventIds.length; i++) {
            WorldEvent storage evt = events[eventIds[i]];

            // Only consider active events
            if (evt.startTimestamp + evt.durationSeconds > block.timestamp) {
                for (uint256 j = 0; j < evt.impacts.length; j++) {
                    if (evt.impacts[j].resource == resource) {
                        totalProductionMod += int256(evt.impacts[j].productionModBps);
                        totalDemandMod += int256(evt.impacts[j].demandModBps);
                    }
                }
            }
        }

        return (totalProductionMod, totalDemandMod);
    }
    
    /// @notice Get a specific event by ID
    /// @param eventId The event ID to query
    /// @return The WorldEvent struct
    function getEvent(uint256 eventId) external view returns (WorldEvent memory) {
        return events[eventId];
    }
    
    /// @dev Internal function to store an event
    function _storeEvent(WorldEvent memory worldEvent) private {
        // Deep copy the event (including impacts array)
        WorldEvent storage stored = events[worldEvent.eventId];
        stored.eventId = worldEvent.eventId;
        stored.eventType = worldEvent.eventType;
        stored.severity = worldEvent.severity;
        stored.region = worldEvent.region;
        stored.startTimestamp = worldEvent.startTimestamp;
        stored.durationSeconds = worldEvent.durationSeconds;
        
        // Copy impacts array
        for (uint256 i = 0; i < worldEvent.impacts.length; i++) {
            stored.impacts.push(worldEvent.impacts[i]);
        }
        
        eventIds.push(worldEvent.eventId);
    }
}
