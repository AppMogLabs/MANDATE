/**
 * Chain state reader — connects to MegaETH RPC and reads Layer 3 game state.
 * Uses viem for typed contract reads. Populates the mandate schema's Layer 3.
 */

import {
  createPublicClient,
  http,
  formatUnits,
  type PublicClient,
  type Address,
  type Transport,
  type Chain,
} from "viem";
import { ABIS, RESOURCE_NAMES, type ResourceName } from "./contracts.ts";
import type { ContractAddresses } from "../config.ts";
import { log } from "../logging/audit.ts";

/** MegaETH chain definition for viem */
export const megaeth = {
  id: 4326,
  name: "MegaETH",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://carrot.megaeth.com/rpc"] },
  },
} as const satisfies Chain;

export interface ChainState {
  readonly agentId: number;
  readonly role: string;
  readonly balances: Readonly<Record<string, number>>;
  readonly reputationScore: number;
  readonly marketPrices: Readonly<Record<string, number>>;
  readonly epochProgress: {
    readonly currentEpoch: number;
    readonly timeRemaining: number;
  };
  readonly blockNumber: bigint;
  readonly timestamp: number;
  readonly reflexWindowActive: boolean;
}

const ROLE_MAP: Readonly<Record<number, string>> = {
  0: "ComputeSuperpower",
  1: "DataRichState",
  2: "ChipPower",
  3: "TalentHub",
  4: "RegulatoryPower",
};

export function createChainReader(
  rpcUrl: string,
  addresses: ContractAddresses,
): { client: PublicClient<Transport, Chain>; readState: (agentAddress: Address) => Promise<ChainState> } {
  const client = createPublicClient({
    chain: megaeth,
    transport: http(rpcUrl),
  });

  async function readState(agentAddress: Address): Promise<ChainState> {
    const [block, agentIdRaw, roleIdRaw, rateBalance, reputationRaw, currentEpochRaw, epochDurationRaw, reflexActive] =
      await Promise.all([
        client.getBlock({ blockTag: "latest" }),
        safeRead(() =>
          client.readContract({
            address: addresses.agentRegistry,
            abi: ABIS.agentRegistry,
            functionName: "agentIdOf",
            args: [agentAddress],
          }),
        ),
        safeRead(() =>
          client.readContract({
            address: addresses.roleRegistry,
            abi: ABIS.roleRegistry,
            functionName: "getRole",
            args: [agentAddress],
          }),
        ),
        safeRead(() =>
          client.readContract({
            address: addresses.rateToken,
            abi: ABIS.rateToken,
            functionName: "balanceOf",
            args: [agentAddress],
          }),
        ),
        safeRead(() =>
          client.readContract({
            address: addresses.reputationLedger,
            abi: ABIS.reputationLedger,
            functionName: "getReputation",
            args: [agentAddress],
          }),
        ),
        safeRead(() =>
          client.readContract({
            address: addresses.epochManager,
            abi: ABIS.epochManager,
            functionName: "getCurrentEpoch",
          }),
        ),
        safeRead(() =>
          client.readContract({
            address: addresses.epochManager,
            abi: ABIS.epochManager,
            functionName: "getEpochDuration",
          }),
        ),
        safeRead(() =>
          client.readContract({
            address: addresses.reflexWindowManager,
            abi: ABIS.reflexWindowManager,
            functionName: "isReflexActive",
          }),
        ),
      ]);

    // Read resource balances in parallel
    const resourceBalanceResults = await Promise.all(
      RESOURCE_NAMES.map((name) =>
        safeRead(() =>
          client.readContract({
            address: addresses.resourceTokens[name],
            abi: ABIS.resourceToken,
            functionName: "balanceOf",
            args: [agentAddress],
          }),
        ),
      ),
    );

    const balances: Record<string, number> = {
      RATE: toNumber(rateBalance),
    };
    for (let i = 0; i < RESOURCE_NAMES.length; i++) {
      balances[RESOURCE_NAMES[i]] = toNumber(resourceBalanceResults[i]);
    }

    // Read TWAP prices
    const twapResults = await Promise.all(
      RESOURCE_NAMES.map((name) =>
        safeRead(() =>
          client.readContract({
            address: addresses.orderBook,
            abi: ABIS.orderBook,
            functionName: "getTWAP",
            args: [addresses.resourceTokens[name], 3600n],
          }),
        ),
      ),
    );

    const marketPrices: Record<string, number> = {};
    for (let i = 0; i < RESOURCE_NAMES.length; i++) {
      marketPrices[RESOURCE_NAMES[i]] = toNumber(twapResults[i]);
    }

    const currentEpoch = Number(currentEpochRaw ?? 0n);
    const epochDuration = Number(epochDurationRaw ?? 0n);
    const timestamp = Number(block.timestamp);
    const epochStartApprox = currentEpoch * epochDuration;
    const timeRemaining = Math.max(0, epochStartApprox + epochDuration - timestamp);

    log("debug", "Chain state refreshed", {
      blockNumber: Number(block.number),
      rateBalance: balances.RATE,
    });

    return {
      agentId: Number(agentIdRaw ?? 0n),
      role: ROLE_MAP[Number(roleIdRaw ?? 0n)] ?? "Unknown",
      balances,
      reputationScore: toNumber(reputationRaw),
      marketPrices,
      epochProgress: { currentEpoch, timeRemaining },
      blockNumber: block.number,
      timestamp,
      reflexWindowActive: Boolean(reflexActive),
    };
  }

  return { client, readState };
}

function toNumber(raw: unknown, decimals: number = 18): number {
  if (raw === undefined || raw === null) return 0;
  return Number(formatUnits(BigInt(raw as bigint), decimals));
}

async function safeRead<T>(fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn();
  } catch {
    return undefined;
  }
}
