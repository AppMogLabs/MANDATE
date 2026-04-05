'use client';

import { useState, useEffect } from 'react';
import { useReadContracts } from 'wagmi';
import { TESTNET_ADDRESSES } from '@/lib/addresses';

const epochManagerAbi = [
  { type: 'function', name: 'getCurrentEpoch', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'getEpochEndTimestamp', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
] as const;

const epochManagerAddress = TESTNET_ADDRESSES.contracts.epochManager as `0x${string}`;

export function useEpochState() {
  const { data, error } = useReadContracts({
    contracts: [
      {
        address: epochManagerAddress,
        abi: epochManagerAbi,
        functionName: 'getCurrentEpoch',
      },
      {
        address: epochManagerAddress,
        abi: epochManagerAbi,
        functionName: 'getEpochEndTimestamp',
      },
    ],
    query: { refetchInterval: 10000 },
  });

  const [timeRemaining, setTimeRemaining] = useState(0);

  const epochNumber = data?.[0]?.result ? Number(data[0].result) : 0;
  const endTimestamp = data?.[1]?.result ? Number(data[1].result) : 0;

  useEffect(() => {
    if (!endTimestamp) return;
    const update = () => {
      setTimeRemaining(Math.max(0, endTimestamp - Math.floor(Date.now() / 1000)));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [endTimestamp]);

  return {
    epochNumber,
    endTimestamp,
    timeRemaining,
    isLive: !error && !!data?.[0]?.result,
  };
}
