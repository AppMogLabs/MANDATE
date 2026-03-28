export type ResourceName = "COMPUTE" | "CHIPS" | "DATA" | "ENERGY" | "TALENT" | "COOLING" | "CLEARANCE";

export interface Mandate {
  strategicIntent: string;
  resourceBudgets?: Partial<Record<ResourceName, number>>;
  priceThresholds?: Partial<Record<ResourceName, { maxBuy: number; minSell: number }>>;
  counterpartyPreferences?: { prefer?: number[]; avoid?: number[]; block?: number[] };
  riskLimits?: { maxResourceConcentration?: number; maxDealExposure?: number; maxOpenNegotiations?: number };
  tacticalDirectives?: Array<{ condition: string; action: string; priority: "low" | "medium" | "high" }>;
  timeHorizon?: { type: "epoch" | "duration" | "indefinite"; value?: number };
}

export interface GameState {
  agentId: number;
  role: string;
  currentBalances: Record<string, number>;
  buildingPortfolio?: Array<{ buildingId: number; type: string; tier: number; tileX: number; tileY: number; productionRate: number }>;
  reputationScore?: number;
  activeCommitments?: { openOrders: number; pendingSettlements: number; activeInsurance: number; activePredictions: number };
  epochProgress?: { currentEpoch: number; timeRemaining: number; agiProgressScore: number };
  marketSnapshot?: Record<string, { twapPrice: number; bookDepth: number; recentVolume: number }>;
  intelligenceSubscriptions?: { tier: "free" | "analyst" | "premium" };
  activeClauses?: Array<{ clauseId: number; condition: string; verified: boolean }>;
  blockNumber: number;
  timestamp: number;
}

export interface ToolCallInterface {
  queryOrderBook(pair: string, depth: number): Promise<OrderBookSnapshot>;
  queryReputation(agentId: number): Promise<ReputationData>;
  queryPurityScore(agentId: number): Promise<number>;
  queryEchoReliability(agentId: number): Promise<number>;
  queryPredictionMarket(eventId: number): Promise<PredictionData>;
  sendNegotiationMessage(to: string, message: unknown): Promise<{ sent: boolean; error?: string }>;
  submitAction(actionType: string, params: Record<string, unknown>): Promise<{ txHash?: string; error?: string }>;
}

export interface OrderBookSnapshot {
  pair: string;
  bids: Array<{ price: number; amount: number }>;
  asks: Array<{ price: number; amount: number }>;
}

export interface ReputationData {
  agentId: number;
  compositeScore: number;
  dealRate: number;
  disinfo: number;
  anomalies: number;
  activity: number;
}

export interface PredictionData {
  eventId: number;
  probability: number;
  totalStaked: number;
}
