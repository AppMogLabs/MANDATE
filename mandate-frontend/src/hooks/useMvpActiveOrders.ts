'use client';

import { useEffect, useState } from 'react';
import { createPublicClient, http, formatUnits, parseAbiItem } from 'viem';
import { megaethTestnet } from '@/lib/wagmi-config';
import { TESTNET_ADDRESSES } from '@/lib/addresses';

const ORDER_BOOK = TESTNET_ADDRESSES.contracts.orderBook as `0x${string}`;
const RESOURCES = TESTNET_ADDRESSES.contracts.resources;

type MvpResource = 'COMPUTE' | 'CHIPS' | 'DATA';

const RES_ADDR_TO_NAME: Record<string, MvpResource> = {
  [RESOURCES.COMPUTE.toLowerCase()]: 'COMPUTE',
  [RESOURCES.CHIPS.toLowerCase()]: 'CHIPS',
  [RESOURCES.DATA.toLowerCase()]: 'DATA',
};

const ordersAbi = [
  {
    inputs: [{ name: 'orderId', type: 'uint256' }],
    name: 'orders',
    outputs: [
      { name: 'orderId', type: 'uint256' },
      { name: 'seller', type: 'address' },
      { name: 'resourceToken', type: 'address' },
      { name: 'totalAmount', type: 'uint256' },
      { name: 'filledAmount', type: 'uint256' },
      { name: 'pricePerUnit', type: 'uint256' },
      { name: 'status', type: 'uint8' },
      { name: 'timestamp', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

const orderPlacedEvent = parseAbiItem(
  'event OrderPlaced(uint256 indexed orderId, address indexed seller, address indexed resourceToken, uint256 amount, uint256 pricePerUnit)',
);

const client = createPublicClient({ chain: megaethTestnet, transport: http() });

export interface ActiveOrder {
  readonly orderId: number;
  readonly resource: MvpResource;
  readonly price: number; // RATE per unit
  readonly remaining: number; // units available
  readonly seller: string;
}

const LOOKBACK_BLOCKS = 5_000_000n;
const POLL_MS = 12_000;

/**
 * Lightweight poll for active MVP-resource sell orders. Returns the top N
 * cheapest open orders per resource — fed into the agent prompt so it can
 * pick concrete orderIds to match when it wants to buy.
 */
export function useMvpActiveOrders(topN = 3): {
  orders: readonly ActiveOrder[];
  byResource: Record<MvpResource, ActiveOrder[]>;
} {
  const [orders, setOrders] = useState<ActiveOrder[]>([]);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const head = await client.getBlockNumber();
        const fromBlock = head > LOOKBACK_BLOCKS ? head - LOOKBACK_BLOCKS : 0n;

        const logs = await client.getLogs({
          address: ORDER_BOOK,
          event: orderPlacedEvent,
          fromBlock,
          toBlock: head,
        });

        const ids = Array.from(new Set(logs.map((l) => l.args.orderId as bigint)));
        if (ids.length === 0) {
          if (!cancelled) setOrders([]);
          return;
        }

        const results = await Promise.all(
          ids.map((id) =>
            client
              .readContract({
                address: ORDER_BOOK,
                abi: ordersAbi,
                functionName: 'orders',
                args: [id],
              })
              .catch(() => null),
          ),
        );

        const active: ActiveOrder[] = [];
        for (const r of results) {
          if (!r) continue;
          const [orderId, seller, resourceToken, totalAmount, filledAmount, pricePerUnit, status] =
            r as [bigint, string, string, bigint, bigint, bigint, number, bigint];
          if (status !== 0) continue; // 0 = ACTIVE
          const resName = RES_ADDR_TO_NAME[resourceToken.toLowerCase()];
          if (!resName) continue;
          const remainingRaw = totalAmount - filledAmount;
          if (remainingRaw === 0n) continue;
          active.push({
            orderId: Number(orderId),
            resource: resName,
            price: Number(formatUnits(pricePerUnit, 18)),
            remaining: Number(formatUnits(remainingRaw, 18)),
            seller,
          });
        }

        if (!cancelled) setOrders(active);
      } catch {
        // non-fatal — keep last snapshot
      }
    };

    void poll();
    const h = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(h);
    };
  }, []);

  const byResource: Record<MvpResource, ActiveOrder[]> = { COMPUTE: [], CHIPS: [], DATA: [] };
  for (const o of orders) byResource[o.resource].push(o);
  for (const r of ['COMPUTE', 'CHIPS', 'DATA'] as const) {
    byResource[r].sort((a, b) => a.price - b.price);
    byResource[r] = byResource[r].slice(0, topN);
  }

  return { orders, byResource };
}
