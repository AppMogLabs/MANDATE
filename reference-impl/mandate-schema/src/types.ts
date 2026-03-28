/** Canonical resource names in the MANDATE economy */
export type ResourceName =
  | "COMPUTE"
  | "CHIPS"
  | "DATA"
  | "ENERGY"
  | "TALENT"
  | "COOLING"
  | "CLEARANCE";

/** All resource names including the base currency */
export type TokenName = ResourceName | "RATE";

/** Agent archetype roles */
export type AgentRole =
  | "ComputeSuperpower"
  | "DataRichState"
  | "ChipPower"
  | "TalentHub"
  | "RegulatoryPower";

/** Tactical directive priority levels */
export type Priority = "low" | "medium" | "high";

/** Intelligence subscription tiers */
export type IntelligenceTier = "free" | "analyst" | "premium";

/** Time horizon type */
export type TimeHorizonType = "epoch" | "duration" | "indefinite";

/** Price threshold for a single resource */
export interface PriceThreshold {
  readonly maxBuy: number;
  readonly minSell: number;
}

/** Conditional tactical directive */
export interface TacticalDirective {
  readonly condition: string;
  readonly action: string;
  readonly priority: Priority;
}

/** Time horizon configuration */
export interface TimeHorizon {
  readonly type: TimeHorizonType;
  readonly value?: number;
}

/** Counterparty relationship preferences */
export interface CounterpartyPreferences {
  readonly prefer?: readonly number[];
  readonly avoid?: readonly number[];
  readonly block?: readonly number[];
}

/** Risk management constraints */
export interface RiskLimits {
  readonly maxResourceConcentration?: number;
  readonly maxDealExposure?: number;
  readonly maxOpenNegotiations?: number;
}

/**
 * MANDATE Layer 1 (Strategic Intent) + Layer 2 (Tactical Parameters)
 *
 * The human owner's directive to their AI agent. Only strategicIntent
 * is required; all Layer 2 fields are optional tactical refinements.
 */
export interface Mandate {
  readonly strategicIntent: string;
  readonly resourceBudgets?: Readonly<Partial<Record<ResourceName, number>>>;
  readonly priceThresholds?: Readonly<Partial<Record<ResourceName, PriceThreshold>>>;
  readonly counterpartyPreferences?: CounterpartyPreferences;
  readonly riskLimits?: RiskLimits;
  readonly tacticalDirectives?: readonly TacticalDirective[];
  readonly timeHorizon?: TimeHorizon;
}

/** Building in an agent's portfolio */
export interface Building {
  readonly buildingId: number;
  readonly type: string;
  readonly tier: number;
  readonly tileX: number;
  readonly tileY: number;
  readonly productionRate: number;
}

/** Active on-chain commitments */
export interface ActiveCommitments {
  readonly openOrders?: number;
  readonly pendingSettlements?: number;
  readonly activeInsurance?: number;
  readonly activePredictions?: number;
}

/** Epoch progress information */
export interface EpochProgress {
  readonly currentEpoch?: number;
  readonly timeRemaining?: number;
  readonly agiProgressScore?: number;
}

/** Market snapshot for a single resource */
export interface MarketData {
  readonly twapPrice?: number;
  readonly bookDepth?: number;
  readonly recentVolume?: number;
}

/** Active contract clause */
export interface ActiveClause {
  readonly clauseId: number;
  readonly condition: string;
  readonly verified: boolean;
}

/**
 * MANDATE Layer 3 — Machine Context (Game State Snapshot)
 *
 * Read-only on-chain state injected by the runtime before the AI agent
 * processes a mandate. All required fields come from contract reads.
 */
export interface GameState {
  readonly agentId: number;
  readonly role: AgentRole;
  readonly currentBalances: Readonly<Record<TokenName, number>>;
  readonly buildingPortfolio?: readonly Building[];
  readonly reputationScore?: number;
  readonly activeCommitments?: ActiveCommitments;
  readonly epochProgress?: EpochProgress;
  readonly marketSnapshot?: Readonly<Partial<Record<ResourceName, MarketData>>>;
  readonly intelligenceSubscriptions?: { readonly tier: IntelligenceTier };
  readonly activeClauses?: readonly ActiveClause[];
  readonly blockNumber: number;
  readonly timestamp: number;
}

/** Result of a schema validation */
export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}
