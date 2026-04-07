'use client';

import { useState, useEffect } from 'react';
import { createPublicClient, http } from 'viem';
import { megaethTestnet } from '@/lib/wagmi-config';
import { TESTNET_ADDRESSES } from '@/lib/addresses';
import { resolveAgentName } from '@/lib/npc-agents';
import MapRegistryABI from '@/lib/abis/MapRegistry.json';
import { hexTiles as mockTiles } from '@/mock/map';
import type { HexTile } from '@/mock/types';

const publicClient = createPublicClient({
  chain: megaethTestnet,
  transport: http(),
});

const MAP_REGISTRY = TESTNET_ADDRESSES.contracts.mapRegistry as `0x${string}`;
const ZERO_ADDR = '0x0000000000000000000000000000000000000000';

const TERRAIN_MAP: Record<number, HexTile['terrain']> = {
  0: 'flat',
  1: 'urban',
  2: 'industrial',
  3: 'research',
  4: 'coastal',
  5: 'regulatory',
};

function encodeTileId(q: number, r: number, gridOffset = 10): number {
  const x = q + gridOffset;
  const y = r + gridOffset;
  return ((x & 0xFFFF) << 16) | (y & 0xFFFF);
}

/**
 * Reads tile ownership from the MapRegistry contract and merges it
 * with mock terrain data. Falls back to pure mock data if chain reads fail.
 */
export function useMapData(playerAddress?: string): {
  tiles: HexTile[];
  isLive: boolean;
} {
  const [tiles, setTiles] = useState<HexTile[]>(mockTiles);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchTileData() {
      try {
        // Read on-chain state for each mock tile's coordinates
        const results = await Promise.all(
          mockTiles.map(async (tile) => {
            const tileId = encodeTileId(tile.q, tile.r);
            try {
              const info = await publicClient.readContract({
                address: MAP_REGISTRY,
                abi: MapRegistryABI,
                functionName: 'getTileInfo',
                args: [tileId],
              }) as {
                terrain: number;
                owner: string;
                buildingTokenId: bigint;
                developed: boolean;
              };

              const owner = info.owner.toLowerCase() === ZERO_ADDR.toLowerCase()
                ? undefined
                : resolveAgentName(info.owner, playerAddress);

              const chainTerrain = TERRAIN_MAP[info.terrain];

              return {
                ...tile,
                terrain: chainTerrain ?? tile.terrain,
                owner,
                // Keep mock building data if no on-chain building; Phase 2 hook handles real buildings
                building: info.buildingTokenId > 0n
                  ? tile.building ?? { type: 'Building', tier: 1 as const, producing: 'COMPUTE' as const }
                  : undefined,
              };
            } catch {
              // If individual tile read fails, keep mock data
              return tile;
            }
          })
        );

        if (!cancelled) {
          setTiles(results);
          setIsLive(true);
        }
      } catch {
        // Keep mock data on failure
      }
    }

    fetchTileData();
    const interval = setInterval(fetchTileData, 30_000); // Refresh every 30s

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [playerAddress]);

  return { tiles, isLive };
}
