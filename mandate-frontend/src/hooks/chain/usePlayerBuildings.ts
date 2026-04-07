'use client';

import { useState, useEffect } from 'react';
import { createPublicClient, http, formatUnits } from 'viem';
import { megaethTestnet } from '@/lib/wagmi-config';
import { TESTNET_ADDRESSES } from '@/lib/addresses';
import BuildingRegistryABI from '@/lib/abis/BuildingRegistry.json';
import type { ResourceType } from '@/mock/types';

const publicClient = createPublicClient({
  chain: megaethTestnet,
  transport: http(),
});

const BUILDING_REGISTRY = TESTNET_ADDRESSES.contracts.buildingRegistry as `0x${string}`;

// Building type ID → name mapping (from contract constants)
const BUILDING_NAMES: Record<number, string> = {
  0: 'Data Centre',
  1: 'Power Plant',
  2: 'Solar Array',
  3: 'Fabrication Contract',
  4: 'Recruiting Pipeline',
  5: 'Data Acquisition Hub',
  6: 'Cooling Infrastructure',
  7: 'Training Cluster',
  8: 'Alignment Lab',
  9: 'Lobbying Office',
  10: 'Intelligence Network',
  11: 'Media Arm',
  12: 'Deployed Model',
  13: 'Patent Portfolio',
  14: 'Road',
  15: 'Security Perimeter',
};

// Building type → resource it produces
const BUILDING_RESOURCE: Record<number, ResourceType> = {
  0: 'COMPUTE',   // Data Centre
  1: 'ENERGY',    // Power Plant
  2: 'ENERGY',    // Solar Array
  3: 'CHIPS',     // Fabrication
  4: 'TALENT',    // Recruiting Pipeline
  5: 'DATA',      // Data Acquisition Hub
  6: 'COOLING',   // Cooling Infrastructure
  7: 'COMPUTE',   // Training Cluster (processing)
  8: 'COMPUTE',   // Alignment Lab (processing)
  9: 'CLEARANCE', // Lobbying Office
  12: 'COMPUTE',  // Deployed Model
  13: 'CLEARANCE', // Patent Portfolio
};

// Production rates per hour (tier 1, from contract)
const PRODUCTION_RATES: Record<number, number> = {
  0: 5.0,    // Data Centre: 5.0 COMPUTE/hr
  1: 4.0,    // Power Plant: 4.0 ENERGY/hr
  2: 2.5,    // Solar Array: 2.5 ENERGY/hr
  3: 1.5,    // Fabrication: 1.5 CHIPS/hr
  4: 1.2,    // Recruiting: 1.2 TALENT/hr
  5: 3.5,    // Data Acquisition: 3.5 DATA/hr
  6: 3.0,    // Cooling: 3.0 COOLING/hr
  7: 0,      // Training Cluster (processing, not production)
  8: 0,      // Alignment Lab (processing)
  9: 2.0,    // Lobbying: 2.0 CLEARANCE/hr
  12: 8.0,   // Deployed Model: 8.0 COMPUTE/hr
  13: 3.0,   // Patent Portfolio: 3.0 CLEARANCE/hr
};

export interface PlayerBuilding {
  tokenId: number;
  buildingType: number;
  name: string;
  tier: 1 | 2 | 3;
  tileId: number;
  producing: ResourceType;
  productionPerHour: number;
  lastProductionTimestamp: number;
  upgradeInProgress: boolean;
  upgradeFinalTimestamp: number;
}

export function usePlayerBuildings(playerAddress?: string): {
  buildings: PlayerBuilding[];
  isLoading: boolean;
  refetch: () => void;
} {
  const [buildings, setBuildings] = useState<PlayerBuilding[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchTrigger, setFetchTrigger] = useState(0);

  const refetch = () => setFetchTrigger(prev => prev + 1);

  useEffect(() => {
    if (!playerAddress) return;
    let cancelled = false;

    async function fetchBuildings() {
      setIsLoading(true);
      try {
        // Get count of buildings owned
        const balance = await publicClient.readContract({
          address: BUILDING_REGISTRY,
          abi: BuildingRegistryABI,
          functionName: 'balanceOf',
          args: [playerAddress as `0x${string}`],
        }) as bigint;

        const count = Number(balance);
        if (count === 0) {
          setBuildings([]);
          setIsLoading(false);
          return;
        }

        // Get token IDs via tokenOfOwnerByIndex
        const tokenIds: bigint[] = [];
        for (let i = 0; i < count; i++) {
          const tokenId = await publicClient.readContract({
            address: BUILDING_REGISTRY,
            abi: BuildingRegistryABI,
            functionName: 'tokenOfOwnerByIndex',
            args: [playerAddress as `0x${string}`, BigInt(i)],
          }) as bigint;
          tokenIds.push(tokenId);
        }

        if (cancelled) return;

        // Batch read building info
        const results = await Promise.all(
          tokenIds.map(async (tokenId): Promise<PlayerBuilding | null> => {
            try {
              const info = await publicClient.readContract({
                address: BUILDING_REGISTRY,
                abi: BuildingRegistryABI,
                functionName: 'getBuildingInfo',
                args: [tokenId],
              }) as {
                buildingType: number;
                tier: number;
                tileId: number;
                owner: string;
                lastProductionTimestamp: bigint;
                talentAllocation: bigint;
                productionAccumulator: bigint;
                upgradeInProgress: boolean;
                upgradeFinalTimestamp: bigint;
              };

              const buildingType = Number(info.buildingType);
              const tier = Number(info.tier) as 1 | 2 | 3;
              const tierMultiplier = tier === 1 ? 1.0 : tier === 2 ? 1.5 : 2.25;
              const baseRate = PRODUCTION_RATES[buildingType] ?? 0;

              return {
                tokenId: Number(tokenId),
                buildingType,
                name: BUILDING_NAMES[buildingType] ?? `Building #${buildingType}`,
                tier,
                tileId: Number(info.tileId),
                producing: BUILDING_RESOURCE[buildingType] ?? 'COMPUTE',
                productionPerHour: baseRate * tierMultiplier,
                lastProductionTimestamp: Number(info.lastProductionTimestamp),
                upgradeInProgress: info.upgradeInProgress,
                upgradeFinalTimestamp: Number(info.upgradeFinalTimestamp),
              };
            } catch {
              return null;
            }
          })
        );

        if (!cancelled) {
          setBuildings(results.filter((b): b is PlayerBuilding => b !== null));
        }
      } catch {
        // Silently retry on next poll
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchBuildings();
    const interval = setInterval(fetchBuildings, 30_000); // Poll every 30s

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [playerAddress, fetchTrigger]);

  return { buildings, isLoading, refetch };
}
