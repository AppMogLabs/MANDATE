'use client';

import { useEffect, useState } from 'react';
import { useReadContracts } from 'wagmi';
import { TESTNET_ADDRESSES } from '@/lib/addresses';
import { mvpEpochAbi } from '@/lib/abis/MvpEpoch';

const MVP_EPOCH = TESTNET_ADDRESSES.contracts.mvpEpoch as `0x${string}`;

/**
 * Reads epoch timer + status from the on-chain MvpEpoch contract.
 * Replaces the localStorage-backed useMvpEpoch. Refreshes every 15s for
 * finalized/isActive; the remainingMs ticks client-side every second.
 */
export function useMvpEpochChain(): {
  endsAt: number;
  remainingMs: number;
  isActive: boolean;
  finalized: boolean;
  hydrated: boolean;
  chainReady: boolean;
} {
  const { data, isSuccess } = useReadContracts({
    contracts: [
      { address: MVP_EPOCH, abi: mvpEpochAbi, functionName: 'epochEnd' },
      { address: MVP_EPOCH, abi: mvpEpochAbi, functionName: 'isActive' },
      { address: MVP_EPOCH, abi: mvpEpochAbi, functionName: 'finalized' },
    ],
    query: { refetchInterval: 15_000 },
  });

  const [now, setNow] = useState<number>(0);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
    setNow(Date.now());
    const h = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(h);
  }, []);

  const endsAtSec = data?.[0]?.result ? Number(data[0].result) : 0;
  const isActive = data?.[1]?.result === true;
  const finalized = data?.[2]?.result === true;
  const endsAt = endsAtSec * 1000;
  const chainReady = isSuccess && endsAt > 0;
  const remainingMs = hydrated && chainReady ? Math.max(0, endsAt - now) : 0;

  return { endsAt, remainingMs, isActive, finalized, hydrated, chainReady };
}
