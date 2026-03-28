/**
 * MNP (MANDATE Negotiation Protocol) message types.
 * Six FIPA performatives for agent-to-agent negotiation.
 */

export type Performative = "propose" | "accept" | "reject" | "counter" | "inform" | "query";

export interface NegotiationOffer {
  readonly resource: string;
  readonly amount: number;
}

export interface NegotiationContent {
  readonly offering: NegotiationOffer;
  readonly requesting: NegotiationOffer;
  readonly expiry: number;
}

export interface NegotiationMessage {
  readonly performative: Performative;
  readonly sender: `0x${string}`;
  readonly receiver: `0x${string}`;
  readonly conversationId: string;
  readonly content: NegotiationContent | Record<string, unknown>;
  readonly signature: `0x${string}`;
  readonly timestamp: number;
}

export interface ConversationState {
  readonly conversationId: string;
  readonly counterparty: `0x${string}`;
  readonly messages: readonly NegotiationMessage[];
  readonly status: "open" | "accepted" | "rejected" | "expired";
}
