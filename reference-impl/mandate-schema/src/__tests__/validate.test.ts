import { test, expect, describe } from "bun:test";
import { validateMandate, validateGameState } from "../validate.js";

// ---------------------------------------------------------------------------
// Mandate validation
// ---------------------------------------------------------------------------

describe("validateMandate", () => {
  const fullMandate = {
    strategicIntent: "Dominate the COMPUTE market through aggressive acquisition",
    resourceBudgets: {
      COMPUTE: 5000,
      CHIPS: 2000,
      DATA: 1000,
    },
    priceThresholds: {
      COMPUTE: { maxBuy: 150, minSell: 200 },
      CHIPS: { maxBuy: 80, minSell: 120 },
    },
    counterpartyPreferences: {
      prefer: [1, 3, 7],
      avoid: [2],
      block: [5],
    },
    riskLimits: {
      maxResourceConcentration: 60,
      maxDealExposure: 25,
      maxOpenNegotiations: 5,
    },
    tacticalDirectives: [
      {
        condition: "COMPUTE price < 100",
        action: "buy aggressively",
        priority: "high" as const,
      },
      {
        condition: "reputation < 3000",
        action: "complete small trades to build trust",
        priority: "medium" as const,
      },
    ],
    timeHorizon: {
      type: "duration" as const,
      value: 10,
    },
  };

  test("accepts valid mandate with all fields", () => {
    const result = validateMandate(fullMandate);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("accepts valid mandate with only strategicIntent", () => {
    const result = validateMandate({
      strategicIntent: "Hold steady and observe the market",
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("rejects missing strategicIntent", () => {
    const result = validateMandate({});
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("strategicIntent"))).toBe(true);
  });

  test("rejects strategicIntent exceeding maxLength", () => {
    const result = validateMandate({
      strategicIntent: "x".repeat(4097),
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("4096"))).toBe(true);
  });

  test("rejects non-object input", () => {
    const result = validateMandate("not an object");
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("object"))).toBe(true);
  });

  test("rejects resourceBudgets with negative values", () => {
    const result = validateMandate({
      strategicIntent: "test",
      resourceBudgets: { COMPUTE: -100 },
    });
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.includes("non-negative integer")),
    ).toBe(true);
  });

  test("rejects resourceBudgets with non-integer values", () => {
    const result = validateMandate({
      strategicIntent: "test",
      resourceBudgets: { COMPUTE: 1.5 },
    });
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.includes("non-negative integer")),
    ).toBe(true);
  });

  test("rejects riskLimits out of range", () => {
    const result = validateMandate({
      strategicIntent: "test",
      riskLimits: {
        maxResourceConcentration: 150,
        maxDealExposure: -1,
      },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
    expect(
      result.errors.some((e) => e.includes("maxResourceConcentration")),
    ).toBe(true);
    expect(result.errors.some((e) => e.includes("maxDealExposure"))).toBe(true);
  });

  test("rejects priceThresholds with negative prices", () => {
    const result = validateMandate({
      strategicIntent: "test",
      priceThresholds: {
        COMPUTE: { maxBuy: -10, minSell: 50 },
      },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("maxBuy"))).toBe(true);
  });

  test("rejects timeHorizon duration without value", () => {
    const result = validateMandate({
      strategicIntent: "test",
      timeHorizon: { type: "duration" },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("value"))).toBe(true);
  });

  test("accepts timeHorizon epoch without value", () => {
    const result = validateMandate({
      strategicIntent: "test",
      timeHorizon: { type: "epoch" },
    });
    expect(result.valid).toBe(true);
  });

  test("accepts timeHorizon indefinite without value", () => {
    const result = validateMandate({
      strategicIntent: "test",
      timeHorizon: { type: "indefinite" },
    });
    expect(result.valid).toBe(true);
  });

  test("rejects unknown priority in tacticalDirectives", () => {
    const result = validateMandate({
      strategicIntent: "test",
      tacticalDirectives: [
        { condition: "x", action: "y", priority: "critical" },
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("priority"))).toBe(true);
  });

  test("rejects unknown resource in resourceBudgets", () => {
    const result = validateMandate({
      strategicIntent: "test",
      resourceBudgets: { UNOBTANIUM: 100 },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("unknown resource"))).toBe(
      true,
    );
  });
});

// ---------------------------------------------------------------------------
// GameState validation
// ---------------------------------------------------------------------------

describe("validateGameState", () => {
  const validGameState = {
    agentId: 42,
    role: "ComputeSuperpower",
    currentBalances: {
      RATE: 10000,
      COMPUTE: 5000,
      CHIPS: 2000,
      DATA: 1500,
      ENERGY: 800,
      TALENT: 600,
      COOLING: 400,
      CLEARANCE: 200,
    },
    buildingPortfolio: [
      {
        buildingId: 1,
        type: "DataCenter",
        tier: 2,
        tileX: 5,
        tileY: 10,
        productionRate: 100.5,
      },
    ],
    reputationScore: 7500,
    activeCommitments: {
      openOrders: 3,
      pendingSettlements: 1,
      activeInsurance: 0,
      activePredictions: 2,
    },
    epochProgress: {
      currentEpoch: 5,
      timeRemaining: 3600,
      agiProgressScore: 45.2,
    },
    marketSnapshot: {
      COMPUTE: { twapPrice: 120.5, bookDepth: 50, recentVolume: 25000 },
    },
    intelligenceSubscriptions: { tier: "analyst" },
    activeClauses: [
      { clauseId: 1, condition: "price > 100", verified: true },
    ],
    blockNumber: 1234567,
    timestamp: 1711152000,
  };

  test("accepts valid game state", () => {
    const result = validateGameState(validGameState);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("accepts minimal valid game state (required fields only)", () => {
    const result = validateGameState({
      agentId: 1,
      role: "DataRichState",
      currentBalances: {
        RATE: 0,
        COMPUTE: 0,
        CHIPS: 0,
        DATA: 0,
        ENERGY: 0,
        TALENT: 0,
        COOLING: 0,
        CLEARANCE: 0,
      },
      blockNumber: 100,
      timestamp: 1711152000,
    });
    expect(result.valid).toBe(true);
  });

  test("rejects missing required fields", () => {
    const result = validateGameState({});
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("agentId"))).toBe(true);
    expect(result.errors.some((e) => e.includes("role"))).toBe(true);
    expect(result.errors.some((e) => e.includes("currentBalances"))).toBe(true);
    expect(result.errors.some((e) => e.includes("blockNumber"))).toBe(true);
    expect(result.errors.some((e) => e.includes("timestamp"))).toBe(true);
  });

  test("rejects invalid role", () => {
    const result = validateGameState({
      agentId: 1,
      role: "InvalidRole",
      currentBalances: {
        RATE: 0,
        COMPUTE: 0,
        CHIPS: 0,
        DATA: 0,
        ENERGY: 0,
        TALENT: 0,
        COOLING: 0,
        CLEARANCE: 0,
      },
      blockNumber: 100,
      timestamp: 1711152000,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("role"))).toBe(true);
  });

  test("rejects missing token in currentBalances", () => {
    const result = validateGameState({
      agentId: 1,
      role: "ChipPower",
      currentBalances: {
        RATE: 0,
        // missing other tokens
      },
      blockNumber: 100,
      timestamp: 1711152000,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("COMPUTE"))).toBe(true);
  });

  test("rejects non-object input", () => {
    const result = validateGameState(null);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("object"))).toBe(true);
  });

  test("rejects invalid reputationScore", () => {
    const result = validateGameState({
      agentId: 1,
      role: "TalentHub",
      currentBalances: {
        RATE: 0,
        COMPUTE: 0,
        CHIPS: 0,
        DATA: 0,
        ENERGY: 0,
        TALENT: 0,
        COOLING: 0,
        CLEARANCE: 0,
      },
      reputationScore: 99999,
      blockNumber: 100,
      timestamp: 1711152000,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("reputationScore"))).toBe(true);
  });
});
