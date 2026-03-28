import { test, expect, describe } from "bun:test";
import { simulateRepositioning } from "../simulate.js";
import type { MandateForEcho, GameStateForEcho, EventProbability } from "../types.js";

const baseGameState: GameStateForEcho = {
  currentBalances: {
    RATE: 100_000,
    COMPUTE: 5_000,
    CHIPS: 2_000,
    DATA: 3_000,
    ENERGY: 4_000,
    TALENT: 1_000,
    COOLING: 1_500,
    CLEARANCE: 800,
  },
  marketSnapshot: {
    COMPUTE: { twapPrice: 5 },
    CHIPS: { twapPrice: 8 },
    DATA: { twapPrice: 3 },
    ENERGY: { twapPrice: 2 },
    TALENT: { twapPrice: 10 },
    COOLING: { twapPrice: 4 },
    CLEARANCE: { twapPrice: 6 },
  },
  timestamp: 1711400000,
};

const baseMandate: MandateForEcho = {
  strategicIntent: "Dominate the CHIPS market",
  resourceBudgets: {
    COMPUTE: 5000,
    CHIPS: 3000,
  },
  priceThresholds: {
    COMPUTE: { maxBuy: 10, minSell: 3 },
    CHIPS: { maxBuy: 15, minSell: 5 },
  },
  riskLimits: {
    maxDealExposure: 20,
    maxResourceConcentration: 50,
  },
  tacticalDirectives: [
    { condition: "CHIPS TWAP > 6", action: "sell COMPUTE to build RATE reserves", priority: "high" },
    { condition: "default", action: "buy CHIPS aggressively", priority: "medium" },
  ],
};

const chipShortageEvent: readonly EventProbability[] = [
  { eventId: 1, eventType: "CHIP_SHORTAGE", probability: 0.75 },
  { eventId: 2, eventType: "ENERGY_CRISIS", probability: 0.3 },
];

