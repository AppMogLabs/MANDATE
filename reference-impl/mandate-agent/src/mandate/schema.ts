/**
 * Mandate type definitions — the three-layer model.
 * Layer 1: Strategic Intent (free-form text)
 * Layer 2: Operational Constraints (structured JSON)
 * Layer 3: Machine Context (populated from chain state, read-only)
 */

export interface MandateSchema {
  readonly version: number;
  readonly timestamp: number;
  readonly player: `0x${string}`;
  readonly agentId: number;
  readonly role: string;

  readonly layer1_strategicIntent: {
    readonly text: string;
  };

  readonly layer2_operationalConstraints: Layer2Constraints;

  readonly layer3_machineContext: Record<string, unknown>;
}

export interface Layer2Constraints {
  readonly trading: {
    readonly aggressiveness: number;
    readonly minimumTradeRatios: Readonly<Record<string, number>>;
    readonly preferredCounterparties: readonly number[];
    readonly blockedCounterparties: readonly number[];
    readonly minimumCounterpartyReputation: number;
  };
  readonly reserves: {
    readonly floors: Readonly<Record<string, number>>;
    readonly priorityResource: string;
    readonly secondaryResource: string;
  };
  readonly risk: {
    readonly maxSingleTradeSize: number;
    readonly reflexWindowParticipation: boolean;
    readonly autoHedgeOnEvent: boolean;
    readonly insuranceCoverage: boolean;
  };
  readonly diplomacy: {
    readonly negotiationStyle: "aggressive" | "neutral" | "conservative";
    readonly allianceWillingness: number;
    readonly informationSharing: "open" | "selective" | "none";
  };
  readonly building: {
    readonly buildPriority: "expand" | "upgrade" | "maintain";
    readonly targetBuilding: string;
    readonly tileExpansionLimit: number;
  };
}

/** Default Layer 2 constraints — "no constraint" values */
export const DEFAULT_LAYER2: Layer2Constraints = {
  trading: {
    aggressiveness: 5,
    minimumTradeRatios: {
      COMPUTE: 1.0, ENERGY: 1.0, CHIPS: 1.0,
      COOLING: 1.0, TALENT: 1.0, DATA: 1.0, CLEARANCE: 1.0,
    },
    preferredCounterparties: [],
    blockedCounterparties: [],
    minimumCounterpartyReputation: 0,
  },
  reserves: {
    floors: {
      COMPUTE: 0, ENERGY: 0, CHIPS: 0,
      COOLING: 0, TALENT: 0, DATA: 0, CLEARANCE: 0,
    },
    priorityResource: "COMPUTE",
    secondaryResource: "CHIPS",
  },
  risk: {
    maxSingleTradeSize: 0,
    reflexWindowParticipation: true,
    autoHedgeOnEvent: false,
    insuranceCoverage: false,
  },
  diplomacy: {
    negotiationStyle: "neutral",
    allianceWillingness: 5,
    informationSharing: "selective",
  },
  building: {
    buildPriority: "expand",
    targetBuilding: "DataCentre",
    tileExpansionLimit: 10,
  },
} as const;

/**
 * Loads a mandate from a local JSON file.
 */
export async function loadMandateFromFile(path: string): Promise<MandateSchema> {
  const file = Bun.file(path);
  const content = await file.json();
  return content as MandateSchema;
}

/**
 * Converts Layer 2 constraints to the guard module's OperationalConstraints format.
 */
export function toGuardConstraints(layer2: Layer2Constraints): Record<string, unknown> {
  return {
    allowedActions: [
      "ORDER_PLACE", "ORDER_CANCEL", "ORDER_MATCH",
      "DEAL_SETTLE", "NEGOTIATE", "FEEDBACK_POST",
    ],
    resourceBudgets: undefined, // Derived from reserves floors at runtime
    priceThresholds: Object.fromEntries(
      Object.entries(layer2.trading.minimumTradeRatios).map(([resource, ratio]) => [
        resource,
        { maxBuy: ratio * 2, minSell: ratio },
      ]),
    ),
    counterpartyPreferences: {
      prefer: [...layer2.trading.preferredCounterparties],
      block: [...layer2.trading.blockedCounterparties],
    },
    riskLimits: {
      maxDealExposure: layer2.risk.maxSingleTradeSize > 0
        ? layer2.risk.maxSingleTradeSize
        : undefined,
    },
  };
}
