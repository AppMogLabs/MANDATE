'use client';

import { useState, useEffect, useRef } from 'react';
import { createPublicClient, http, formatUnits, parseAbiItem } from 'viem';
import { megaethTestnet } from '@/lib/wagmi-config';
import { TESTNET_ADDRESSES } from '@/lib/addresses';
import { resolveAgentName } from '@/lib/npc-agents';
import type { AgentFeedEntry, ResourceType } from '@/mock/types';

const RESOURCE_ADDRS = TESTNET_ADDRESSES.contracts.resources;

// Reverse lookup: address → resource name
const ADDR_TO_RESOURCE: Record<string, ResourceType> = {};
for (const [name, addr] of Object.entries(RESOURCE_ADDRS)) {
  ADDR_TO_RESOURCE[addr.toLowerCase()] = name as ResourceType;
}

const publicClient = createPublicClient({
  chain: megaethTestnet,
  transport: http(),
});

const ORDER_BOOK = TESTNET_ADDRESSES.contracts.orderBook as `0x${string}`;

// Event signatures
const orderPlacedEvent = parseAbiItem('event OrderPlaced(uint256 indexed orderId, address indexed seller, address indexed resourceToken, uint256 amount, uint256 pricePerUnit)');
const orderMatchedEvent = parseAbiItem('event OrderMatched(uint256 indexed orderId, address indexed seller, address indexed buyer, uint256 fillAmount, uint256 rateAmount)');
const orderCancelledEvent = parseAbiItem('event OrderCancelled(uint256 indexed orderId, address indexed seller)');

/**
 * Hook that reads live OrderBook events from the chain and returns
 * them as AgentFeedEntry[] for the ActivityFeed component.
 */
export function useActivityFeed(playerAddress?: string): {
  entries: AgentFeedEntry[];
  isLive: boolean;
} {
  const [entries, setEntries] = useState<AgentFeedEntry[]>([]);
  const [isLive, setIsLive] = useState(false);
  const lastBlockRef = useRef<bigint>(0n);

  useEffect(() => {
    let cancelled = false;

    async function fetchEvents() {
      try {
        // Get current block
        const currentBlock = await publicClient.getBlockNumber();

        // On first run, look back ~100,000 blocks (~16 minutes on MegaETH's 10ms blocks)
        // On subsequent runs, look from last known block
        const fromBlock = lastBlockRef.current > 0n
          ? lastBlockRef.current + 1n
          : currentBlock > 100_000n ? currentBlock - 100_000n : 0n;

        if (fromBlock > currentBlock) return;

        // Fetch all three event types in parallel
        const [placedLogs, matchedLogs, cancelledLogs] = await Promise.all([
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
          publicClient.getLogs({
            address: ORDER_BOOK,
            event: orderCancelledEvent,
            fromBlock,
            toBlock: currentBlock,
          }),
        ]);

        lastBlockRef.current = currentBlock;

        if (cancelled) return;

        const newEntries: AgentFeedEntry[] = [];

        // Process OrderPlaced events
        for (const log of placedLogs) {
          const { orderId, seller, resourceToken, amount, pricePerUnit } = log.args;
          if (!orderId || !seller || !resourceToken || !amount || !pricePerUnit) continue;

          const resource = ADDR_TO_RESOURCE[resourceToken.toLowerCase()] ?? 'UNKNOWN';
          const amt = Number(formatUnits(amount, 18));
          const price = Number(formatUnits(pricePerUnit, 18));
          const agentName = resolveAgentName(seller, playerAddress);

          newEntries.push({
            id: `placed-${orderId.toString()}-${log.blockNumber}`,
            timestamp: Date.now(),
            agentName,
            action: 'TRADE',
            detail: `Listed ${amt.toFixed(0)} ${resource} for sale @ ${price.toFixed(4)} RATE`,
            tier: agentName === 'Your Agent' ? 'info' : 'info',
            resourceType: resource as ResourceType,
          });
        }

        // Process OrderMatched events
        for (const log of matchedLogs) {
          const { orderId, seller, buyer, fillAmount, rateAmount } = log.args;
          if (!orderId || !seller || !buyer || !fillAmount || !rateAmount) continue;

          const amt = Number(formatUnits(fillAmount, 18));
          const rate = Number(formatUnits(rateAmount, 18));
          const sellerName = resolveAgentName(seller, playerAddress);
          const buyerName = resolveAgentName(buyer, playerAddress);
          const isPlayerInvolved = sellerName === 'Your Agent' || buyerName === 'Your Agent';

          newEntries.push({
            id: `matched-${orderId.toString()}-${log.blockNumber}`,
            timestamp: Date.now(),
            agentName: buyerName,
            action: 'TRADE',
            detail: `Bought ${amt.toFixed(0)} units from ${sellerName} for ${rate.toFixed(2)} RATE`,
            tier: isPlayerInvolved ? 'warning' : 'info',
          });
        }

        // Process OrderCancelled events
        for (const log of cancelledLogs) {
          const { orderId, seller } = log.args;
          if (!orderId || !seller) continue;

          newEntries.push({
            id: `cancelled-${orderId.toString()}-${log.blockNumber}`,
            timestamp: Date.now(),
            agentName: resolveAgentName(seller, playerAddress),
            action: 'TRADE',
            detail: `Cancelled order #${orderId.toString()}`,
            tier: 'info',
          });
        }

        if (newEntries.length > 0) {
          setEntries((prev) => [...prev, ...newEntries].slice(-100)); // Keep last 100
          setIsLive(true);
        }
      } catch {
        // Silently retry on next interval
      }
    }

    // Initial fetch
    fetchEvents();

    // Poll every 10 seconds
    const interval = setInterval(fetchEvents, 10_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [playerAddress]);

  return { entries, isLive };
}
