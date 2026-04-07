'use client';

import { useState, useEffect, useRef } from 'react';
import { createPublicClient, http, formatUnits, parseAbiItem } from 'viem';
import { megaethTestnet } from '@/lib/wagmi-config';
import { TESTNET_ADDRESSES } from '@/lib/addresses';
import type { ResourceType, OrderBookSnapshot, OrderBookLevel } from '@/mock/types';

const RESOURCE_ADDRS = TESTNET_ADDRESSES.contracts.resources;

const ADDR_TO_RESOURCE: Record<string, ResourceType> = {};
for (const [name, addr] of Object.entries(RESOURCE_ADDRS)) {
  ADDR_TO_RESOURCE[addr.toLowerCase()] = name as ResourceType;
}

const ALL_RESOURCES: ResourceType[] = [
  'COMPUTE', 'ENERGY', 'CHIPS', 'COOLING', 'TALENT', 'DATA', 'CLEARANCE',
];

const publicClient = createPublicClient({
  chain: megaethTestnet,
  transport: http(),
});

const ORDER_BOOK = TESTNET_ADDRESSES.contracts.orderBook as `0x${string}`;

const orderPlacedEvent = parseAbiItem(
  'event OrderPlaced(uint256 indexed orderId, address indexed seller, address indexed resourceToken, uint256 amount, uint256 pricePerUnit)',
);
const orderMatchedEvent = parseAbiItem(
  'event OrderMatched(uint256 indexed orderId, address indexed seller, address indexed buyer, uint256 fillAmount, uint256 rateAmount)',
);
const orderCancelledEvent = parseAbiItem(
  'event OrderCancelled(uint256 indexed orderId, address indexed seller)',
);

// ABI fragment for the orders(uint256) public getter
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

interface OnChainOrder {
  orderId: bigint;
  seller: string;
  resourceToken: string;
  totalAmount: bigint;
  filledAmount: bigint;
  pricePerUnit: bigint;
  status: number;
  timestamp: bigint;
}

interface MatchedTrade {
  resource: ResourceType;
  pricePerUnit: number;
  blockNumber: bigint;
}

const POLL_INTERVAL = 15_000;
const INITIAL_LOOKBACK = 5_000_000n; // ~14 hours on MegaETH's 10ms blocks

/**
 * Reads live order data from the OrderBook contract on MegaETH testnet.
 *
 * Discovers active orders via event logs, reads order details on-chain,
 * and returns OrderBookSnapshot[] matching the existing mock data shape.
 *
 * The OrderBook is sell-side only: all placeOrder calls are SELL orders
 * (seller lists resources for RATE). The matchOrder caller is the buyer.
 * Active orders appear as asks; bids array is always empty.
 */