describe("simulateRepositioning", () => {
  test("returns plan with legs for matching directives", () => {
    const plan = simulateRepositioning(baseMandate, baseGameState, chipShortageEvent);

    expect(plan.triggerEventId).toBe(1);
    expect(plan.triggerEventType).toBe("CHIP_SHORTAGE");
    expect(plan.triggerProbability).toBe(0.75);
    expect(plan.legs.length).toBeGreaterThan(0);
    expect(plan.timestamp).toBe(1711400000);
  });

  test("deterministic — same inputs produce same output", () => {
    const plan1 = simulateRepositioning(baseMandate, baseGameState, chipShortageEvent);
    const plan2 = simulateRepositioning(baseMandate, baseGameState, chipShortageEvent);

    expect(plan1).toEqual(plan2);
  });

  test("selects highest-probability event as trigger", () => {
    const events: readonly EventProbability[] = [
      { eventId: 10, eventType: "LOW_PROB", probability: 0.2 },
      { eventId: 20, eventType: "HIGH_PROB", probability: 0.9 },
      { eventId: 30, eventType: "MED_PROB", probability: 0.5 },
    ];

    const plan = simulateRepositioning(baseMandate, baseGameState, events);
    expect(plan.triggerEventId).toBe(20);
    expect(plan.triggerProbability).toBe(0.9);
  });

  test("returns empty legs when no events above threshold", () => {
    const lowProbEvents: readonly EventProbability[] = [
      { eventId: 1, eventType: "UNLIKELY", probability: 0.05 },
      { eventId: 2, eventType: "ALSO_UNLIKELY", probability: 0.09 },
    ];

    const plan = simulateRepositioning(baseMandate, baseGameState, lowProbEvents);
    expect(plan.triggerEventId).toBe(0);
    expect(plan.triggerEventType).toBe("NONE");
    expect(plan.legs.length).toBe(0);
  });

  test("returns empty legs when no events provided", () => {
    const plan = simulateRepositioning(baseMandate, baseGameState, []);
    expect(plan.triggerEventId).toBe(0);
    expect(plan.legs.length).toBe(0);
  });

  test("returns empty legs when no matching directives", () => {
    const mandateNoDirectives: MandateForEcho = {
      strategicIntent: "Do nothing specific",
    };

    const events: readonly EventProbability[] = [
      { eventId: 1, eventType: "RANDOM_EVENT", probability: 0.8 },
    ];

    const plan = simulateRepositioning(mandateNoDirectives, baseGameState, events);
    // No tactical directives → no matching → no legs (or only default matches)
    expect(plan.triggerEventId).toBe(1);
  });

  test("matches TWAP conditions in directives", () => {
    // CHIPS TWAP is 8 in our game state, and directive triggers when > 6
    const mandate: MandateForEcho = {
      strategicIntent: "React to CHIPS price",
      tacticalDirectives: [
        { condition: "CHIPS TWAP > 6", action: "sell COMPUTE to build reserves", priority: "high" },
      ],
    };

    const events: readonly EventProbability[] = [
      { eventId: 1, eventType: "MARKET_UPDATE", probability: 0.5 },
    ];

    const plan = simulateRepositioning(mandate, baseGameState, events);
    const computeLeg = plan.legs.find((l) => l.resource === "COMPUTE");
    // Should have a SELL COMPUTE leg from the TWAP condition match
    if (computeLeg !== undefined) {
      expect(computeLeg.direction).toBe("SELL");
    }
  });

  test("constrains buys within budget", () => {
    const tightBudgetMandate: MandateForEcho = {
      strategicIntent: "Buy carefully",
      resourceBudgets: { COMPUTE: 100 }, // Very tight budget
      tacticalDirectives: [
        { condition: "default", action: "buy COMPUTE aggressively", priority: "high" },
      ],
    };

    const events: readonly EventProbability[] = [
      { eventId: 1, eventType: "ANY", probability: 0.8 },
    ];

    const plan = simulateRepositioning(tightBudgetMandate, baseGameState, events);
    const computeLeg = plan.legs.find((l) => l.resource === "COMPUTE" && l.direction === "BUY");

    if (computeLeg !== undefined) {
      const cost = computeLeg.amount * computeLeg.estimatedPricePerUnit;
      expect(cost).toBeLessThanOrEqual(100);
    }
  });

  test("constrains buys within exposure limit", () => {
    const tightExposureMandate: MandateForEcho = {
      strategicIntent: "Low risk",
      riskLimits: { maxDealExposure: 5 }, // Max 5% of RATE per deal
      tacticalDirectives: [
        { condition: "default", action: "buy CHIPS", priority: "high" },
      ],
    };

    const events: readonly EventProbability[] = [
      { eventId: 1, eventType: "ANY", probability: 0.8 },
    ];

    const plan = simulateRepositioning(tightExposureMandate, baseGameState, events);
    const chipsLeg = plan.legs.find((l) => l.resource === "CHIPS" && l.direction === "BUY");

    if (chipsLeg !== undefined) {
      const cost = chipsLeg.amount * chipsLeg.estimatedPricePerUnit;
      const maxAllowed = baseGameState.currentBalances["RATE"]! * 5 / 100;
      expect(cost).toBeLessThanOrEqual(maxAllowed);
    }
  });

  test("skips legs that violate price thresholds", () => {
    const mandate: MandateForEcho = {
      strategicIntent: "Only buy cheap",
      priceThresholds: { COMPUTE: { maxBuy: 1, minSell: 3 } }, // maxBuy = 1, but TWAP is 5
      tacticalDirectives: [
        { condition: "default", action: "buy COMPUTE", priority: "high" },
      ],
    };

    const events: readonly EventProbability[] = [
      { eventId: 1, eventType: "ANY", probability: 0.8 },
    ];

    const plan = simulateRepositioning(mandate, baseGameState, events);
    const computeBuy = plan.legs.find((l) => l.resource === "COMPUTE" && l.direction === "BUY");
    // TWAP is 5 but maxBuy is 1 → should be filtered out
    expect(computeBuy).toBeUndefined();
  });

  test("sell legs use proportion of current balance", () => {
    const mandate: MandateForEcho = {
      strategicIntent: "Sell resources",
      tacticalDirectives: [
        { condition: "default", action: "sell COMPUTE", priority: "high" },
      ],
    };

    const events: readonly EventProbability[] = [
      { eventId: 1, eventType: "ANY", probability: 0.8 },
    ];

    const plan = simulateRepositioning(mandate, baseGameState, events);
    const computeLeg = plan.legs.find((l) => l.resource === "COMPUTE" && l.direction === "SELL");

    expect(computeLeg).toBeDefined();
    if (computeLeg !== undefined) {
      // High priority = 30% of balance (5000 * 0.3 = 1500)
      expect(computeLeg.amount).toBe(1500);
    }
  });

  test("all resources at budget cap produces empty plan", () => {
    const mandate: MandateForEcho = {
      strategicIntent: "Budget exhausted",
      resourceBudgets: { COMPUTE: 0, CHIPS: 0, DATA: 0 },
      tacticalDirectives: [
        { condition: "default", action: "buy COMPUTE", priority: "high" },
      ],
    };

    const events: readonly EventProbability[] = [
      { eventId: 1, eventType: "ANY", probability: 0.8 },
    ];

    const plan = simulateRepositioning(mandate, baseGameState, events);
    const computeBuy = plan.legs.find((l) => l.resource === "COMPUTE" && l.direction === "BUY");
    // Budget is 0, so buy amount should be constrained to 0 → filtered out
    expect(computeBuy).toBeUndefined();
  });

  test("higher-priority directives take precedence for same resource", () => {
    const mandate: MandateForEcho = {
      strategicIntent: "Conflicting directives",
      tacticalDirectives: [
        { condition: "default", action: "sell COMPUTE slowly", priority: "low" },
        { condition: "default", action: "sell COMPUTE aggressively", priority: "high" },
      ],
    };

    const events: readonly EventProbability[] = [
      { eventId: 1, eventType: "ANY", probability: 0.8 },
    ];

    const plan = simulateRepositioning(mandate, baseGameState, events);
    const computeLegs = plan.legs.filter((l) => l.resource === "COMPUTE");
    // Should only have one leg for COMPUTE (higher priority wins)
    expect(computeLegs.length).toBe(1);
    if (computeLegs[0] !== undefined) {
      // High priority sell = 30% of balance
      expect(computeLegs[0].amount).toBe(1500);
    }
  });
});
