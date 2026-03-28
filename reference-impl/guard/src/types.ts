export type ResourceName =
  | "COMPUTE"
  | "CHIPS"
  | "DATA"
  | "ENERGY"
  | "TALENT"
  | "COOLING"
  | "CLEARANCE";

export type ActionType =
  | "ORDER_PLACE"
  | "ORDER_CANCEL"
  | "ORDER_MATCH"
  | "DEAL_SETTLE"
  | "TRANSFER"
  | "FEEDBACK_POST"
  | "RESOURCE_MINT"
  | "RESOURCE_BURN"
  | "NEGOTIATE"
  | "POISON_PIPELINE"
  | "PURGE_DATA";

export interface DealLeg {
  resource: ResourceName;
  amount: number;
  pricePerUnit: number;
}

export interface ProposedAction {
  actionType: ActionType;
  resource?: ResourceName;
  amount?: number;
  pricePerUnit?: number;
  counterpartyId?: number;
  totalRateCost?: number;
  dealLegs?: DealLeg[];
}

export interface OperationalConstraints {
  allowedActions: ActionType[];
  resourceBudgets?: Partial<Record<ResourceName, number>>;
  priceThresholds?: Partial<Record<ResourceName, { maxBuy: number; minSell: number }>>;
  counterpartyPreferences?: { prefer?: number[]; avoid?: number[]; block?: number[] };
  riskLimits?: {
    maxResourceConcentration?: number;
    maxDealExposure?: number;
    maxOpenNegotiations?: number;
  };
}

export interface EpochState {
  cumulativeSpend: Partial<Record<ResourceName, number>>;
  currentRateBalance: number;
  currentResourceBalances: Partial<Record<ResourceName, number>>;
  totalResourceSupply?: Partial<Record<ResourceName, number>>;
}

export interface GuardResult {
  approved: boolean;
  failedCheck?: "allowlist" | "counterparty" | "price" | "budget" | "exposure" | "concentration";
  reason?: string;
}
