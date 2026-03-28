/**
 * Echo Simulator Types
 *
 * Types for the echo simulation hook that connects the MandateEchoOracle
 * to agent cognition. The simulator reads mandate + game state + prediction
 * market probabilities and generates a deterministic repositioning plan.
 *
 * Reference implementation — players may replace with custom simulation logic.
 */

export type ResourceName =
  | "COMPUTE"
  | "CHIPS"
  | "DATA"
  | "ENERGY"
  | "TALENT"
  | "COOLING"
  | "CLEARANCE";

export const RESOURCE_NAMES: readonly ResourceName[] = [
  "COMPUTE", "CHIPS", "DATA", "ENERGY", "TALENT", "COOLING", "CLEARANCE",
] as const;

/** A predicted world event with its probability from PredictionMarket */
export interface EventProbability {
  readonly eventId: number;
  readonly eventType: string;
  readonly probability: number; // 0-1 (from PredictionMarket AMM)
}

/** Direction of a planned resource repositioning */
export type TradeDirection = "BUY" | "SELL";

/** A single repositioning leg — one resource trade the agent would make */
export interface RepositioningLeg {
  readonly resource: ResourceName;
  readonly direction: TradeDirection;
  readonly amount: number;
  readonly estimatedPricePerUnit: number; // RATE per unit, from TWAP
}

/**
 * The full repositioning plan — what the agent would do if the
 * highest-probability event fires. Each leg is a planned trade.
 */
export interface RepositioningPlan {
  readonly triggerEventId: number;
  readonly triggerEventType: string;
  readonly triggerProbability: number;
  readonly legs: readonly RepositioningLeg[];
  readonly timestamp: number;
}

/**
 * The echo commitment — wraps the hash with a nonce for commit-reveal.
 * The agent stores the nonce privately; the commitment goes on-chain.
 */
export interface EchoCommitment {
  readonly commitment: string;  // bytes32 hex string (keccak256)
  readonly nonce: number;
  readonly plan: RepositioningPlan;
}

/**
 * Simplified mandate interface — only the fields the echo simulator reads.
 * Compatible with @mandate/schema Mandate type.
 */
export interface MandateForEcho {
  readonly strategicIntent: string;
  readonly resourceBudgets?: Readonly<Partial<Record<ResourceName, number>>>;
  readonly priceThresholds?: Readonly<Partial<Record<ResourceName, { maxBuy: number; minSell: number }>>>;
  readonly riskLimits?: {
    readonly maxDealExposure?: number;
    readonly maxResourceConcentration?: number;
  };
  readonly tacticalDirectives?: readonly {
    readonly condition: string;
    readonly action: string;
    readonly priority: "low" | "medium" | "high";
  }[];
}

/**
 * Simplified game state — only the fields the echo simulator reads.
 * Compatible with @mandate/state-indexer GameState type.
 */
export interface GameStateForEcho {
  readonly currentBalances: Readonly<Record<string, number>>;
  readonly marketSnapshot?: Readonly<Partial<Record<ResourceName, {
    readonly twapPrice: number;
  }>>>;
  readonly timestamp: number;
}

/** MandateEchoOracle ABI fragment for commitVector */
export const ECHO_ORACLE_ABI = [
  "function commitVector(bytes32 hash) external payable",
  "function lastCommitBlock(address agent) view returns (uint256)",
  "function totalCommitments(address agent) view returns (uint256)",
  "function echos(bytes32 hash) view returns (bytes32, address, uint64, uint64, bool)",
] as const;
