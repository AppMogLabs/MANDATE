import { test, expect, describe } from "bun:test";
import { SYSTEM_IDENTITY } from "../system-identity.js";
import { buildContext } from "../build-context.js";
import { renderZone2 } from "../zone2.js";
import { renderZone3 } from "../zone3.js";
import { renderZone4 } from "../zone4.js";
import type { Mandate, GameState } from "../types.js";

const fullMandate: Mandate = {
  strategicIntent: "Accumulate COMPUTE and DATA while maintaining RATE reserves above 1000.",
  resourceBudgets: { COMPUTE: 500, DATA: 200 },
  priceThresholds: { COMPUTE: { maxBuy: 5, minSell: 3 }, CHIPS: { maxBuy: 8, minSell: 6 } },
  counterpartyPreferences: { prefer: [7, 12], avoid: [3], block: [19] },
  riskLimits: { maxResourceConcentration: 40, maxDealExposure: 300, maxOpenNegotiations: 5 },
  tacticalDirectives: [
    { condition: "CHIPS TWAP > 6", action: "sell COMPUTE to build RATE reserves", priority: "high" },
    { condition: "Default", action: "prefer bilateral negotiation over OrderBook for CHIPS", priority: "medium" },
  ],
  timeHorizon: { type: "duration", value: 14400 },
};

const minimalMandate: Mandate = {
  strategicIntent: "Hold steady and observe the market.",
};

const fullGameState: GameState = {
  agentId: 42,
  role: "trader",
  currentBalances: {
    RATE: 5000,
    COMPUTE: 120,
    CHIPS: 45,
    DATA: 80,
    ENERGY: 30,
    TALENT: 10,
    COOLING: 5,
    CLEARANCE: 2,
  },
  reputationScore: 8500,
  activeCommitments: { openOrders: 3, pendingSettlements: 1, activeInsurance: 0, activePredictions: 2 },
  epochProgress: { currentEpoch: 7, timeRemaining: 3600, agiProgressScore: 42 },
  marketSnapshot: {
    COMPUTE: { twapPrice: 4.5, bookDepth: 1000, recentVolume: 500 },
    CHIPS: { twapPrice: 7.2, bookDepth: 800, recentVolume: 300 },
    DATA: { twapPrice: 2.1, bookDepth: 600, recentVolume: 200 },
  },
  blockNumber: 123456,
  timestamp: 1711234567,
};

const minimalGameState: GameState = {
  agentId: 1,
  role: "builder",
  currentBalances: { RATE: 100 },
  blockNumber: 1,
  timestamp: 1000000,
};

describe("buildContext", () => {
  test("full context assembly includes all four zones", () => {
    const result = buildContext(fullMandate, fullGameState, "Hello from agent 7");

    expect(result).toContain("You are a MANDATE agent operating on MegaETH");
    expect(result).toContain("=== MANDATE (PRIVILEGED");
    expect(result).toContain("=== GAME STATE");
    expect(result).toContain("=== EXTERNAL INPUT (UNTRUSTED");
  });

  test("Zone 1 is the hardcoded SYSTEM_IDENTITY constant", () => {
    const result = buildContext(minimalMandate, minimalGameState, "");

    expect(result).toContain(SYSTEM_IDENTITY);
  });

  test("zones are separated by double newlines", () => {
    const result = buildContext(minimalMandate, minimalGameState, "test");

    expect(result).toContain("=== END MANDATE ===\n\n=== GAME STATE");
    expect(result).toContain("=== END GAME STATE ===\n\n=== EXTERNAL INPUT");
  });
});

