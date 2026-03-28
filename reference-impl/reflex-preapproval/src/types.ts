/** Event types that can trigger reflex windows */
export type ReflexEventType =
  | "CHIP_SHORTAGE"
  | "ENERGY_CRISIS"
  | "COOLING_CASCADE"
  | "REGULATORY_CRACKDOWN"
  | "DATA_BREACH"
  | "TALENT_EXODUS"
  | "MARKET_CRASH"
  | "WORLD_EVENT";

/** Action types that can be pre-approved for reflex execution */
export type ReflexActionType = "ORDER_CANCEL" | "HEDGE_ACTIVATE" | "POSITION_ADJUST";

/** A pre-signed reflex action ready for immediate submission */
export interface PreApproval {
  readonly clauseId: number;
  readonly eventType: ReflexEventType;
  readonly action: {
    readonly actionType: ReflexActionType;
    readonly params: Record<string, string | number | boolean>;
  };
  readonly guardSignature: string;
  readonly expiresAtBlock: number;
  readonly agentAddress: string;
  readonly orderId?: number;
}

/** Result of attempting to generate a pre-approval */
export interface PreApprovalResult {
  readonly generated: boolean;
  readonly preApproval?: PreApproval;
  readonly reason?: string;
}

/** Result of submitting a reflex action */
export interface SubmitResult {
  readonly success: boolean;
  readonly txHash?: string;
  readonly error?: string;
}

/** Configuration for the pre-approval refresh logic */
export interface RefreshThresholds {
  readonly priceChangePercent: number;
  readonly balanceChangePercent: number;
  readonly maxAgeBlocks: number;
}

/** Simplified parsed clause (compatible with @mandate/clause-parser ParsedClause) */
export interface ParsedClauseForReflex {
  readonly clauseId: number;
  readonly conditions: readonly {
    readonly source: string;
    readonly comparator: string;
    readonly value: bigint;
    readonly resourceOrMarketId?: string;
  }[];
  readonly action: {
    readonly actionType: ReflexActionType;
    readonly params: Record<string, string | number | boolean>;
  };
  readonly gasEstimate: number;
}

/** Simplified game state for pre-approval decisions */
export interface ReflexGameState {
  readonly currentBalances: Record<string, number>;
  readonly marketSnapshot: Record<string, { twapPrice: number }>;
  readonly predictionProbabilities: Record<string, number>;
  readonly currentBlock: number;
  readonly rateBalance: number;
}

/** Simplified operational constraints (compatible with @mandate/guard) */
export interface ReflexConstraints {
  readonly allowedActions: string[];
  readonly resourceBudgets?: Partial<Record<string, number>>;
  readonly priceThresholds?: Partial<Record<string, { maxBuy: number; minSell: number }>>;
  readonly riskLimits?: {
    readonly maxDealExposure?: number;
  };
}

/** EIP-712 domain and type for reflex pre-approvals */
export const REFLEX_PREAPPROVAL_DOMAIN = {
  name: "MANDATE ReflexPreApproval",
  version: "1",
} as const;

export const REFLEX_PREAPPROVAL_TYPES = {
  ReflexAction: [
    { name: "clauseId", type: "uint256" },
    { name: "eventType", type: "string" },
    { name: "actionType", type: "string" },
    { name: "orderId", type: "uint256" },
    { name: "expiresAtBlock", type: "uint256" },
    { name: "agentAddress", type: "address" },
  ],
} as const;

export const REFLEX_WINDOW_ABI = [
  "function isReflexActive(uint256 eventId) view returns (bool)",
  "function hasUsedNonce(address agent, uint256 eventId) view returns (bool)",
  "function markNonceUsed(address agent, uint256 eventId)",
] as const;

export const ORDER_BOOK_REFLEX_ABI = [
  "function executeReflexCancellation(uint256 orderId, bytes32 guardHash) external",
] as const;
