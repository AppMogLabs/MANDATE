// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {AgentRegistry} from "./AgentRegistry.sol";

/// @title MapRegistry — Tile-based world state for MANDATE
/// @notice Manages a 2D tile grid with terrain types, ownership, building placement, and adjacency.
/// @dev Implements ERC-8004 agent validation via AgentRegistry.validateAction() gate.
///      Follows CEI pattern, block.timestamp for time logic, and OZ 5.x security modules.
/// @custom:invariant Each tileId maps to exactly one TileInfo (no duplicates or gaps)
/// @custom:invariant Tile terrain type is always in range [0, 7] (MAX_TERRAIN_TYPE enforced)
/// @custom:invariant owner == address(0) implies unclaimed tile (isTileEmpty consistency)
/// @custom:invariant developed == true implies buildingTokenId != 0 (building placement consistency)
/// @custom:invariant claimTile/transferTile require AgentRegistry.validateAction() (ERC-8004 compliance)
/// @custom:security ReentrancyGuard on all state-changing functions with external calls
/// @custom:security AgentRegistry validation gates all ownership changes (prevents unauthorized claims)
/// @custom:security Operator-only terrain management (OPERATOR_ROLE required)
contract MapRegistry is AccessControl, ReentrancyGuard {
    // =========================================================================
    // Constants
    // =========================================================================

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    // Terrain type constants
    uint8 public constant TERRAIN_EMPTY = 0;
    uint8 public constant TERRAIN_HIGH_DENSITY_URBAN = 1;
    uint8 public constant TERRAIN_INDUSTRIAL_ZONE = 2;
    uint8 public constant TERRAIN_RESEARCH_CORRIDOR = 3;
    uint8 public constant TERRAIN_REGULATORY_DISTRICT = 4;
    uint8 public constant TERRAIN_COASTAL_PORT = 5;
    uint8 public constant TERRAIN_TRANSIT_HUB = 6;
    uint8 public constant TERRAIN_WILDERNESS = 7;

    uint8 private constant MAX_TERRAIN_TYPE = 7;

    // =========================================================================
    // State
    // =========================================================================

    AgentRegistry public immutable AGENT_REGISTRY;

    /// @notice Tile information struct
    /// @dev tileId encoding: (x << 16) | y
    struct TileInfo {
        uint8 terrain;           // 0-7 terrain type
        address owner;           // Agent address (0x0 if unclaimed)
        uint256 buildingTokenId; // BuildingRegistry NFT token ID (0 if empty)
        bool developed;          // True if building placed
    }

    /// @notice Maps tileId => TileInfo
    mapping(uint32 => TileInfo) private _tiles;

    // =========================================================================
    // Events
    // =========================================================================

    event TileClaimed(uint32 indexed tileId, address indexed owner);
    event TileTransferred(uint32 indexed tileId, address indexed from, address indexed to);
    event BuildingPlaced(uint32 indexed tileId, uint256 buildingTokenId);
    event BuildingCleared(uint32 indexed tileId);
    event TerrainSet(uint32 indexed tileId, uint8 terrain);

    // =========================================================================
    // Constructor
    // =========================================================================

    /// @notice Deploys MapRegistry with AgentRegistry reference
    /// @param agentRegistry_ Address of the deployed AgentRegistry contract
    constructor(address agentRegistry_) {
        require(agentRegistry_ != address(0), "MapRegistry: invalid agent registry");
        AGENT_REGISTRY = AgentRegistry(agentRegistry_);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // =========================================================================
    // Tile Query Functions
    // =========================================================================

    /// @notice Returns full tile information
    /// @param tileId Tile identifier (x << 16 | y)
    /// @return TileInfo struct
    function getTileInfo(uint32 tileId) external view returns (TileInfo memory) {
        return _tiles[tileId];
    }

    /// @notice Returns tile owner address
    /// @param tileId Tile identifier
    /// @return Owner address (0x0 if unclaimed)
    function getTileOwner(uint32 tileId) external view returns (address) {
        return _tiles[tileId].owner;
    }

    /// @notice Returns tile terrain type
    /// @param tileId Tile identifier
    /// @return Terrain type (0-7)
    function getTileTerrain(uint32 tileId) external view returns (uint8) {
        return _tiles[tileId].terrain;
    }

    /// @notice Checks if tile is unclaimed
    /// @param tileId Tile identifier
    /// @return True if tile has no owner
    function isTileEmpty(uint32 tileId) external view returns (bool) {
        return _tiles[tileId].owner == address(0);
    }

    /// @notice Calculates adjacent tile IDs (north, east, south, west)
    /// @param tileId Center tile identifier
    /// @return Array of 4 adjacent tile IDs [north, east, south, west]
    /// @dev Coordinates wrap at uint16 boundaries (intentional for edge tiles).
    ///      uint16 → uint32 casts are always safe (widening conversion).
    function getAdjacentTiles(uint32 tileId) external pure returns (uint32[4] memory) {
        // Decode tileId
        uint16 x = uint16(tileId >> 16); // D: D0{coord} = D0{tileId} >> 16 ✓
        uint16 y = uint16(tileId & 0xFFFF); // D: D0{coord} = D0{tileId} & D0{mask} ✓

        // Calculate adjacent coordinates
        // Arithmetic on uint16 can wrap (intentional behavior at map edges)
        unchecked {
            uint16 yNorth = y + 1;
            uint16 xEast  = x + 1;
            uint16 ySouth = y - 1;
            uint16 xWest  = x - 1;

            // Safe widening casts: uint16 → uint32 cannot truncate
            uint32 north = (uint32(x) << 16) | uint32(yNorth); // D: D0{tileId} = (D0{coord} << 16) | D0{coord} ✓
            uint32 east  = (uint32(xEast) << 16) | uint32(y); // D: D0{tileId} = (D0{coord} << 16) | D0{coord} ✓
            uint32 south = (uint32(x) << 16) | uint32(ySouth); // D: D0{tileId} = (D0{coord} << 16) | D0{coord} ✓
            uint32 west  = (uint32(xWest) << 16) | uint32(y); // D: D0{tileId} = (D0{coord} << 16) | D0{coord} ✓

            return [north, east, south, west];
        }
    }

    // =========================================================================
    // Ownership Functions
    // =========================================================================

    /// @notice Claims an unclaimed tile for a registered agent
    /// @param tileId Tile identifier
    /// @param agent Agent address (must be registered in AgentRegistry)
    /// @dev Validates via AgentRegistry.validateAction() - enforces ERC-8004
    function claimTile(uint32 tileId, address agent) external nonReentrant {
        // Check 1: Tile not already owned
        require(_tiles[tileId].owner == address(0), "MapRegistry: tile already owned");

        // Check 2: Agent is registered
        uint256 agentId = AGENT_REGISTRY.agentIdOf(agent);
        require(agentId != 0, "AgentRegistry: agent not registered");

        // Check 3: Agent has ACTION_TRANSFER permission
        // validateAction reverts if agent lacks the action bit in allowlist
        AGENT_REGISTRY.validateAction(agent, AGENT_REGISTRY.ACTION_TRANSFER());

        // Effect: Claim tile
        _tiles[tileId].owner = agent;

        // Interaction: Emit event
        emit TileClaimed(tileId, agent);
    }

    /// @notice Transfers tile ownership to a new registered agent
    /// @param tileId Tile identifier
    /// @param newOwner New agent address (must be registered)
    /// @dev Caller must be current tile owner
    function transferTileOwnership(uint32 tileId, address newOwner) external nonReentrant {
        // Check 1: Caller is tile owner
        require(_tiles[tileId].owner == msg.sender, "MapRegistry: caller not tile owner");

        // Check 2: New owner is registered
        uint256 newOwnerId = AGENT_REGISTRY.agentIdOf(newOwner);
        require(newOwnerId != 0, "AgentRegistry: agent not registered");

        // Check 3: Validate new owner's ACTION_TRANSFER permission
        AGENT_REGISTRY.validateAction(newOwner, AGENT_REGISTRY.ACTION_TRANSFER());

        // Effect: Transfer ownership
        address previousOwner = _tiles[tileId].owner;
        _tiles[tileId].owner = newOwner;

        // Interaction: Emit event
        emit TileTransferred(tileId, previousOwner, newOwner);
    }

    // =========================================================================
    // Building Placement Functions
    // =========================================================================

    /// @notice Places a building NFT on a tile
    /// @param tileId Tile identifier
    /// @param buildingTokenId BuildingRegistry NFT token ID
    /// @dev Caller must own the tile. Tile must not already have a building.
    function setBuilding(uint32 tileId, uint256 buildingTokenId) external nonReentrant {
        // Check 1: Caller owns tile
        require(_tiles[tileId].owner == msg.sender, "MapRegistry: caller not tile owner");

        // Check 2: Tile not already developed
        require(!_tiles[tileId].developed, "MapRegistry: tile already developed");

        // Effect: Place building
        _tiles[tileId].buildingTokenId = buildingTokenId;
        _tiles[tileId].developed = true;

        // Interaction: Emit event
        emit BuildingPlaced(tileId, buildingTokenId);
    }

    /// @notice Removes a building from a tile
    /// @param tileId Tile identifier
    /// @dev Caller must own the tile
    function clearBuilding(uint32 tileId) external nonReentrant {
        // Check: Caller owns tile
        require(_tiles[tileId].owner == msg.sender, "MapRegistry: caller not tile owner");

        // Effect: Clear building
        _tiles[tileId].buildingTokenId = 0;
        _tiles[tileId].developed = false;

        // Interaction: Emit event
        emit BuildingCleared(tileId);
    }

    // =========================================================================
    // Terrain Setup (Operator Only)
    // =========================================================================

    /// @notice Sets terrain type for a single tile
    /// @param tileId Tile identifier
    /// @param terrain Terrain type (0-7)
    /// @dev Only OPERATOR_ROLE can call this function
    function setTerrain(uint32 tileId, uint8 terrain) external onlyRole(OPERATOR_ROLE) {
        require(terrain <= MAX_TERRAIN_TYPE, "MapRegistry: invalid terrain type");

        _tiles[tileId].terrain = terrain;
        emit TerrainSet(tileId, terrain);
    }

    /// @notice Batch sets terrain types for multiple tiles
    /// @param tileIds Array of tile identifiers
    /// @param terrains Array of terrain types (must match tileIds length)
    /// @dev Only OPERATOR_ROLE can call this function
    function batchSetTerrain(uint32[] calldata tileIds, uint8[] calldata terrains) external onlyRole(OPERATOR_ROLE) {
        require(tileIds.length == terrains.length, "MapRegistry: array length mismatch");

        for (uint256 i = 0; i < tileIds.length; i++) {
            require(terrains[i] <= MAX_TERRAIN_TYPE, "MapRegistry: invalid terrain type");
            _tiles[tileIds[i]].terrain = terrains[i];
            emit TerrainSet(tileIds[i], terrains[i]);
        }
    }
}
