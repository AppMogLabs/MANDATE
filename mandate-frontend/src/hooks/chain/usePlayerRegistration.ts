'use client';

import { useReadContract } from 'wagmi';
import { contracts } from '@/lib/contracts';

/**
 * Check whether a wallet address is already registered as a MANDATE agent.
 */
export function usePlayerRegistration(walletAddress: string | undefined) {
  const { data: isRegistered, isLoading: loadingRegistered } = useReadContract({
    ...contracts.agentRegistry,
    functionName: 'isRegistered',
    args: walletAddress ? [walletAddress] : undefined,
    query: { enabled: !!walletAddress },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

  const { data: agentId, isLoading: loadingAgentId } = useReadContract({
    ...contracts.agentRegistry,
    functionName: 'agentIdOf',
    args: walletAddress ? [walletAddress] : undefined,
    query: { enabled: !!walletAddress },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

  return {
    isRegistered: isRegistered as boolean | undefined,
    agentId: agentId as bigint | undefined,
    isLoading: loadingRegistered || loadingAgentId,
  };
}
