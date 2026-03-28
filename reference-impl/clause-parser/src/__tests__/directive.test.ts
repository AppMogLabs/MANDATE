import { test, expect, describe } from "bun:test";
import { clauseToDirective } from "../directive.ts";
import type { ParsedClause } from "../types.ts";

function makeClause(overrides: Partial<ParsedClause> = {}): ParsedClause {
  return {
    conditions: [],
    action: {
      actionType: "ORDER_CANCEL",
      params: {},
    },
    gasEstimate: 80000,
    opcodeCount: 1,
    verified: true,
    ...overrides,
  };
}

describe("clauseToDirective", () => {
  test("PredictionMarket condition renders as probability exceeds X%", () => {
    const clause = makeClause({
      conditions: [
        {
          source: "PredictionMarket",
          comparator: "gt",
          value: 6000n, // 60%
          resourceOrMarketId: "gpu-shortage",
        },
      ],
      action: { actionType: "ORDER_CANCEL", params: {} },
    });

    const directive = clauseToDirective(clause);
    expect(directive).toContain("gpu-shortage probability exceeds 60%");
    expect(directive).toContain("auto-cancel hedged orders");
  });

  test("ResourceBalance condition renders as balance drops below X", () => {
    const clause = makeClause({
      conditions: [
        {
          source: "ResourceBalance",
          comparator: "lt",
          value: 1000000000000000000000n, // 1000 in wei
          resourceOrMarketId: "COMPUTE",
        },
      ],
      action: {
        actionType: "POSITION_ADJUST",
        params: { direction: "acquire", resource: "COMPUTE" },
      },
    });

    const directive = clauseToDirective(clause);
    expect(directive).toContain("COMPUTE balance drops below 1000");
    expect(directive).toContain("adjust position by acquiring more COMPUTE");
  });

  test("TWAP condition renders correctly", () => {
    const clause = makeClause({
      conditions: [
        {
          source: "TWAP",
          comparator: "gt",
          value: 8000000000000000000n, // 8 RATE
          resourceOrMarketId: "CHIPS",
        },
      ],
      action: {
        actionType: "HEDGE_ACTIVATE",
        params: { target: "CHIPS" },
      },
    });

    const directive = clauseToDirective(clause);
    expect(directive).toContain("CHIPS TWAP rises above 8 RATE");
    expect(directive).toContain("activate hedge on CHIPS");
  });

  test("multi-condition clause combines with 'and'", () => {
    const clause = makeClause({
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
      action: { actionType: "ORDER_CANCEL", params: {} },
    });

    const directive = clauseToDirective(clause);
    expect(directive).toContain(" and ");
    expect(directive).toContain("gpu-shortage probability exceeds 60%");
    expect(directive).toContain("COMPUTE balance drops below 1000");
  });

  test("action renders correctly for ORDER_CANCEL", () => {
    const clause = makeClause({
      conditions: [
        { source: "EpochProgress", comparator: "lt", value: 60n },
      ],
      action: { actionType: "ORDER_CANCEL", params: {} },
    });
    const directive = clauseToDirective(clause);
    expect(directive).toContain("auto-cancel hedged orders");
  });

  test("action renders correctly for HEDGE_ACTIVATE", () => {
    const clause = makeClause({
      conditions: [
        { source: "EpochProgress", comparator: "lt", value: 60n },
      ],
      action: { actionType: "HEDGE_ACTIVATE", params: { target: "ENERGY" } },
    });
    const directive = clauseToDirective(clause);
    expect(directive).toContain("activate hedge on ENERGY");
  });

  test("action renders correctly for POSITION_ADJUST", () => {
    const clause = makeClause({
      conditions: [
        { source: "EpochProgress", comparator: "lt", value: 60n },
      ],
      action: {
        actionType: "POSITION_ADJUST",
        params: { direction: "sell", resource: "CHIPS" },
      },
    });
    const directive = clauseToDirective(clause);
    expect(directive).toContain("adjust position by reducing CHIPS");
  });
});