export function useOrderBook(): {
  snapshots: OrderBookSnapshot[];
  isLive: boolean;
} {
  const [snapshots, setSnapshots] = useState<OrderBookSnapshot[]>([]);
  const [isLive, setIsLive] = useState(false);
  const lastBlockRef = useRef<bigint>(0n);

  useEffect(() => {
    let cancelled = false;

    async function fetchOrderBook() {
      try {
        const currentBlock = await publicClient.getBlockNumber();

        const fromBlock =
          lastBlockRef.current > 0n
            ? lastBlockRef.current + 1n
            : currentBlock > INITIAL_LOOKBACK
              ? currentBlock - INITIAL_LOOKBACK
              : 0n;

        if (fromBlock > currentBlock) return;

        // Fetch placed and matched events in parallel
        const [placedLogs, matchedLogs] = await Promise.all([
          publicClient.getLogs({
            address: ORDER_BOOK,
            event: orderPlacedEvent,
            fromBlock,
            toBlock: currentBlock,
          }),
          publicClient.getLogs({
            address: ORDER_BOOK,
            event: orderMatchedEvent,
            fromBlock,
            toBlock: currentBlock,
          }),
        ]);

        lastBlockRef.current = currentBlock;

        if (cancelled) return;

        // Collect unique order IDs from placed events
        const orderIds = new Set<bigint>();
        for (const log of placedLogs) {
          if (log.args.orderId != null) {
            orderIds.add(log.args.orderId);
          }
        }

        // Batch-read order details from the contract
        const orderResults = await Promise.all(
          Array.from(orderIds).map(async (id): Promise<OnChainOrder | null> => {
            try {
              const result = await publicClient.readContract({
                address: ORDER_BOOK,
                abi: ordersAbi,
                functionName: 'orders',
                args: [id],
              });

              const [orderId, seller, resourceToken, totalAmount, filledAmount, pricePerUnit, status, timestamp] = result;
              return {
                orderId,
                seller,
                resourceToken,
                totalAmount,
                filledAmount,
                pricePerUnit,
                status,
                timestamp,
              };
            } catch {
              return null;
            }
          }),
        );

        if (cancelled) return;

        // Filter to active orders (status 1, not fully filled)
        const activeOrders = orderResults.filter(
          (o): o is OnChainOrder =>
            o !== null && o.status === 1 && o.totalAmount > o.filledAmount,
        );

        // Group active orders by resource for ask levels
        const asksByResource = new Map<ResourceType, OrderBookLevel[]>();

        for (const order of activeOrders) {
          const resource = ADDR_TO_RESOURCE[order.resourceToken.toLowerCase()];
          if (!resource) continue;

          const price = Number(formatUnits(order.pricePerUnit, 18));
          const remainingVolume = Number(
            formatUnits(order.totalAmount - order.filledAmount, 18),
          );

          const levels = asksByResource.get(resource) ?? [];
          // Merge into existing price level or create new one
          const existing = levels.find((l) => l.price === price);
          if (existing) {
            levels[levels.indexOf(existing)] = {
              price: existing.price,
              volume: existing.volume + remainingVolume,
              orderCount: existing.orderCount + 1,
            };
          } else {
            levels.push({ price, volume: remainingVolume, orderCount: 1 });
          }
          asksByResource.set(resource, levels);
        }

        // Compute last trade price per resource from matched events
        const lastTradeByResource = new Map<ResourceType, MatchedTrade>();

        for (const log of matchedLogs) {
          const { orderId, fillAmount, rateAmount } = log.args;
          if (!orderId || !fillAmount || !rateAmount || fillAmount === 0n) continue;

          // Find the resource from the placed event for this order
          const placedLog = placedLogs.find(
            (p) => p.args.orderId === orderId,
          );
          if (!placedLog?.args.resourceToken) continue;

          const resource =
            ADDR_TO_RESOURCE[placedLog.args.resourceToken.toLowerCase()];
          if (!resource) continue;

          const pricePerUnit =
            Number(formatUnits(rateAmount, 18)) /
            Number(formatUnits(fillAmount, 18));

          const prev = lastTradeByResource.get(resource);
          if (!prev || (log.blockNumber ?? 0n) > prev.blockNumber) {
            lastTradeByResource.set(resource, {
              resource,
              pricePerUnit,
              blockNumber: log.blockNumber ?? 0n,
            });
          }
        }

        // Build snapshots for all 7 resources
        const newSnapshots: OrderBookSnapshot[] = ALL_RESOURCES.map(
          (resource) => {
            const asks = (asksByResource.get(resource) ?? []).sort(
              (a, b) => a.price - b.price,
            );
            const lastTrade = lastTradeByResource.get(resource);

            return {
              pair: `${resource}/RATE` as const,
              bids: [],
              asks,
              lastTradePrice: lastTrade?.pricePerUnit ?? 0,
              change24h: 0,
            };
          },
        );

        setSnapshots(newSnapshots);
        setIsLive(true);
      } catch {
        // Silently retry on next interval
      }
    }

    fetchOrderBook();

    const interval = setInterval(fetchOrderBook, POLL_INTERVAL);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return { snapshots, isLive };
}
