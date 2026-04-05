'use client';

import { useReadContracts } from 'wagmi';
import { formatUnits } from 'viem';
import { RESOURCE_NAMES } from '@/lib/contracts';
import { TESTNET_ADDRESSES } from '@/lib/addresses';
import { erc20Abi } from 'viem';

const PLAYER_ADDRESS = (process.env.NEXT_PUBLIC_PLAYER_ADDRESS ?? '0x3382189F8a29607FdDf3D692B10a2D74480a503F') as `0x${string}`;

export function useResourceBalances(playerAddress?: `0x${string}`) {
  const address = playerAddress ?? PLAYER_ADDRESS;

  const balanceReads = RESOURCE_NAMES.map((name) => ({
    address: TESTNET_ADDRESSES.contracts.resources[name] as `0x${string}`,
    abi: erc20Abi,
    functionName: 'balanceOf' as const,
    args: [address] as const,
  }));

  const rateRead = {
    address: TESTNET_ADDRESSES.contracts.rateToken as `0x${string}`,
    abi: erc20Abi,
    functionName: 'balanceOf' as const,
    args: [address] as const,
  };

  const { data, isLoading, error } = useReadContracts({
    contracts: [...balanceReads, rateRead],
    query: { refetchInterval: 5000 },
  });

  if (error || !data) {
    return { balances: null, rateBalance: 0, isLive: false, isLoading };
  }

  const balances: Record<string, number> = {};
  for (let i = 0; i < RESOURCE_NAMES.length; i++) {
    const result = data[i]?.result;
    balances[RESOURCE_NAMES[i]] = result ? Number(formatUnits(result as bigint, 18)) : 0;
  }

  const rateResult = data[RESOURCE_NAMES.length]?.result;
  const rateBalance = rateResult ? Number(formatUnits(rateResult as bigint, 18)) : 0;

  return { balances, rateBalance, isLive: true, isLoading };
}
