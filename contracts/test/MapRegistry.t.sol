// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {MapRegistry} from "../src/MapRegistry.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";

/// @title MapRegistry Test Suite
/// @notice Comprehensive tests for tile grid, terrain, ownership, building placement, and adjacency
contract MapRegistryTest is Test {
    MapRegistry public mapRegistry;
    AgentRegistry public agentRegistry;

    address public operator = address(1);
    address public agent1 = address(2);
    address public agent2 = address(3);
    address public unregisteredAgent = address(4);

    uint256 public agent1Id;
    uint256 public agent2Id;

    // Tile IDs for testing (x << 16 | y)
    uint32 public tile_10_20 = (10 << 16) | 20; // (10, 20)
    uint32 public tile_11_20 = (11 << 16) | 20; // (11, 20) - east of tile_10_20
    uint32 public tile_10_21 = (10 << 16) | 21; // (10, 21) - north of tile_10_20
    uint32 public tile_9_20  = (9 << 16)  | 20; // (9, 20)  - west of tile_10_20
    uint32 public tile_10_19 = (10 << 16) | 19; // (10, 19) - south of tile_10_20

    function setUp() public {
        // Deploy AgentRegistry (Sprint 0 contract)
        vm.startPrank(operator);
        agentRegistry = new AgentRegistry(operator);
        agentRegistry.grantRole(agentRegistry.REGISTRAR_ROLE(), operator);
        agentRegistry.grantRole(agentRegistry.OPERATOR_ROLE(), operator);

        // Register agents
        agent1Id = agentRegistry.registerAgent(agent1, "ipfs://agent1");
        agent2Id = agentRegistry.registerAgent(agent2, "ipfs://agent2");

        // Grant ACTION_TRANSFER (bit 0) to both agents
        agentRegistry.grantAction(agent1Id, agentRegistry.ACTION_TRANSFER());
        agentRegistry.grantAction(agent2Id, agentRegistry.ACTION_TRANSFER());

        // Deploy MapRegistry
        mapRegistry = new MapRegistry(address(agentRegistry));
        mapRegistry.grantRole(mapRegistry.OPERATOR_ROLE(), operator);
        vm.stopPrank();
    }

    // =========================================================================
    // Terrain Constants Tests
    // =========================================================================

    function test_TerrainConstants() public view {
        assertEq(mapRegistry.TERRAIN_EMPTY(), 0);
        assertEq(mapRegistry.TERRAIN_HIGH_DENSITY_URBAN(), 1);
        assertEq(mapRegistry.TERRAIN_INDUSTRIAL_ZONE(), 2);
        assertEq(mapRegistry.TERRAIN_RESEARCH_CORRIDOR(), 3);
        assertEq(mapRegistry.TERRAIN_REGULATORY_DISTRICT(), 4);
        assertEq(mapRegistry.TERRAIN_COASTAL_PORT(), 5);
        assertEq(mapRegistry.TERRAIN_TRANSIT_HUB(), 6);
        assertEq(mapRegistry.TERRAIN_WILDERNESS(), 7);
    }

    // =========================================================================
    // Tile Query Tests
    // =========================================================================

    function test_GetTileInfo_EmptyTile() public view {
        MapRegistry.TileInfo memory tile = mapRegistry.getTileInfo(tile_10_20);
        assertEq(tile.terrain, 0);
        assertEq(tile.owner, address(0));
        assertEq(tile.buildingTokenId, 0);
        assertFalse(tile.developed);
    }

    function test_IsTileEmpty_DefaultIsTrue() public view {
        assertTrue(mapRegistry.isTileEmpty(tile_10_20));
    }

    function test_GetTileOwner_UnclaimedTile() public view {
        assertEq(mapRegistry.getTileOwner(tile_10_20), address(0));
    }

    function test_GetTileTerrain_DefaultIsEmpty() public view {
        assertEq(mapRegistry.getTileTerrain(tile_10_20), 0);
    }

    // =========================================================================
    // Claim Tile Tests
    // =========================================================================

    function test_ClaimTile_RegisteredAgent() public {
        vm.prank(agent1);
        vm.expectEmit(true, true, false, false);
        emit MapRegistry.TileClaimed(tile_10_20, agent1);
        mapRegistry.claimTile(tile_10_20, agent1);

        assertEq(mapRegistry.getTileOwner(tile_10_20), agent1);
        assertFalse(mapRegistry.isTileEmpty(tile_10_20));
    }

    function test_ClaimTile_RevertsIfUnregistered() public {
        vm.prank(unregisteredAgent);
        vm.expectRevert("AgentRegistry: agent not registered");
        mapRegistry.claimTile(tile_10_20, unregisteredAgent);
    }

    function test_ClaimTile_RevertsIfAlreadyOwned() public {
        vm.prank(agent1);
        mapRegistry.claimTile(tile_10_20, agent1);

        vm.prank(agent2);
        vm.expectRevert("MapRegistry: tile already owned");
        mapRegistry.claimTile(tile_10_20, agent2);
    }

    // =========================================================================
    // Transfer Ownership Tests
    // =========================================================================

    function test_TransferTileOwnership_Success() public {
        vm.prank(agent1);
        mapRegistry.claimTile(tile_10_20, agent1);

        vm.prank(agent1);
        vm.expectEmit(true, true, true, false);
        emit MapRegistry.TileTransferred(tile_10_20, agent1, agent2);
        mapRegistry.transferTileOwnership(tile_10_20, agent2);

        assertEq(mapRegistry.getTileOwner(tile_10_20), agent2);
    }

    function test_TransferTileOwnership_RevertsIfNotOwner() public {
        vm.prank(agent1);
        mapRegistry.claimTile(tile_10_20, agent1);

        vm.prank(agent2);
        vm.expectRevert("MapRegistry: caller not tile owner");
        mapRegistry.transferTileOwnership(tile_10_20, agent2);
    }

    function test_TransferTileOwnership_RevertsIfNewOwnerUnregistered() public {
        vm.prank(agent1);
        mapRegistry.claimTile(tile_10_20, agent1);

        vm.prank(agent1);
        vm.expectRevert("AgentRegistry: agent not registered");
        mapRegistry.transferTileOwnership(tile_10_20, unregisteredAgent);
    }

    // =========================================================================
    // Building Placement Tests
    // =========================================================================

    function test_SetBuilding_Success() public {
        vm.prank(agent1);
        mapRegistry.claimTile(tile_10_20, agent1);

        uint256 buildingTokenId = 42;

        vm.prank(agent1);
        vm.expectEmit(true, false, false, true);
        emit MapRegistry.BuildingPlaced(tile_10_20, buildingTokenId);
        mapRegistry.setBuilding(tile_10_20, buildingTokenId);

        MapRegistry.TileInfo memory tile = mapRegistry.getTileInfo(tile_10_20);
        assertEq(tile.buildingTokenId, buildingTokenId);
        assertTrue(tile.developed);
    }

    function test_SetBuilding_RevertsIfNotOwner() public {
        vm.prank(agent1);
        mapRegistry.claimTile(tile_10_20, agent1);

        vm.prank(agent2);
        vm.expectRevert("MapRegistry: caller not tile owner");
        mapRegistry.setBuilding(tile_10_20, 42);
    }

    function test_SetBuilding_RevertsIfAlreadyDeveloped() public {
        vm.startPrank(agent1);
        mapRegistry.claimTile(tile_10_20, agent1);
        mapRegistry.setBuilding(tile_10_20, 42);

        vm.expectRevert("MapRegistry: tile already developed");
        mapRegistry.setBuilding(tile_10_20, 99);
        vm.stopPrank();
    }

    function test_ClearBuilding_Success() public {
        vm.startPrank(agent1);
        mapRegistry.claimTile(tile_10_20, agent1);
        mapRegistry.setBuilding(tile_10_20, 42);

        vm.expectEmit(true, false, false, false);
        emit MapRegistry.BuildingCleared(tile_10_20);
        mapRegistry.clearBuilding(tile_10_20);
        vm.stopPrank();

        MapRegistry.TileInfo memory tile = mapRegistry.getTileInfo(tile_10_20);
        assertEq(tile.buildingTokenId, 0);
        assertFalse(tile.developed);
    }

    function test_ClearBuilding_RevertsIfNotOwner() public {
        vm.startPrank(agent1);
        mapRegistry.claimTile(tile_10_20, agent1);
        mapRegistry.setBuilding(tile_10_20, 42);
        vm.stopPrank();

        vm.prank(agent2);
        vm.expectRevert("MapRegistry: caller not tile owner");
        mapRegistry.clearBuilding(tile_10_20);
    }

    // =========================================================================
    // Terrain Setup Tests (Operator Only)
    // =========================================================================

    function test_SetTerrain_OperatorOnly() public {
        uint8 terrainType = mapRegistry.TERRAIN_HIGH_DENSITY_URBAN();
        
        vm.prank(operator);
        vm.expectEmit(true, false, false, true);
        emit MapRegistry.TerrainSet(tile_10_20, terrainType);
        mapRegistry.setTerrain(tile_10_20, terrainType);

        assertEq(mapRegistry.getTileTerrain(tile_10_20), 1);
    }

    function test_SetTerrain_RevertsIfNotOperator() public {
        vm.prank(agent1);
        vm.expectRevert();
        mapRegistry.setTerrain(tile_10_20, 1);
    }

    function test_SetTerrain_RevertsIfInvalidTerrainType() public {
        vm.prank(operator);
        vm.expectRevert("MapRegistry: invalid terrain type");
        mapRegistry.setTerrain(tile_10_20, 99);
    }

    function test_BatchSetTerrain_Success() public {
        uint32[] memory tileIds = new uint32[](3);
        tileIds[0] = tile_10_20;
        tileIds[1] = tile_11_20;
        tileIds[2] = tile_10_21;

        uint8[] memory terrains = new uint8[](3);
        terrains[0] = mapRegistry.TERRAIN_HIGH_DENSITY_URBAN();
        terrains[1] = mapRegistry.TERRAIN_INDUSTRIAL_ZONE();
        terrains[2] = mapRegistry.TERRAIN_COASTAL_PORT();

        vm.prank(operator);
        mapRegistry.batchSetTerrain(tileIds, terrains);

        assertEq(mapRegistry.getTileTerrain(tile_10_20), 1);
        assertEq(mapRegistry.getTileTerrain(tile_11_20), 2);
        assertEq(mapRegistry.getTileTerrain(tile_10_21), 5);
    }

    function test_BatchSetTerrain_RevertsIfLengthMismatch() public {
        uint32[] memory tileIds = new uint32[](2);
        uint8[] memory terrains = new uint8[](3);

        vm.prank(operator);
        vm.expectRevert("MapRegistry: array length mismatch");
        mapRegistry.batchSetTerrain(tileIds, terrains);
    }

    // =========================================================================
    // Adjacency Calculation Tests
    // =========================================================================

    function test_GetAdjacentTiles_Calculation() public view {
        uint32[4] memory adjacent = mapRegistry.getAdjacentTiles(tile_10_20);

        // Expected:
        // north: (10, 21) → (10 << 16) | 21
        // east:  (11, 20) → (11 << 16) | 20
        // south: (10, 19) → (10 << 16) | 19
        // west:  (9, 20)  → (9 << 16)  | 20

        assertEq(adjacent[0], tile_10_21, "north incorrect");
        assertEq(adjacent[1], tile_11_20, "east incorrect");
        assertEq(adjacent[2], tile_10_19, "south incorrect");
        assertEq(adjacent[3], tile_9_20,  "west incorrect");
    }

    function test_GetAdjacentTiles_EdgeCase_HighCoordinate() public view {
        // Test with high coordinates that won't underflow
        uint32 highTile = (100 << 16) | 100;
        uint32[4] memory adjacent = mapRegistry.getAdjacentTiles(highTile);

        uint32 expectedNorth = (100 << 16) | 101;
        uint32 expectedEast  = (101 << 16) | 100;
        uint32 expectedSouth = (100 << 16) | 99;
        uint32 expectedWest  = (99 << 16)  | 100;
        
        assertEq(adjacent[0], expectedNorth);
        assertEq(adjacent[1], expectedEast);
        assertEq(adjacent[2], expectedSouth);
        assertEq(adjacent[3], expectedWest);
    }
}
