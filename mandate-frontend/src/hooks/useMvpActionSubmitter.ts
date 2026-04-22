'use client';

import { useCallback } from 'react';
import { useWallets } from '@privy-io/react-auth';
import {
  createWalletClient,
  createPublicClient,
  custom,
  encodeFunctionData,
  http,
  parseUnits,
  type EIP1193Provider,
} from 'viem';
import { megaethTestnet } from '@/lib/wagmi-config';
import { TESTNET_ADDRESSES } from '@/lib/addresses';
import type { ProposedAction } from '@/agent/types';

const RESOURCES = TESTNET_ADDRESSES.contracts.resources;
const ORDER_BOOK = TESTNET_ADDRESSES.contracts.orderBook as `0x${string}`;

const orderBookAbi = [
  {
    type: 'function',
    name: 'placeOrder',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'resourceToken', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'pricePerUnit', type: 'uint256' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'cancelOrder',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'orderId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'matchOrder',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'orderId', type: 'uint256' },
      { name: 'fillAmount', type: 'uint256' },
    ],
    outputs: [],
  },
] as const;

export interface SubmitResult {
  readonly txHash?: string;
  readonly description: string;
  readonly error?: string;
}

/**
 * Returns a submitter function that signs and sends agent actions via the
 * player's Privy embedded wallet. Replaces the server-relayed
 * /api/agent-action path for the MVP, so trades actually change the
 * player's balance.
 *
 * Assumes onboarding has completed: player is registered in AgentRegistry,
 * allowlisted for trading actions, and has approved OrderBook for all
 * token transfers.
 *
 * ORDER_BUY is mapped to OrderBook.matchOrder with the provided orderId.
 * The agent must inspect the live book and choose an order to match; the
 * MVP prompt already tells it how.
 */
export function useMvpActionSubmitter(walletAddress: string | undefined) {
  const { wallets } = useWallets();

  return useCallback(
    async (action: ProposedAction): Promise<SubmitResult> => {
      if (!walletAddress) {
        return { description: action.type, error: 'No wallet' };
      }
      const embedded = wallets.find((w) => w.walletClientType === 'privy');
      if (!embedded) {
        return { description: action.type, error: 'Privy wallet unavailable' };
      }

      const provider = (await embedded.getEthereumProvider()) as EIP1193Provider;
      const walletClient = createWalletClient({
        account: walletAddress as `0x${string}`,
        chain: megaethTestnet,
        transport: custom(provider),
      });
      const publicClient = createPublicClient({ chain: megaethTestnet, transport: http() });

      try {
        let data: `0x${string}`;
        let description: string;

        switch (action.type) {
          case 'ORDER_PLACE': {
            const { resource, amount, price } = action.params as {
              resource: string;
              amount: number;
              price: number;
            };
            const resourceAddr = RESOURCES[resource as keyof typeof RESOURCES];
            if (!resourceAddr || !amount || !price) {
              return { description: action.type, error: 'Missing resource/amount/price' };
            }
            data = encodeFunctionData({
              abi: orderBookAbi,
              functionName: 'placeOrder',
              args: [
                resourceAddr as `0x${string}`,
                parseUnits(amount.toString(), 18),
                parseUnits(price.toFixed(6), 18),
              ],
            });
            description = `SELL ${amount} ${resource} @ ${price.toFixed(4)} RATE`;
            break;
          }

          case 'ORDER_BUY':
          case 'ORDER_MATCH': {
            const orderId = (action.params as { orderId?: number }).orderId;
            const fillAmount =
              (action.params as { fillAmount?: number; amount?: number }).fillAmount ??
              (action.params as { amount?: number }).amount;
            if (orderId === undefined || !fillAmount) {
              return {
                description: action.type,
                error: 'ORDER_BUY requires orderId + amount (the agent must pick an on-book order)',
              };
            }
            data = encodeFunctionData({
              abi: orderBookAbi,
              functionName: 'matchOrder',
              args: [BigInt(orderId), parseUnits(fillAmount.toString(), 18)],
            });
            description = `BUY ${fillAmount} from order #${orderId}`;
            break;
          }

          case 'ORDER_CANCEL': {
            const orderId = (action.params as { orderId?: number }).orderId;
            if (orderId === undefined) {
              return { description: action.type, error: 'ORDER_CANCEL requires orderId' };
            }
            data = encodeFunctionData({
              abi: orderBookAbi,
              functionName: 'cancelOrder',
              args: [BigInt(orderId)],
            });
            description = `CANCEL order #${orderId}`;
            break;
          }

          default:
            return {
              description: action.type,
              error: `Action ${action.type} not supported in MVP (trading only)`,
            };
        }

        const hash = await walletClient.sendTransaction({ to: ORDER_BOOK, data });
        // Fire-and-forget receipt wait for UI feedback; don't block on it.
        void publicClient.waitForTransactionReceipt({ hash, timeout: 30_000 }).catch(() => {});

        return { txHash: hash, description };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { description: action.type, error: msg };
      }
    },
    [walletAddress, wallets],
  );
}
