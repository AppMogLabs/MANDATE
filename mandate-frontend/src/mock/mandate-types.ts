import type { ResourceType } from './types';

export type PlayerRole = 'Compute Superpower' | 'Data-Rich State' | 'Chip Power' | 'Talent Hub' | 'Regulatory Power';

export type MandateCategory = 'aggressive' | 'defensive' | 'economic' | 'diplomatic' | 'balanced';

export type NegotiationStyle = 'cooperative' | 'neutral' | 'aggressive';
export type InfoSharing = 'none' | 'selective' | 'open';
export type BuildPriority = 'expand' | 'upgrade' | 'consolidate';

export interface ConstraintValues {
  trading: {
    aggressiveness: number; // 1-10
    minTradeRatios: Partial<Record<ResourceType, number>>;
    preferredCounterparties: string[];
    blockedCounterparties: string[];
    minCounterpartyReputation: number;
  };
  resources: {
    reserveFloors: Partial<Record<ResourceType, number>>;
    priorityResource: ResourceType | null;
    secondaryResource: ResourceType | null;
  };
  risk: {
    maxSingleTradeSize: number | null; // null = unlimited
    reflexWindowParticipation: boolean;
    autoHedgeOnEvent: boolean;
    insuranceCoverage: boolean;
  };
  diplomacy: {
    negotiationStyle: NegotiationStyle;
    allianceWillingness: number; // 1-10
    informationSharing: InfoSharing;
  };
  building: {
    buildPriority: BuildPriority;
    targetBuilding: string | null;
    tileExpansionLimit: number;
  };
}

export const DEFAULT_CONSTRAINTS: ConstraintValues = {
  trading: {
    aggressiveness: 5,
    minTradeRatios: {},
    preferredCounterparties: [],
    blockedCounterparties: [],
    minCounterpartyReputation: 0,
  },
  resources: {
    reserveFloors: {},
    priorityResource: null,
    secondaryResource: null,
  },
  risk: {
    maxSingleTradeSize: null,
    reflexWindowParticipation: true,
    autoHedgeOnEvent: false,
    insuranceCoverage: false,
  },
  diplomacy: {
    negotiationStyle: 'neutral',
    allianceWillingness: 5,
    informationSharing: 'selective',
  },
  building: {
    buildPriority: 'expand',
    targetBuilding: null,
    tileExpansionLimit: 10,
  },
};

export interface MandateTemplate {
  id: string;
  name: string;
  category: MandateCategory;
  applicableRoles: PlayerRole[];
  text: string;
  constraints: ConstraintValues;
}

export interface InterpretationStep {
  action: string;
  details: string[];
  resource?: ResourceType;
  priority: 'high' | 'medium' | 'low';
}

export interface MockInterpretation {
  keywords: string[];
  plan: InterpretationStep[];
  constraintsDetected: number;
  conflicts: string[];
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  warnings: string[];
}

export interface ClarityBreakdown {
  specificity: number; // 0-25
  constraints: number; // 0-25
  priorities: number;  // 0-25
  completeness: number; // 0-25
  total: number;
}

export interface MandateVersion {
  id: string;
  version: number;
  text: string;
  constraints: ConstraintValues;
  timestamp: number;
  isDraft: boolean;
  performance?: {
    tradesExecuted: number;
    netPnL: number;
    duration: string;
  };
}
