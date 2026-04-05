'use client';

import { useCallback, useState } from 'react';
import { TESTNET_ADDRESSES } from '@/lib/addresses';
import MapRegistryABI from '@/lib/abis/MapRegistry.json';
import { encodeFunctionData, createPublicClient, http } from 'viem';
import { megaethTestnet } from '@/lib/wagmi-config';

/**
 * Encode axial hex coordinates (q, r) to a MapRegistry tileId.
 * The mock data uses negative coordinates centered around (0,0).
 * MapRegistry uses (x << 16) | y with positive uint16 values.
 * We offset by half the grid size (10 for a 20x20 grid).
 */
function encodeTileId(q: number, r: number, gridOffset = 10): number {
  const x = q + gridOffset;
  const y = r + gridOffset;
  return ((x & 0xFFFF) << 16) | (y & 0xFFFF);
}

interface TileActionResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

interface TileActionsState {
  claimTile: (q: number, r: number) => Promise<TileActionResult>;
  releaseTile: (q: number, r: number) => Promise<TileActionResult>;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook for on-chain tile actions (claim, release).
 * Uses the operator wallet via an API route since the player's
 * embedded wallet may not have the required agent registration.
 *
 * For testnet, we route through /api/tile-action which uses the operator key.
 * For production, the player's wallet would sign directly.
 */
export function useTileActions(walletAddress: string): TileActionsState {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const claimTile = useCallback(async (q: number, r: number): Promise<TileActionResult> => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/tile-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'claim',
          q, r,
          playerAddress: walletAddress,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return { success: false, error: data.error };
      }
      return { success: true, txHash: data.txHash };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error';
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setIsLoading(false);
    }
  }, [walletAddress]);

  const releaseTile = useCallback(async (q: number, r: number): Promise<TileActionResult> => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/tile-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'release',
          q, r,
          playerAddress: walletAddress,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return { success: false, error: data.error };
      }
      return { success: true, txHash: data.txHash };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error';
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setIsLoading(false);
    }
  }, [walletAddress]);

  return { claimTile, releaseTile, isLoading, error };
}

export { encodeTileId };
