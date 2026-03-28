import { test, expect } from "bun:test";
import { computeMandateHash } from "./hash.ts";
import { DEFAULT_LAYER2 } from "./schema.ts";

test("computeMandateHash returns 32-byte hex string", () => {
  const hash = computeMandateHash("Buy COMPUTE at any price", DEFAULT_LAYER2);
  expect(hash).toMatch(/^0x[0-9a-f]{64}$/);
});

test("computeMandateHash is deterministic", () => {
  const hash1 = computeMandateHash("Test mandate text", DEFAULT_LAYER2);
  const hash2 = computeMandateHash("Test mandate text", DEFAULT_LAYER2);
  expect(hash1).toBe(hash2);
});

test("computeMandateHash changes with different text", () => {
  const hash1 = computeMandateHash("Buy COMPUTE", DEFAULT_LAYER2);
  const hash2 = computeMandateHash("Sell COMPUTE", DEFAULT_LAYER2);
  expect(hash1).not.toBe(hash2);
});

test("computeMandateHash changes with different constraints", () => {
  const hash1 = computeMandateHash("Same text", DEFAULT_LAYER2);
  const modified = {
    ...DEFAULT_LAYER2,
    trading: { ...DEFAULT_LAYER2.trading, aggressiveness: 10 },
  };
  const hash2 = computeMandateHash("Same text", modified);
  expect(hash1).not.toBe(hash2);
});