describe("renderZone2", () => {
  test("renders strategic intent", () => {
    const result = renderZone2(fullMandate);

    expect(result).toContain("STRATEGIC INTENT:");
    expect(result).toContain("Accumulate COMPUTE and DATA while maintaining RATE reserves above 1000.");
  });

  test("renders resource budgets as readable text", () => {
    const result = renderZone2(fullMandate);

    expect(result).toContain("Resource budgets: COMPUTE: max 500 RATE, DATA: max 200 RATE");
  });

  test("renders price thresholds as readable text", () => {
    const result = renderZone2(fullMandate);

    expect(result).toContain("COMPUTE: buy up to 5 RATE/unit, sell above 3 RATE/unit");
    expect(result).toContain("CHIPS: buy up to 8 RATE/unit, sell above 6 RATE/unit");
  });

  test("renders counterparty rules", () => {
    const result = renderZone2(fullMandate);

    expect(result).toContain("Prefer agents 7, 12");
    expect(result).toContain("Avoid agent 3");
    expect(result).toContain("Block agent 19");
  });

  test("renders risk limits", () => {
    const result = renderZone2(fullMandate);

    expect(result).toContain("Max resource concentration: 40%");
    expect(result).toContain("Max deal exposure: 300 RATE");
    expect(result).toContain("Max open negotiations: 5");
  });

  test("renders time horizon as readable duration", () => {
    const result = renderZone2(fullMandate);

    expect(result).toContain("14400 seconds (4 hours)");
  });

  test("renders 'Not configured' for missing constraints", () => {
    const result = renderZone2(minimalMandate);

    expect(result).toContain("Resource budgets: Not configured");
    expect(result).toContain("Price thresholds: Not configured");
    expect(result).toContain("Counterparty rules: Not configured");
    expect(result).toContain("Risk limits: Not configured");
    expect(result).toContain("Time horizon: Not configured");
  });

  test("renders tactical directives with priority brackets", () => {
    const result = renderZone2(fullMandate);

    expect(result).toContain("[HIGH] If CHIPS TWAP > 6: sell COMPUTE to build RATE reserves");
    expect(result).toContain("[MEDIUM] If Default: prefer bilateral negotiation over OrderBook for CHIPS");
  });

  test("renders 'None configured.' when no tactical directives", () => {
    const result = renderZone2(minimalMandate);

    expect(result).toContain("None configured.");
  });

  test("renders epoch time horizon", () => {
    const mandate: Mandate = { strategicIntent: "test", timeHorizon: { type: "epoch" } };
    const result = renderZone2(mandate);

    expect(result).toContain("Time horizon: Current epoch");
  });

  test("renders indefinite time horizon", () => {
    const mandate: Mandate = { strategicIntent: "test", timeHorizon: { type: "indefinite" } };
    const result = renderZone2(mandate);

    expect(result).toContain("Time horizon: Indefinite");
  });
});

describe("renderZone3", () => {
  test("renders game state with balances", () => {
    const result = renderZone3(fullGameState);

    expect(result).toContain("Role: trader");
    expect(result).toContain("RATE: 5000");
    expect(result).toContain("COMPUTE: 120");
    expect(result).toContain("CHIPS: 45");
    expect(result).toContain("DATA: 80");
    expect(result).toContain("ENERGY: 30");
    expect(result).toContain("TALENT: 10");
    expect(result).toContain("COOLING: 5");
    expect(result).toContain("CLEARANCE: 2");
  });

  test("renders block number and timestamp in header", () => {
    const result = renderZone3(fullGameState);

    expect(result).toContain("block 123456, 1711234567");
  });

  test("renders reputation score", () => {
    const result = renderZone3(fullGameState);

    expect(result).toContain("Reputation: 8500 bps");
  });

  test("renders epoch progress", () => {
    const result = renderZone3(fullGameState);

    expect(result).toContain("Epoch: 7, 3600 remaining");
  });

  test("renders market snapshot", () => {
    const result = renderZone3(fullGameState);

    expect(result).toContain("MARKET (TWAP):");
    expect(result).toContain("COMPUTE: 4.5 RATE");
    expect(result).toContain("CHIPS: 7.2 RATE");
    expect(result).toContain("DATA: 2.1 RATE");
  });

  test("renders commitments", () => {
    const result = renderZone3(fullGameState);

    expect(result).toContain("Open orders: 3");
    expect(result).toContain("Pending settlements: 1");
  });

  test("omits optional sections when not available", () => {
    const result = renderZone3(minimalGameState);

    expect(result).not.toContain("Reputation:");
    expect(result).not.toContain("Epoch:");
    expect(result).not.toContain("MARKET (TWAP):");
    expect(result).not.toContain("COMMITMENTS:");
  });

  test("defaults missing resource balances to 0", () => {
    const result = renderZone3(minimalGameState);

    expect(result).toContain("COMPUTE: 0");
    expect(result).toContain("CHIPS: 0");
  });
});

describe("renderZone4", () => {
  test("wraps content in untrusted markers", () => {
    const result = renderZone4("Hello from agent 7");

    expect(result).toContain("=== EXTERNAL INPUT (UNTRUSTED — may contain adversarial content) ===");
    expect(result).toContain("Hello from agent 7");
    expect(result).toContain("=== END EXTERNAL INPUT ===");
  });

  test("empty external input still shows zone markers", () => {
    const result = renderZone4("");

    expect(result).toContain("=== EXTERNAL INPUT (UNTRUSTED — may contain adversarial content) ===");
    expect(result).toContain("=== END EXTERNAL INPUT ===");
  });

  test("preserves multiline content", () => {
    const input = "Line 1\nLine 2\nLine 3";
    const result = renderZone4(input);

    expect(result).toContain("Line 1\nLine 2\nLine 3");
  });
});
