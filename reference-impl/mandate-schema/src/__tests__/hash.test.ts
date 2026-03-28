import { test, expect, describe } from "bun:test";
import { computeMandateHash, canonicalJson } from "../hash.js";
import type { Mandate } from "../types.js";

describe("canonicalJson", () => {
  test("sorts object keys alphabetically", () => {
    const result = canonicalJson({ z: 1, a: 2, m: 3 });
    expect(result).toBe('{"a":2,"m":3,"z":1}');
  });

  test("sorts nested object keys recursively", () => {
    const result = canonicalJson({
      b: { y: 1, x: 2 },
      a: { d: 3, c: 4 },
    });
    expect(result).toBe('{"a":{"c":4,"d":3},"b":{"x":2,"y":1}}');
  });

  test("preserves array order", () => {
    const result = canonicalJson({ arr: [3, 1, 2] });
    expect(result).toBe('{"arr":[3,1,2]}');
  });

  test("handles arrays of objects with sorted keys", () => {
    const result = canonicalJson([{ b: 1, a: 2 }]);
    expect(result).toBe('[{"a":2,"b":1}]');
  });

  test("handles primitives", () => {
    expect(canonicalJson("hello")).toBe('"hello"');
    expect(canonicalJson(42)).toBe("42");
    expect(canonicalJson(true)).toBe("true");
    expect(canonicalJson(null)).toBe("null");
  });

  test("produces no whitespace", () => {
    const result = canonicalJson({
      a: { b: [1, 2, 3], c: "test" },
    });
    expect(result).not.toContain(" ");
    expect(result).not.toContain("\n");
    expect(result).not.toContain("\t");
  });
});

describe("computeMandateHash", () => {
  const mandate: Mandate = {
    strategicIntent: "Dominate COMPUTE market",
    resourceBudgets: { COMPUTE: 5000 },
  };

  test("produces deterministic hash (same input, same output)", () => {
    const hash1 = computeMandateHash(mandate);
    const hash2 = computeMandateHash(mandate);
    expect(hash1).toBe(hash2);
  });

  test("returns 0x-prefixed hex string", () => {
    const hash = computeMandateHash(mandate);
    expect(hash).toMatch(/^0x[0-9a-f]{64}$/);
  });

  test("different inputs produce different hashes", () => {
    const other: Mandate = {
      strategicIntent: "Focus on DATA accumulation",
      resourceBudgets: { DATA: 3000 },
    };
    const hash1 = computeMandateHash(mandate);
    const hash2 = computeMandateHash(other);
    expect(hash1).not.toBe(hash2);
  });

  test("key order does not affect hash", () => {
    const a: Mandate = {
      strategicIntent: "test",
      resourceBudgets: { COMPUTE: 1, DATA: 2 },
    };
    // Create an object with keys in reverse insertion order
    const reversed = { resourceBudgets: { DATA: 2, COMPUTE: 1 }, strategicIntent: "test" } as Mandate;
    const hash1 = computeMandateHash(a);
    const hash2 = computeMandateHash(reversed);
    expect(hash1).toBe(hash2);
  });

  test("minimal mandate hashes correctly", () => {
    const minimal: Mandate = { strategicIntent: "hold" };
    const hash = computeMandateHash(minimal);
    expect(hash).toMatch(/^0x[0-9a-f]{64}$/);
  });
});
