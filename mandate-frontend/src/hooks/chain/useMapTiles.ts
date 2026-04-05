'use client';

import { useReadContracts } from 'wagmi';
import { contracts } from '@/lib/contracts';
import type { HexTile } from '@/mock/types';

// Tile ID encoding: (x << 16) | y
function encodeTileId(x: number, y: number): number {
  return ((x & 0xFFFF) << 16) | (y & 0xFFFF);
}

// Terrain enum to string mapping (matches contract constants)
const TERRAIN_MAP: Record<number, HexTile['terrain']> = {
  0: 'flat',        // TERRAIN_EMPTY
  1: 'urban',       // TERRAIN_HIGH_DENSITY_URBAN
  2: 'industrial',  // TERRAIN_INDUSTRIAL_ZONE
  3: 'research',    // TERRAIN_RESEARCH_CORRIDOR
  4: 'regulatory',  // TERRAIN_REGULATORY_DISTRICT
  5: 'coastal',     // TERRAIN_COASTAL_PORT
  6: 'flat',        // TERRAIN_TRANSIT_HUB
  7: 'flat',        // TERRAIN_WILDERNESS
};

interface MapTilesResult {
  tiles: HexTile[];
  isLive: boolean;
  isLoading: boolean;
}

/**
 * Read tile data from the deployed MapRegistry contract for a grid of tiles.
 * Generates tile IDs for a gridSize x gridSize hex grid and batch-reads their info.
 */
export function useMapTiles(
  gridSize = 20,
  playerAddress?: string,
): MapTilesResult {
  // Generate tile IDs for the grid
  const halfGrid = Math.floor(gridSize / 2);
  const tileCoords: { q: number; r: number; tileId: number }[] = [];
  for (let r = -halfGrid; r < halfGrid; r++) {
    for (let q = -halfGrid; q < halfGrid; q++) {
      const x = q + halfGrid;
      const y = r + halfGrid;
      tileCoords.push({ q, r, tileId: encodeTileId(x, y) });
    }
  }

  // Batch read getTileInfo for all tiles — cast ABI to satisfy wagmi types
  const readContracts = tileCoords.map(({ tileId }) => ({
    ...contracts.mapRegistry,
    functionName: 'getTileInfo' as const,
    args: [tileId] as const,
  }));

  const { data, isLoading, error } = useReadContracts({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    contracts: readContracts as any,
    query: {
      refetchInterval: 15000,
      enabled: readContracts.length > 0,
    },
  });

  if (error || !data || isLoading) {
    return { tiles: [], isLive: false, isLoading };
  }

  const tiles: HexTile[] = tileCoords.map(({ q, r }, index) => {
    const result = data[index];
    if (!result || result.status === 'failure' || !result.result) {
      return { q, r, terrain: 'flat' as const };
    }

    const [terrain, owner, buildingTokenId] = result.result as [number, string, bigint, boolean];
    const terrainStr = TERRAIN_MAP[terrain] ?? 'flat';
    const hasOwner = owner !== '0x0000000000000000000000000000000000000000';
    const hasBuilding = buildingTokenId > 0n;

    const tile: HexTile = { q, r, terrain: terrainStr };

    if (hasOwner) {
      tile.owner = owner === playerAddress
        ? 'You'
        : `${owner.slice(0, 6)}...${owner.slice(-4)}`;
    }

    if (hasBuilding) {
      tile.building = {
        type: 'Building',
        tier: 1,
        producing: 'COMPUTE',
      };
    }

    return tile;
  });

  return { tiles, isLive: true, isLoading: false };
}
