export type ResourceName = "COMPUTE" | "CHIPS" | "DATA" | "ENERGY" | "TALENT" | "COOLING" | "CLEARANCE";

export const RESOURCE_NAMES: readonly ResourceName[] = [
  "COMPUTE",
  "CHIPS",
  "DATA",
  "ENERGY",
  "TALENT",
  "COOLING",
  "CLEARANCE",
] as const;

export interface GameState {
  readonly agentId: number;
  readonly role: string;
  readonly currentBalances: Readonly<Record<string, number>>;
  readonly buildingPortfolio: ReadonlyArray<{
    readonly buildingId: number;
    readonly type: string;
    readonly tier: number;
    readonly tileX: number;
    readonly tileY: number;
    readonly productionRate: number;
  }>;
  readonly reputationScore: number;
  readonly activeCommitments: {
    readonly openOrders: number;
    readonly pendingSettlements: number;
    readonly activeInsurance: number;
    readonly activePredictions: number;
  };
  readonly epochProgress: {
    readonly currentEpoch: number;
    readonly timeRemaining: number;
    readonly agiProgressScore: number;
  };
  readonly marketSnapshot: Readonly<
    Record<
      string,
      {
        readonly twapPrice: number;
        readonly bookDepth: number;
        readonly recentVolume: number;
      }
    >
  >;
  readonly intelligenceSubscriptions: {
    readonly tier: "free" | "analyst" | "premium";
  };
  readonly activeClauses: ReadonlyArray<{
    readonly clauseId: number;
    readonly condition: string;
    readonly verified: boolean;
  }>;
  readonly blockNumber: number;
  readonly timestamp: number;
}

export interface ContractAddresses {
  readonly agentRegistry: string;
  readonly rateToken: string;
  readonly resourceTokens: Readonly<Record<ResourceName, string>>;
  readonly buildingRegistry: string;
  readonly reputationLedger: string;
  readonly orderBook: string;
  readonly epochManager: string;
  readonly informationMarket: string;
  readonly guardClauseMarketplace: string;
  readonly negotiationSettlement: string;
  readonly roleRegistry: string;
}
