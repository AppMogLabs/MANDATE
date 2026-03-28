/**
 * MNP Client — sends negotiation messages to other agents via HTTP.
 * Discovers agent endpoints via AgentRegistry's agentURI field (ERC-8004).
 */

import type { Address, PublicClient, Transport, Chain } from "viem";
import { ABIS } from "../chain/contracts.ts";
import type { ContractAddresses } from "../config.ts";
import type { NegotiationMessage, Performative, NegotiationContent } from "./types.ts";
import { log } from "../logging/audit.ts";

export class MNPClient {
  private readonly publicClient: PublicClient<Transport, Chain>;
  private readonly addresses: ContractAddresses;
  private readonly agentAddress: Address;
  private readonly endpointCache: Map<Address, string> = new Map();

  constructor(
    publicClient: PublicClient<Transport, Chain>,
    addresses: ContractAddresses,
    agentAddress: Address,
  ) {
    this.publicClient = publicClient;
    this.addresses = addresses;
    this.agentAddress = agentAddress;
  }

  /**
   * Discovers another agent's negotiation endpoint from the AgentRegistry.
   */
  async discoverEndpoint(agentAddress: Address): Promise<string | null> {
    const cached = this.endpointCache.get(agentAddress);
    if (cached) return cached;

    try {
      const agentId = (await this.publicClient.readContract({
        address: this.addresses.agentRegistry,
        abi: ABIS.agentRegistry,
        functionName: "agentIdOf",
        args: [agentAddress],
      })) as bigint;

      const uri = (await this.publicClient.readContract({
        address: this.addresses.agentRegistry,
        abi: ABIS.agentRegistry,
        functionName: "tokenURI",
        args: [agentId],
      })) as string;

      // Parse the agentURI to extract the negotiation endpoint
      const parsed = JSON.parse(uri) as { negotiationEndpoint?: string };
      const endpoint = parsed.negotiationEndpoint;

      if (endpoint) {
        this.endpointCache.set(agentAddress, endpoint);
        return endpoint;
      }
    } catch (err) {
      log("warn", "Failed to discover agent endpoint", {
        agent: agentAddress,
        error: String(err),
      });
    }

    return null;
  }

  /**
   * Sends a negotiation message to another agent.
   */
  async sendMessage(
    receiver: Address,
    performative: Performative,
    content: NegotiationContent | Record<string, unknown>,
    conversationId: string,
    signature: `0x${string}`,
  ): Promise<boolean> {
    const endpoint = await this.discoverEndpoint(receiver);
    if (!endpoint) {
      log("warn", "No endpoint found for agent", { receiver });
      return false;
    }

    const message: NegotiationMessage = {
      performative,
      sender: this.agentAddress as `0x${string}`,
      receiver: receiver as `0x${string}`,
      conversationId,
      content,
      signature,
      timestamp: Math.floor(Date.now() / 1000),
    };

    try {
      const response = await fetch(`${endpoint}/negotiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        log("warn", "Negotiation message rejected", {
          receiver,
          status: response.status,
        });
        return false;
      }

      log("info", "Negotiation message sent", {
        performative,
        receiver,
        conversationId,
      });
      return true;
    } catch (err) {
      log("error", "Failed to send negotiation message", {
        receiver,
        error: String(err),
      });
      return false;
    }
  }
}
