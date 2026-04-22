'use client';

import { useCallback, useEffect, useState } from 'react';
import { useWallets } from '@privy-io/react-auth';
import { useReadContract } from 'wagmi';
import {
  createWalletClient,
  createPublicClient,
  custom,
  http,
  encodeFunctionData,
  maxUint256,
  type EIP1193Provider,
} from 'viem';
import { megaethTestnet } from '@/lib/wagmi-config';
import { TESTNET_ADDRESSES } from '@/lib/addresses';

const agentRegistryAbi = [
  {
    type: 'function',
    name: 'isRegistered',
    stateMutability: 'view',
    inputs: [{ name: 'agent', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
] as const;

const erc20Abi = [
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
] as const;

const ORDER_BOOK = TESTNET_ADDRESSES.contracts.orderBook as `0x${string}`;
const AGENT_REGISTRY = TESTNET_ADDRESSES.contracts.agentRegistry as `0x${string}`;

const TOKENS_TO_APPROVE: `0x${string}`[] = [
  TESTNET_ADDRESSES.contracts.rateToken as `0x${string}`,
  TESTNET_ADDRESSES.contracts.resources.COMPUTE as `0x${string}`,
  TESTNET_ADDRESSES.contracts.resources.CHIPS as `0x${string}`,
  TESTNET_ADDRESSES.contracts.resources.DATA as `0x${string}`,
];

export type OnboardingStatus =
  | 'idle'
  | 'registering'
  | 'waiting-confirmation'
  | 'approving'
  | 'ready'
  | 'error';

export interface OnboardingState {
  readonly status: OnboardingStatus;
  readonly message: string;
  readonly error?: string;
  readonly isRegistered: boolean;
  /** Call this to drive the full onboarding sequence. Idempotent. */
  readonly ensureOnboarded: () => Promise<boolean>;
}

/**
 * MVP onboarding hook. On first call:
 * 1. Check AgentRegistry — if the Privy wallet is not yet registered, relay
 *    PlayerOnboarding.onboardPlayer via /api/register (operator pays gas,
 *    mints starter RATE + resources, sets allowlist).
 * 2. Poll until registration confirmed.
 * 3. Approve OrderBook as spender for RATE + the 3 MVP resources, so the
 *    agent can place sells and buy from listings without per-trade prompts.
 *
 * After this completes, trades signed by the player's Privy wallet will
 * succeed and update the player's own balance.
 */
export function useMvpOnboarding(walletAddress: string | undefined): OnboardingState {
  const { wallets } = useWallets();
  const [status, setStatus] = useState<OnboardingStatus>('idle');
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string | undefined>();

  const { data: registeredData, refetch: refetchRegistered } = useReadContract({
    address: AGENT_REGISTRY,
    abi: agentRegistryAbi,
    functionName: 'isRegistered',
    args: walletAddress ? [walletAddress as `0x${string}`] : undefined,
    query: { enabled: !!walletAddress, refetchInterval: 15_000 },
  });

  const isRegistered = registeredData === true;

  // When registration is already complete and we're idle, mark ready so the
  // UI doesn't nag about onboarding.
  useEffect(() => {
    if (isRegistered && status === 'idle') {
      setStatus('ready');
      setMessage('Agent ready');
    }
  }, [isRegistered, status]);

  const getPrivyProvider = useCallback(async (): Promise<EIP1193Provider | null> => {
    const embedded = wallets.find((w) => w.walletClientType === 'privy');
    if (!embedded) return null;
    return (await embedded.getEthereumProvider()) as EIP1193Provider;
  }, [wallets]);

  const approveOrderBook = useCallback(async (): Promise<boolean> => {
    if (!walletAddress) return false;
    const provider = await getPrivyProvider();
    if (!provider) {
      setError('Privy wallet not available');
      setStatus('error');
      return false;
    }

    const walletClient = createWalletClient({
      account: walletAddress as `0x${string}`,
      chain: megaethTestnet,
      transport: custom(provider),
    });
    const publicClient = createPublicClient({ chain: megaethTestnet, transport: http() });

    for (const token of TOKENS_TO_APPROVE) {
      try {
        // Skip if allowance already set
        const allowance = (await publicClient.readContract({
          address: token,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [walletAddress as `0x${string}`, ORDER_BOOK],
        })) as bigint;

        if (allowance > (maxUint256 / 2n)) continue;

        setMessage(`Approving ${TOKENS_TO_APPROVE.indexOf(token) + 1}/${TOKENS_TO_APPROVE.length}…`);

        const data = encodeFunctionData({
          abi: erc20Abi,
          functionName: 'approve',
          args: [ORDER_BOOK, maxUint256],
        });

        const hash = await walletClient.sendTransaction({
          to: token,
          data,
        });

        // Wait for confirmation (MegaETH blocks are ~10ms)
        await publicClient.waitForTransactionReceipt({ hash, timeout: 30_000 });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(`Approval failed: ${msg}`);
        setStatus('error');
        return false;
      }
    }
    return true;
  }, [walletAddress, getPrivyProvider]);

  const ensureOnboarded = useCallback(async (): Promise<boolean> => {
    if (!walletAddress) return false;
    if (status === 'ready') return true;

    setError(undefined);

    // 1. Register via operator-relayed transaction (mints starter tokens +
    //    sets allowlist atomically).
    if (!isRegistered) {
      setStatus('registering');
      setMessage('Minting agent NFT and starter tokens…');
      try {
        const res = await fetch('/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerAddress: walletAddress, role: 3 }),
        });
        const data = (await res.json()) as { error?: string; txHash?: string };
        // 409 = already registered; treat as success
        if (!res.ok && res.status !== 409) {
          setError(data.error ?? `Registration failed (${res.status})`);
          setStatus('error');
          return false;
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Network error during registration');
        setStatus('error');
        return false;
      }

      setStatus('waiting-confirmation');
      setMessage('Waiting for chain confirmation…');

      // Poll isRegistered up to ~45s
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 1_500));
        const refreshed = await refetchRegistered();
        if (refreshed.data === true) break;
      }

      const finalCheck = await refetchRegistered();
      if (finalCheck.data !== true) {
        setError('Registration tx sent but not confirmed in 45s');
        setStatus('error');
        return false;
      }
    }

    // 2. Approve OrderBook for trading
    setStatus('approving');
    setMessage('Approving OrderBook…');
    const approved = await approveOrderBook();
    if (!approved) return false;

    setStatus('ready');
    setMessage('Agent ready');
    return true;
  }, [walletAddress, status, isRegistered, refetchRegistered, approveOrderBook]);

  return { status, message, error, isRegistered, ensureOnboarded };
}
