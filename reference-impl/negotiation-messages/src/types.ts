export interface MessageBase {
  from: string; // Agent address (0x...)
  signature: string; // EIP-191 personal sign
}

export interface RequestMessage extends MessageBase {
  type: "REQUEST";
  requestId: string;
  resource: string;
  quantity: number;
  maxPrice?: number;
  urgency: "low" | "medium" | "high";
}

export interface ProposeLeg {
  party: "A" | "B";
  gives: string; // Resource name
  amount: number;
  receivesResource: string | null;
  receivesAmount: number;
}

export interface ProposeMessage extends MessageBase {
  type: "PROPOSE";
  proposalId: string;
  to: string;
  legs: ProposeLeg[];
  expiresAt: number;
  nonce: number;
}

export interface CounterMessage extends MessageBase {
  type: "COUNTER";
  proposalId: string; // New proposal ID for this counter
  inResponseTo: string; // Original proposalId being countered
  to: string;
  legs: ProposeLeg[];
  expiresAt: number;
  nonce: number;
}

export interface AcceptMessage extends MessageBase {
  type: "ACCEPT";
  proposalId: string;
  to: string;
  dealHash: string; // keccak256 of agreed Deal struct
}

export interface RejectMessage extends MessageBase {
  type: "REJECT";
  proposalId: string;
  to: string;
  reason?: string;
}

export interface WithdrawMessage extends MessageBase {
  type: "WITHDRAW";
  to: string;
}

export type NegotiationMessage =
  | RequestMessage
  | ProposeMessage
  | CounterMessage
  | AcceptMessage
  | RejectMessage
  | WithdrawMessage;
