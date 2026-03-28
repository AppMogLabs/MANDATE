import { test, expect, describe } from "bun:test";
import { parseClause, encodeClauseTemplate } from "../parse.ts";
import type { ClauseTemplate } from "../types.ts";
import { MAX_OPCODES, MAX_GAS_ESTIMATE } from "../types.ts";

function makeTemplate(overrides: Partial<ClauseTemplate> = {}): ClauseTemplate {
  return {
    version: 1,
    conditions: [
      {
        source: "PredictionMarket",
        comparator: "gt",
        value: "6000",
        resourceOrMarketId: "gpu-shortage",
      },
      {
        source: "ResourceBalance",
        comparator: "lt",
        value: "1000000000000000000000",
        resourceOrMarketId: "COMPUTE",
      },
    ],
    action: {
      actionType: "ORDER_CANCEL",
      params: { reason: "guard-triggered" },
    },
    gasEstimate: 80000,
    ...overrides,
  };
}

function encode(template: ClauseTemplate): string {
  return encodeClauseTemplate(template);
}

describe("parseClause", () => {
  test("parses valid clause with 2 conditions + 1 action (3 opcodes)", () => {
    const template = makeTemplate();
    const hex = encode(template);
    const result = parseClause(hex);

    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.clause).toBeDefined();
    expect(result.clause!.conditions).toHaveLength(2);
    expect(result.clause!.opcodeCount).toBe(3);
    expect(result.clause!.gasEstimate).toBe(80000);
    expect(result.clause!.verified).toBe(true);

    const cond0 = result.clause!.conditions[0];
    expect(cond0.source).toBe("PredictionMarket");
    expect(cond0.comparator).toBe("gt");
    expect(cond0.value).toBe(6000n);
    expect(cond0.resourceOrMarketId).toBe("gpu-shortage");

    const cond1 = result.clause!.conditions[1];
    expect(cond1.source).toBe("ResourceBalance");
    expect(cond1.comparator).toBe("lt");
    expect(cond1.value).toBe(1000000000000000000000n);
    expect(cond1.resourceOrMarketId).toBe("COMPUTE");

    expect(result.clause!.action.actionType).toBe("ORDER_CANCEL");
  });

  test("parses clause at max opcodes (7 conditions + 1 action = 8)", () => {
    const conditions = Array.from({ length: 7 }, (_, i) => ({
      source: "ResourceBalance" as const,
      comparator: "gt" as const,
      value: String(i * 100),
      resourceOrMarketId: `resource-${i}`,
    }));

    const template = makeTemplate({ conditions });
    const hex = encode(template);
    const result = parseClause(hex);

    expect(result.success).toBe(true);
    expect(result.clause!.opcodeCount).toBe(8);
    expect(result.clause!.conditions).toHaveLength(7);
  });

  test("rejects clause with >8 opcodes (8 conditions + 1 action = 9)", () => {
    const conditions = Array.from({ length: 8 }, (_, i) => ({
      source: "ResourceBalance" as const,
      comparator: "gt" as const,
      value: String(i * 100),
      resourceOrMarketId: `resource-${i}`,
    }));

    const template = makeTemplate({ conditions });
    const hex = encode(template);
    const result = parseClause(hex);

    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.includes("Opcode count 9 exceeds maximum"))).toBe(true);
  });

  test("rejects clause with gas estimate over 150,000", () => {
    const template = makeTemplate({ gasEstimate: MAX_GAS_ESTIMATE + 1 });
    const hex = encode(template);
    const result = parseClause(hex);

    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.includes("Gas estimate"))).toBe(true);
  });

  test("rejects clause with invalid condition source", () => {
    const template = makeTemplate({
      conditions: [
        {
          source: "InvalidSource",
          comparator: "gt",
          value: "100",
        },
      ],
    });
    const hex = encode(template);
    const result = parseClause(hex);

    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.includes("invalid source"))).toBe(true);
  });

  test("rejects clause with invalid comparator", () => {
    const template = makeTemplate({
      conditions: [
        {
          source: "ResourceBalance",
          comparator: "notEqual",
          value: "100",
          resourceOrMarketId: "COMPUTE",
        },
      ],
    });
    const hex = encode(template);
    const result = parseClause(hex);

    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.includes("invalid comparator"))).toBe(true);
  });

  test("rejects clause with invalid action type", () => {
    const template = makeTemplate();
    const modified = {
      ...template,
      action: { actionType: "SELF_DESTRUCT", params: {} },
    };
    const hex = encode(modified as unknown as ClauseTemplate);
    const result = parseClause(hex);

    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.includes("Invalid action type"))).toBe(true);
  });

  test("rejects invalid hex bytes (not valid JSON)", () => {
    // Hex for "not json at all"
    const badHex = "0x" + Array.from(new TextEncoder().encode("not json at all"))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const result = parseClause(badHex);

    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.includes("Failed to parse JSON"))).toBe(true);
  });

  test("rejects clause with missing version field", () => {
    const template = makeTemplate();
    const noVersion = { ...template } as Record<string, unknown>;
    delete noVersion["version"];
    const hex = encodeClauseTemplate(noVersion as unknown as ClauseTemplate);
    const result = parseClause(hex);

    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.includes("version must be 1"))).toBe(true);
  });

  test("encodeClauseTemplate roundtrip produces identical parse result", () => {
    const template = makeTemplate();
    const hex = encode(template);
    const result = parseClause(hex);

    expect(result.success).toBe(true);

    // Re-encode and re-parse
    const reEncoded = encode(template);
    const reResult = parseClause(reEncoded);

    expect(reResult.success).toBe(true);
    expect(reResult.clause!.conditions).toHaveLength(result.clause!.conditions.length);
    expect(reResult.clause!.opcodeCount).toBe(result.clause!.opcodeCount);
    expect(reResult.clause!.gasEstimate).toBe(result.clause!.gasEstimate);
    expect(reResult.clause!.action.actionType).toBe(result.clause!.action.actionType);

    // Hex should be identical
    expect(reEncoded).toBe(hex);
  });
});
