import { describe, test, expect } from "bun:test";
import { shouldRefresh } from "../refresh.js";
import type { ReflexGameState, RefreshThresholds } from "../types.js";

const DEFAULT_THRESHOLDS: RefreshThresholds = {
  priceChangePercent: 5,
  balanceChangePercent: 10,
  maxAgeBlocks: 500,
};

function makeState(overrides?: Partial<ReflexGameState>): ReflexGameState {
  return {
    currentBalances: { COMPUTE: 1000, ENERGY: 500 },
    marketSnapshot: {
      COMPUTE: { twapPrice: 100 },
      ENERGY: { twapPrice: 50 },
    },
    predictionProbabilities: { CHIP_SHORTAGE: 0.3 },
    currentBlock: 5000,
    rateBalance: 10_000,
    ...overrides,
  };
}

describe("shouldRefresh", () => {
  test("no refresh needed when nothing changed", () => {
    const state = makeState();
    const result = shouldRefresh(state, state, DEFAULT_THRESHOLDS);

    expect(result.refresh).toBe(false);
    expect(result.reasons).toHaveLength(0);
  });

  test("refresh triggered by price change above threshold", () => {
    const lastState = makeState();
    const currentState = makeState({
      marketSnapshot: {
        COMPUTE: { twapPrice: 110 }, // 10% change, threshold is 5%
        ENERGY: { twapPrice: 50 },
      },
    });

    const result = shouldRefresh(currentState, lastState, DEFAULT_THRESHOLDS);

    expect(result.refresh).toBe(true);
    expect(result.reasons.length).toBeGreaterThanOrEqual(1);
    expect(result.reasons.some((r) => r.includes("COMPUTE") && r.includes("price"))).toBe(
      true,
    );
  });

  test("refresh triggered by balance change above threshold", () => {
    const lastState = makeState();
    const currentState = makeState({
      currentBalances: { COMPUTE: 850, ENERGY: 500 }, // 15% change, threshold is 10%
    });

    const result = shouldRefresh(currentState, lastState, DEFAULT_THRESHOLDS);

    expect(result.refresh).toBe(true);
    expect(result.reasons.length).toBeGreaterThanOrEqual(1);
    expect(
      result.reasons.some((r) => r.includes("COMPUTE") && r.includes("Balance")),
    ).toBe(true);
  });

  test("refresh triggered by age exceeding max", () => {
    const lastState = makeState({ currentBlock: 4000 });
    const currentState = makeState({ currentBlock: 5000 }); // 1000 blocks > 500 threshold

    const result = shouldRefresh(currentState, lastState, DEFAULT_THRESHOLDS);

    expect(result.refresh).toBe(true);
    expect(result.reasons.some((r) => r.includes("age"))).toBe(true);
  });

  test("multiple reasons when multiple thresholds exceeded", () => {
    const lastState = makeState({ currentBlock: 4000 });
    const currentState = makeState({
      currentBlock: 5000, // age exceeded
      marketSnapshot: {
        COMPUTE: { twapPrice: 120 }, // price exceeded
        ENERGY: { twapPrice: 50 },
      },
      currentBalances: { COMPUTE: 800, ENERGY: 500 }, // balance exceeded
    });

    const result = shouldRefresh(currentState, lastState, DEFAULT_THRESHOLDS);

    expect(result.refresh).toBe(true);
    expect(result.reasons.length).toBeGreaterThanOrEqual(3);
  });

  test("edge case: exactly at threshold (no refresh)", () => {
    const lastState = makeState();
    const currentState = makeState({
      marketSnapshot: {
        COMPUTE: { twapPrice: 105 }, // exactly 5% change, threshold is >5%
        ENERGY: { twapPrice: 50 },
      },
      currentBalances: { COMPUTE: 900, ENERGY: 500 }, // exactly 10% change
      currentBlock: 5500, // exactly 500 blocks
    });

    const result = shouldRefresh(currentState, lastState, DEFAULT_THRESHOLDS);

    expect(result.refresh).toBe(false);
    expect(result.reasons).toHaveLength(0);
  });
});
