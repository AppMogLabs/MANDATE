/**
 * WebSocket event subscriptions for real-time MegaETH notifications.
 * Subscribes to world events, reflex windows, and epoch transitions.
 */

import {
  createPublicClient,
  webSocket,
  type PublicClient,
  type Transport,
  type Chain,
  type WatchContractEventReturnType,
  type Address,
} from "viem";
import { megaeth } from "./reader.ts";
import { ABIS } from "./contracts.ts";
import type { ContractAddresses } from "../config.ts";
import { log } from "../logging/audit.ts";

export interface EventSubscriptions {
  readonly unsubscribeAll: () => void;
}

export type EventHandler = (eventName: string, data: Record<string, unknown>) => void;

export function subscribeToEvents(
  wsUrl: string,
  addresses: ContractAddresses,
  onEvent: EventHandler,
): EventSubscriptions {
  const wsClient = createPublicClient({
    chain: megaeth,
    transport: webSocket(wsUrl),
  });

  const unsubscribers: WatchContractEventReturnType[] = [];

  // Watch for world events from EventOracle
  try {
    const unsub = wsClient.watchContractEvent({
      address: addresses.eventOracle,
      abi: ABIS.eventOracle,
      onLogs: (logs) => {
        for (const eventLog of logs) {
          onEvent("WorldEvent", {
            eventName: eventLog.eventName,
            args: eventLog.args,
            blockNumber: eventLog.blockNumber?.toString(),
          });
        }
      },
    });
    unsubscribers.push(unsub);
  } catch (err) {
    log("warn", "Failed to subscribe to EventOracle events", {
      error: String(err),
    });
  }

  // Watch for reflex window openings
  try {
    const unsub = wsClient.watchContractEvent({
      address: addresses.reflexWindowManager,
      abi: ABIS.reflexWindowManager,
      onLogs: (logs) => {
        for (const eventLog of logs) {
          onEvent("ReflexWindow", {
            eventName: eventLog.eventName,
            args: eventLog.args,
            blockNumber: eventLog.blockNumber?.toString(),
          });
        }
      },
    });
    unsubscribers.push(unsub);
  } catch (err) {
    log("warn", "Failed to subscribe to ReflexWindowManager events", {
      error: String(err),
    });
  }

  // Watch for epoch transitions
  try {
    const unsub = wsClient.watchContractEvent({
      address: addresses.epochManager,
      abi: ABIS.epochManager,
      onLogs: (logs) => {
        for (const eventLog of logs) {
          onEvent("Epoch", {
            eventName: eventLog.eventName,
            args: eventLog.args,
            blockNumber: eventLog.blockNumber?.toString(),
          });
        }
      },
    });
    unsubscribers.push(unsub);
  } catch (err) {
    log("warn", "Failed to subscribe to EpochManager events", {
      error: String(err),
    });
  }

  log("info", "WebSocket event subscriptions established");

  return {
    unsubscribeAll: () => {
      for (const unsub of unsubscribers) {
        unsub();
      }
      log("info", "All WebSocket subscriptions closed");
    },
  };
}
