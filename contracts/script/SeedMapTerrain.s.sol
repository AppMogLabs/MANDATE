// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";

interface IMapRegistry {
    function batchSetTerrain(uint32[] calldata tileIds, uint8[] calldata terrains) external;
    function getTileTerrain(uint32 tileId) external view returns (uint8);
    function hasRole(bytes32 role, address account) external view returns (bool);
    function OPERATOR_ROLE() external view returns (bytes32);
}

interface IMapRegistryAdmin {
    function grantRole(bytes32 role, address account) external;
}

/// @title SeedMapTerrain — Populate a 20x20 hex grid with terrain types
/// @notice Creates a realistic city-like terrain distribution:
///         - Urban core in the center
///         - Industrial belt around the core
///         - Research corridor in the east
///         - Regulatory district in the northwest
///         - Coastal strip on the south edge
///         - Wilderness/flat filling the rest
///
/// Run with:
///   source .env && forge script script/SeedMapTerrain.s.sol:SeedMapTerrain \
///     --rpc-url $RPC_URL --private-key $PRIVATE_KEY \
///     --broadcast --slow --skip-simulation
contract SeedMapTerrain is Script {
    IMapRegistry constant MAP = IMapRegistry(0x59b210E9F0025a965ef862897b4e75A146B22bDC);

    // Terrain constants (match MapRegistry.sol)
    uint8 constant EMPTY      = 0; // flat/mixed
    uint8 constant URBAN      = 1; // High-density urban
    uint8 constant INDUSTRIAL = 2; // Industrial zone
    uint8 constant RESEARCH   = 3; // Research corridor
    uint8 constant REGULATORY = 4; // Regulatory district
    uint8 constant COASTAL    = 5; // Coastal/port
    uint8 constant TRANSIT    = 6; // Transit hub
    uint8 constant WILDERNESS = 7; // Wilderness

    uint16 constant GRID_SIZE = 20;

    function encodeTileId(uint16 x, uint16 y) internal pure returns (uint32) {
        return (uint32(x) << 16) | uint32(y);
    }

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);

        console2.log("=== Seed Map Terrain (20x20) ===");
        console2.log("Deployer:", deployer);

        // Verify OPERATOR_ROLE (grant via `cast send` if needed before running this script)
        bytes32 opRole = MAP.OPERATOR_ROLE();
        require(MAP.hasRole(opRole, deployer), "Deployer lacks OPERATOR_ROLE on MapRegistry");

        // Build tile arrays in memory
        // 20x20 = 400 tiles. batchSetTerrain in chunks to avoid gas limits.
        // We'll do 4 batches of 100 tiles each.

        vm.startBroadcast(pk);

        // Process in 4 row-bands: rows 0-4, 5-9, 10-14, 15-19
        _seedBand(0, 5);
        _seedBand(5, 10);
        _seedBand(10, 15);
        _seedBand(15, 20);

        vm.stopBroadcast();

        console2.log("=== Map terrain seeded: 400 tiles ===");
    }

    function _seedBand(uint16 yStart, uint16 yEnd) internal {
        uint256 count = uint256(GRID_SIZE) * uint256(yEnd - yStart);
        uint32[] memory tileIds = new uint32[](count);
        uint8[] memory terrains = new uint8[](count);

        uint256 idx = 0;
        for (uint16 y = yStart; y < yEnd; y++) {
            for (uint16 x = 0; x < GRID_SIZE; x++) {
                tileIds[idx] = encodeTileId(x, y);
                terrains[idx] = _terrainFor(x, y);
                idx++;
            }
        }

        MAP.batchSetTerrain(tileIds, terrains);
        console2.log("  Seeded rows", yStart, "to", yEnd - 1);
    }

    /// @dev Deterministic terrain assignment based on position.
    ///      Creates a realistic city layout:
    ///
    ///      NW corner: Regulatory district (4x4 block)
    ///      Center (8x8): Urban core
    ///      Ring around center: Industrial belt
    ///      East side (cols 15-19): Research corridor
    ///      South edge (rows 17-19): Coastal strip
    ///      Scattered: Transit hubs at intersections
    ///      Remaining: Wilderness/flat
    function _terrainFor(uint16 x, uint16 y) internal pure returns (uint8) {
        // South edge: coastal strip (rows 17-19)
        if (y >= 17) {
            // Research corridor extends to coast in SE corner
            if (x >= 15) return RESEARCH;
            // Regulatory extends to coast in SW corner
            if (x <= 3 && y <= 18) return REGULATORY;
            return COASTAL;
        }

        // NW regulatory district (cols 0-3, rows 0-4)
        if (x <= 3 && y <= 4) {
            return REGULATORY;
        }

        // East research corridor (cols 15-19, rows 2-16)
        if (x >= 15 && y >= 2) {
            // Some industrial mixed in
            if (x == 15 && y % 3 == 0) return INDUSTRIAL;
            return RESEARCH;
        }

        // Urban core (cols 6-13, rows 5-12) — the 8x8 center
        if (x >= 6 && x <= 13 && y >= 5 && y <= 12) {
            // Transit hubs at intersections
            if ((x == 8 || x == 11) && (y == 7 || y == 10)) return TRANSIT;
            return URBAN;
        }

        // Industrial belt — ring around urban core
        if (x >= 4 && x <= 14 && y >= 3 && y <= 14) {
            // Transit hubs at key junctions
            if (x == 5 && y == 9) return TRANSIT;
            if (x == 14 && y == 9) return TRANSIT;
            return INDUSTRIAL;
        }

        // NE corner — mixed wilderness with some industry
        if (x >= 12 && y <= 2) {
            return INDUSTRIAL;
        }

        // Scattered transit hubs on major grid lines
        if (x == 10 && y == 2) return TRANSIT;
        if (x == 10 && y == 15) return TRANSIT;

        // Everything else: wilderness
        return WILDERNESS;
    }
}
