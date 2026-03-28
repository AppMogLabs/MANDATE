export type ResourceType =
  | 'COMPUTE' | 'ENERGY' | 'CHIPS' | 'COOLING'
  | 'TALENT' | 'DATA' | 'CLEARANCE';

export interface ResourceBalance {
  resource: ResourceType;
  balance: string;
  production: number;
  consumption: number;
  priceInRate: number;
  change1h: number;
  sparkline: number[];
}

export interface OrderBookLevel {
  price: number;
  volume: number;
  orderCount: number;
}

export interface OrderBookSnapshot {
  pair: `${ResourceType}/RATE`;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  lastTradePrice: number;
  change24h: number;
}

export interface AgentFeedEntry {
  id: string;
  timestamp: number;
  agentName: string;
  action: string;
  detail: string;
  tier: 'critical' | 'warning' | 'info';
  mandateClause?: string;
  resourceType?: ResourceType;
}

export interface HexTile {
  q: number;
  r: number;
  terrain: 'urban' | 'industrial' | 'research' | 'coastal' | 'regulatory' | 'flat';
  owner?: string;
  building?: {
    type: string;
    tier: 1 | 2 | 3;
    producing: ResourceType;
  };
}

export interface EpochState {
  epochNumber: number;
  startTimestamp: number;
  endTimestamp: number;
  timeRemaining: number;
}

export interface WorldEvent {
  id: string;
  timestamp: number;
  category: string;
  headline: string;
  tier: 'free' | 'analyst' | 'premium';
}

export interface AgentReputation {
  agentName: string;
  compositeScore: number;
  dealCompletionRate: number;
  disinformationScore: number;
  anomalyCount: number;
  activityScore: number;
}

export interface EchoOracleEntry {
  agentName: string;
  reliabilityScore: number;
  lastEchoTimestamp: number;
  direction: 'BUY' | 'SELL' | 'HOLD';
  resource: ResourceType;
}

export interface GuardClauseTemplate {
  id: string;
  name: string;
  seller: string;
  sellerReputation: number;
  priceCompute: number;
  verified: boolean;
  activationSuccessRate: number;
  description: string;
}

export interface DataLineageNode {
  id: string;
  sourceHash: string;
  purityScore: number;
  parentId?: string;
  poisoned: boolean;
  label: string;
}

export interface BuildingInfo {
  id: string;
  name: string;
  type: string;
  tier: 1 | 2 | 3;
  producing: ResourceType;
  productionPerHour: number;
  efficiency: number;
  energyConsumption: number;
  talentAllocated: number;
  workerEfficiency: number;
  tileRentPerDay: number;
  upgradeCost?: number;
  upgradeCooldown?: number;
  inputs?: { resource: ResourceType; amountPerHour: number }[];
}

export interface PlayerState {
  name: string;
  role: 'Compute Superpower' | 'Data-Rich State' | 'Chip Power' | 'Talent Hub' | 'Regulatory Power';
  agentName: string;
  rateBalance: string;
  resources: ResourceBalance[];
  currentMandate?: string;
  mandateClarityScore?: number;
  mandateConstraintCount?: number;
  mandateLastUpdated?: string;
  agentConfidence?: 'High' | 'Medium' | 'Low';
}
