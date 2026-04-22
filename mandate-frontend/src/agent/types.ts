/**
 * MANDATE Agent Types — shared between Web Worker and main thread.
 */

// ── Actions ───────────────────────────────────────────────────────────────────

export type ActionType =
  | 'ORDER_PLACE'
  | 'ORDER_BUY'
  | 'ORDER_CANCEL'
  | 'ORDER_MATCH'
  | 'CLAIM_PRODUCTION'
  | 'BUILD'
  | 'DEMOLISH';

export interface ProposedAction {
  readonly type: ActionType;
  readonly params: Record<string, unknown>;
  readonly reasoning: string;
}

// ── Sitrep ────────────────────────────────────────────────────────────────────

export type AlertSeverity = 'critical' | 'warning' | 'info';
export type Confidence = 'high' | 'medium' | 'low';

export interface SitrepAlert {
  readonly severity: AlertSeverity;
  readonly message: string;
  readonly suggestedAction?: string;
}

export interface MandateEffectiveness {
  readonly actionsAttempted: number;
  readonly actionsApproved: number;
  readonly actionsRejected: number;
  readonly rejectionReasons: readonly string[];
}

export interface Sitrep {
  readonly tickNumber: number;
  readonly timestamp: number;
  readonly summary: string;
  readonly marketConditions: string;
  readonly alerts: readonly SitrepAlert[];
  readonly mandateEffectiveness: MandateEffectiveness;
  readonly confidence: Confidence;
}

// ── LLM Response Schema ───────────────────────────────────────────────────────

export interface LLMResponse {
  readonly actions: readonly ProposedAction[];
  readonly sitrep: {
    readonly summary: string;
    readonly market_conditions: string;
    readonly alerts: readonly SitrepAlert[];
    readonly mandate_effectiveness: {
      readonly actions_attempted: number;
      readonly actions_approved: number;
      readonly actions_rejected: number;
      readonly rejection_reasons: readonly string[];
    };
    readonly confidence: Confidence;
  };
}

// ── Mandate ───────────────────────────────────────────────────────────────────

export interface Layer2Constraints {
  readonly trading: {
    readonly aggressiveness: number; // 1-10
    readonly maxSingleTradeSize: number;
    readonly priceFloors: Record<string, number>;
    readonly priceCeilings: Record<string, number>;
    readonly blockedCounterparties: readonly string[];
    readonly minCounterpartyReputation: number;
  };
  readonly reserves: {
    readonly floors: Record<string, number>;
    readonly priorityResource: string;
    readonly secondaryResource: string;
  };
  readonly risk: {
    readonly tolerance: 'conservative' | 'moderate' | 'aggressive';
  };
}

export interface Mandate {
  readonly layer1: string; // Strategic intent (free-form text)
  readonly layer2: Layer2Constraints;
  // Layer 3 is auto-populated from chain state each tick
}

// ── Game State (read from chain) ──────────────────────────────────────────────

export interface OrderLevel {
  readonly price: number;
  readonly volume: number;
}

export interface GameState {
  readonly balances: Record<string, number>;
  readonly rateBalance: number;
  readonly epochNumber: number;
  readonly timeRemaining: number;
  readonly marketPrices: Record<string, number>;
  /** Live ask levels per resource (sell orders on the book) */
  readonly orderBook?: Record<string, readonly OrderLevel[]>;
}

// ── Worker Messages ───────────────────────────────────────────────────────────

export type WorkerInMessage =
  | { type: 'SET_MANDATE'; mandate: Mandate }
  | { type: 'SET_CONFIG'; config: AgentConfig }
  | { type: 'UPDATE_GAME_STATE'; state: GameState }
  | { type: 'START' }
  | { type: 'STOP' }
  | { type: 'TICK_NOW' }
  | { type: 'SIGN_RESULT'; requestId: string; txHash: string | null; error?: string };

export type WorkerOutMessage =
  | { type: 'SITREP'; sitrep: Sitrep }
  | { type: 'SIGN_AND_SUBMIT'; requestId: string; action: ProposedAction }
  | { type: 'STORE_SITREP'; sitrep: Sitrep }
  | { type: 'STATUS'; status: AgentStatus }
  | { type: 'ERROR'; error: string }
  | { type: 'TICK_COMPLETE'; tickNumber: number };

export type AgentStatus = 'idle' | 'running' | 'paused' | 'error';

// ── Config ────────────────────────────────────────────────────────────────────

export interface AgentConfig {
  readonly proxyUrl: string;
  readonly provider: 'anthropic' | 'openai' | 'google';
  readonly model: string;
  readonly sessionToken: string;
  readonly tickIntervalMs: number; // default 30000
  readonly playerAddress: string;
  readonly agentId: number;
  /**
   * Which prompt assembler to use. 'mvp' restricts the agent to trading only
   * (no buildings / production). Default is the full-game assembler.
   */
  readonly promptVariant?: 'full' | 'mvp';
}
