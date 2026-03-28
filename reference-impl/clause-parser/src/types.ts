/** Maximum opcodes per clause template */
export const MAX_OPCODES = 8;

/** Maximum gas estimate for a valid clause */
export const MAX_GAS_ESTIMATE = 150_000;

/** Whitelisted data sources for conditions */
export type ConditionSource = "PredictionMarket" | "ResourceBalance" | "TWAP" | "EpochProgress";

/** Comparison operators */
export type Comparator = "gt" | "lt" | "gte" | "lte" | "eq";

/** A single condition in a parsed clause */
export interface Condition {
  readonly source: ConditionSource;
  readonly comparator: Comparator;
  readonly value: bigint;
  readonly resourceOrMarketId?: string;  // resource name or market event ID
}

/** Action types that can be triggered by a clause */
export type ClauseActionType = "ORDER_CANCEL" | "HEDGE_ACTIVATE" | "POSITION_ADJUST";

/** The action to execute if all conditions pass */
export interface ClauseAction {
  readonly actionType: ClauseActionType;
  readonly params: Record<string, string | number | boolean>;
}

/** A fully parsed clause ready for evaluation */
export interface ParsedClause {
  readonly conditions: readonly Condition[];
  readonly action: ClauseAction;
  readonly gasEstimate: number;
  readonly opcodeCount: number;
  readonly verified: boolean;
}

/** Result of parsing a clause template */
export interface ParseResult {
  readonly success: boolean;
  readonly clause?: ParsedClause;
  readonly errors: readonly string[];
}

/**
 * Raw clause template format — the JSON structure that encodes a guard clause.
 * This is what the marketplace UI produces and what gets encoded as bytes for the on-chain contract.
 */
export interface ClauseTemplate {
  readonly version: 1;
  readonly conditions: readonly {
    readonly source: string;
    readonly comparator: string;
    readonly value: string;          // String representation of bigint
    readonly resourceOrMarketId?: string;
  }[];
  readonly action: {
    readonly actionType: string;
    readonly params: Record<string, string | number | boolean>;
  };
  readonly gasEstimate: number;
}

/** Simplified game state for clause evaluation */
export interface ClauseGameState {
  readonly predictionMarketProbabilities: Readonly<Record<string, number>>;  // eventId -> probability (0-10000 bps)
  readonly resourceBalances: Readonly<Record<string, bigint>>;               // resource name -> balance in wei
  readonly twapPrices: Readonly<Record<string, bigint>>;                     // resource name -> TWAP price in wei
  readonly currentEpoch: number;
  readonly epochTimeRemaining: number;
}
