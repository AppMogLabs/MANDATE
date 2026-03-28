import { test, expect, describe } from "bun:test";
import { evaluateClause } from "../evaluate.ts";
import type { ParsedClause, ClauseGameState } from "../types.ts";

function makeGameState(overrides: Partial<ClauseGameState> = {}): ClauseGameState {
  return {
    predictionMarketProbabilities: { "gpu-shortage": 7000 },
    resourceBalances: { COMPUTE: 500000000000000000000n, CHIPS: 2000000000000000000000n },
    twapPrices: { COMPUTE: 5000000000000000000n, CHIPS: 8000000000000000000n },
    currentEpoch: 3,
    epochTimeRemaining: 120,
    ...overrides,
  };
}

function makeParsedClause(overrides: Partial<ParsedClause> = {}): ParsedClause {
  return {
    conditions: [
      {
        source: "PredictionMarket",
        comparator: "gt",
        value: 6000n,
        resourceOrMarketId: "gpu-shortage",
      },
      {
        source: "ResourceBalance",
        comparator: "lt",
        value: 1000000000000000000000n,
        resourceOrMarketId: "COMPUTE",
      },
    ],
    action: {
      actionType: "ORDER_CANCEL",
      params: { reason: "guard-triggered" },
    },
    gasEstimate: 80000,
    opcodeCount: 3,
    verified: true,
    ...overrides,
  };
}

describe("evaluateClause", () => {
  test("triggers when all conditions are met", () => {
    // gpu-shortage probability is 7000 > 6000 ✓
    // COMPUTE balance is 500e18 < 1000e18 ✓
    const clause = makeParsedClause();
    const state = makeGameState();
    const result = evaluateClause(clause, state);

    expect(result.triggered).toBe(true);
    expect(result.action).toBeDefined();
    expect(result.action!.actionType).toBe("ORDER_CANCEL");
  });

  test("does NOT trigger when one condition fails", () => {
    // gpu-shortage probability is 5000, NOT > 6000 ✗
    const clause = makeParsedClause();
    const state = makeGameState({
      predictionMarketProbabilities: { "gpu-shortage": 5000 },
    });
    const result = evaluateClause(clause, state);

    expect(result.triggered).toBe(false);
    expect(result.action).toBeUndefined();
  });

  test("PredictionMarket probability comparison", () => {
    const clause = makeParsedClause({
      conditions: [
        {
          source: "PredictionMarket",
          comparator: "gte",
          value: 5000n,
          resourceOrMarketId: "gpu-shortage",
        },
      ],
    });

    // 7000 >= 5000 ✓
    const resultPass = evaluateClause(clause, makeGameState());
    expect(resultPass.triggered).toBe(true);

    // 4000 >= 5000 ✗
    const resultFail = evaluateClause(
      clause,
      makeGameState({ predictionMarketProbabilities: { "gpu-shortage": 4000 } })
    );
    expect(resultFail.triggered).toBe(false);
  });

  test("ResourceBalance comparison", () => {
    const clause = makeParsedClause({
      conditions: [
        {
          source: "ResourceBalance",
          comparator: "gt",
          value: 1000000000000000000000n,
          resourceOrMarketId: "CHIPS",
        },
      ],
    });

    // CHIPS balance is 2000e18 > 1000e18 ✓
    const result = evaluateClause(clause, makeGameState());
    expect(result.triggered).toBe(true);

    // CHIPS balance is 500e18 > 1000e18 ✗
    const resultFail = evaluateClause(
      clause,
      makeGameState({ resourceBalances: { CHIPS: 500000000000000000000n } })
    );
    expect(resultFail.triggered).toBe(false);
  });

  test("TWAP price comparison", () => {
    const clause = makeParsedClause({
      conditions: [
        {
          source: "TWAP",
          comparator: "gt",
          value: 7000000000000000000n, // 7 RATE
          resourceOrMarketId: "CHIPS",
        },
      ],
    });

    // CHIPS TWAP is 8e18 > 7e18 ✓
    const result = evaluateClause(clause, makeGameState());
    expect(result.triggered).toBe(true);
  });

  test("EpochProgress comparison", () => {
    const clause = makeParsedClause({
      conditions: [
        {
          source: "EpochProgress",
          comparator: "lt",
          value: 200n,
        },
      ],
    });

    // epochTimeRemaining is 120 < 200 ✓
    const result = evaluateClause(clause, makeGameState());
    expect(result.triggered).toBe(true);

    // epochTimeRemaining is 300 < 200 ✗
    const resultFail = evaluateClause(
      clause,
      makeGameState({ epochTimeRemaining: 300 })
    );
    expect(resultFail.triggered).toBe(false);
  });

  test("comparator: gt", () => {
    const clause = makeParsedClause({
      conditions: [{ source: "EpochProgress", comparator: "gt", value: 100n }],
    });
    expect(evaluateClause(clause, makeGameState({ epochTimeRemaining: 120 })).triggered).toBe(true);
    expect(evaluateClause(clause, makeGameState({ epochTimeRemaining: 100 })).triggered).toBe(false);
    expect(evaluateClause(clause, makeGameState({ epochTimeRemaining: 80 })).triggered).toBe(false);
  });

  test("comparator: lt", () => {
    const clause = makeParsedClause({
      conditions: [{ source: "EpochProgress", comparator: "lt", value: 100n }],
    });
    expect(evaluateClause(clause, makeGameState({ epochTimeRemaining: 80 })).triggered).toBe(true);
    expect(evaluateClause(clause, makeGameState({ epochTimeRemaining: 100 })).triggered).toBe(false);
    expect(evaluateClause(clause, makeGameState({ epochTimeRemaining: 120 })).triggered).toBe(false);
  });

  test("comparator: gte", () => {
    const clause = makeParsedClause({
      conditions: [{ source: "EpochProgress", comparator: "gte", value: 100n }],
    });
    expect(evaluateClause(clause, makeGameState({ epochTimeRemaining: 120 })).triggered).toBe(true);
    expect(evaluateClause(clause, makeGameState({ epochTimeRemaining: 100 })).triggered).toBe(true);
    expect(evaluateClause(clause, makeGameState({ epochTimeRemaining: 80 })).triggered).toBe(false);
  });

  test("comparator: lte", () => {
    const clause = makeParsedClause({
      conditions: [{ source: "EpochProgress", comparator: "lte", value: 100n }],
    });
    expect(evaluateClause(clause, makeGameState({ epochTimeRemaining: 80 })).triggered).toBe(true);
    expect(evaluateClause(clause, makeGameState({ epochTimeRemaining: 100 })).triggered).toBe(true);
    expect(evaluateClause(clause, makeGameState({ epochTimeRemaining: 120 })).triggered).toBe(false);
  });

  test("comparator: eq", () => {
    const clause = makeParsedClause({
      conditions: [{ source: "EpochProgress", comparator: "eq", value: 100n }],
    });
    expect(evaluateClause(clause, makeGameState({ epochTimeRemaining: 100 })).triggered).toBe(true);
    expect(evaluateClause(clause, makeGameState({ epochTimeRemaining: 99 })).triggered).toBe(false);
    expect(evaluateClause(clause, makeGameState({ epochTimeRemaining: 101 })).triggered).toBe(false);
  });
});
