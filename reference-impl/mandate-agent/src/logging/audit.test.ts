import { test, expect } from "bun:test";
import { hashInput, createAuditEntry } from "./audit.ts";

test("hashInput returns deterministic keccak256", () => {
  const hash1 = hashInput({ a: 1, b: 2 });
  const hash2 = hashInput({ a: 1, b: 2 });
  expect(hash1).toBe(hash2);
  expect(hash1).toMatch(/^0x[0-9a-f]{64}$/);
});

test("hashInput produces different hashes for different inputs", () => {
  const hash1 = hashInput({ a: 1 });
  const hash2 = hashInput({ a: 2 });
  expect(hash1).not.toBe(hash2);
});

test("createAuditEntry produces valid entry", () => {
  const entry = createAuditEntry(7, "ORDER_PLACE", { resource: "COMPUTE" }, "success", { txHash: "0x123" });
  expect(entry.agentId).toBe(7);
  expect(entry.actionType).toBe("ORDER_PLACE");
  expect(entry.outcome).toBe("success");
  expect(entry.details.txHash).toBe("0x123");
  expect(entry.timestamp).toBeGreaterThan(0);
  expect(entry.inputHash).toMatch(/^0x/);
});
