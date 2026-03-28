/**
 * NegotiationSettlement integration — constructs and submits dual-signature settlements.
 */

import {
  type Address,
  type Hash,
  type WalletClient,
  type PublicClient,
  type Transport,
  type Chain,
  encodePacked,
  keccak256,
} from "viem";
import { ABIS } from "../chain/contracts.ts";
import type { ContractAddresses } from "../config.ts";
import { log } from "../logging/audit.ts";

export interface DealLeg {
  readonly resource: Address;
  readonly amount: bigint;
}

export interface Deal {
  readonly agentA: Address;
  readonly agentB: Address;
  readonly agentAGives: readonly DealLeg[];
  readonly agentBGives: readonly DealLeg[];
  readonly nonce: bigint;
  readonly expiresAt: bigint;
}

/**
 * Fetches the current pair nonce from NegotiationSettlement for two agents.
 */
export async function getPairNonce(
  publicClient: PublicClient<Transport, Chain>,
  addresses: ContractAddresses,
  agentA: Address,
  agentB: Address,
): Promise<bigint> {
  const nonce = await publicClient.readContract({
    address: addresses.negotiationSettlement,
    abi: ABIS.negotiationSettlement,
    functionName: "getPairNonce",
    args: [agentA, agentB],
  });
  return nonce as bigint;
}

/**
 * Gets the EIP-712 digest for a deal (for signing).
 */
export async function getDealDigest(
  publicClient: PublicClient<Transport, Chain>,
  addresses: ContractAddresses,
  deal: Deal,
): Promise<`0x${string}`> {
  const digest = await publicClient.readContract({
    address: addresses.negotiationSettlement,
    abi: ABIS.negotiationSettlement,
    functionName: "getDealDigest",
    args: [deal],
  });
  return digest as `0x${string}`;
}

/**
 * Settles a deal on-chain with dual signatures.
 */
export async function settleDeal(
  walletClient: WalletClient,
  addresses: ContractAddresses,
  deal: Deal,
  sigA: `0x${string}`,
  sigB: `0x${string}`,
): Promise<Hash> {
  log("info", "Settling negotiated deal on-chain", {
    agentA: deal.agentA,
    agentB: deal.agentB,
    legsA: deal.agentAGives.length,
    legsB: deal.agentBGives.length,
  });

  return walletClient.writeContract({
    address: addresses.negotiationSettlement,
    abi: ABIS.negotiationSettlement,
    functionName: "settleDeal",
    args: [deal, sigA, sigB],
  });
}
