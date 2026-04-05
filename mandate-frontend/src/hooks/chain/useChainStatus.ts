'use client';

import { useBlockNumber } from 'wagmi';

export type ChainConnectionStatus = 'live' | 'mock' | 'offline';

export function useChainStatus(): { status: ChainConnectionStatus; blockNumber: bigint | undefined } {
  const { data: blockNumber, error } = useBlockNumber({
    watch: true,
    query: { refetchInterval: 5000 },
  });

  if (error || blockNumber === undefined) {
    return { status: 'offline', blockNumber: undefined };
  }

  return { status: 'live', blockNumber };
}
