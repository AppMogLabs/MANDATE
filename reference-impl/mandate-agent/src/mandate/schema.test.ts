import { test, expect } from "bun:test";
import { DEFAULT_LAYER2, toGuardConstraints, type MandateSchema } from "./schema.ts";

test("DEFAULT_LAYER2 has neutral defaults", () => {
  expect(DEFAULT_LAYER2.trading.aggressiveness).toBe(5);
  expect(DEFAULT_LAYER2.reserves.floors.COMPUTE).toBe(0);
  expect(DEFAULT_LAYER2.risk.maxSingleTradeSize).toBe(0);
  expect(DEFAULT_LAYER2.diplomacy.negotiationStyle).toBe("neutral");
});

test("toGuardConstraints converts layer2 to guard format", () => {
  const constraints = toGuardConstraints(DEFAULT_LAYER2);
  expect(constraints.allowedActions).toContain("ORDER_PLACE");
  expect(constraints.allowedActions).toContain("ORDER_CANCEL");
  expect(constraints.counterpartyPreferences).toBeDefined();
});

test("toGuardConstraints respects blocked counterparties", () => {
  const layer2 = {
    ...DEFAULT_LAYER2,
    trading: {
      ...DEFAULT_LAYER2.trading,
      blockedCounterparties: [42, 99],
    },
  };
  const constraints = toGuardConstraints(layer2);
  const prefs = constraints.counterpartyPreferences as { block: number[] };
  expect(prefs.block).toContain(42);
  expect(prefs.block).toContain(99);
});

test("toGuardConstraints maps price thresholds from trade ratios", () => {
  const constraints = toGuardConstraints(DEFAULT_LAYER2);
  const thresholds = constraints.priceThresholds as Record<string, { maxBuy: number; minSell: number }>;
  expect(thresholds.COMPUTE.minSell).toBe(1.0);
  expect(thresholds.COMPUTE.maxBuy).toBe(2.0);
});
