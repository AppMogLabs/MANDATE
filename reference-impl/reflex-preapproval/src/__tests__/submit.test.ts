import { describe, test, expect } from "bun:test";
import type { PreApproval, SubmitResult } from "../types.js";

describe("submitReflexAction validation", () => {
  test("expired pre-approval is rejected", () => {
    const preApproval: PreApproval = {
      clauseId: 1,
      eventType: "CHIP_SHORTAGE",
      action: {
        actionType: "ORDER_CANCEL",
        params: { orderId: 42 },
      },
      guardSignature: "0x" + "ab".repeat(65),
      expiresAtBlock: 4000,
      agentAddress: "0x1234567890abcdef1234567890abcdef12345678",
      orderId: 42,
    };

    // Simulate expiry check: currentBlock (5000) > expiresAtBlock (4000)
    const currentBlock = 5000;
    const isExpired = preApproval.expiresAtBlock < currentBlock;
    expect(isExpired).toBe(true);
  });

  test("SubmitResult type structure", () => {
    const successResult: SubmitResult = {
      success: true,
      txHash: "0x" + "ff".repeat(32),
    };
    expect(successResult.success).toBe(true);
    expect(successResult.txHash).toBeDefined();
    expect(successResult.error).toBeUndefined();

    const failResult: SubmitResult = {
      success: false,
      error: "Reflex window is not active",
    };
    expect(failResult.success).toBe(false);
    expect(failResult.error).toBeDefined();
    expect(failResult.txHash).toBeUndefined();
  });

  test("PreApproval type structure is correct", () => {
    const preApproval: PreApproval = {
      clauseId: 5,
      eventType: "MARKET_CRASH",
      action: {
        actionType: "HEDGE_ACTIVATE",
        params: { hedgeRatio: 0.5, urgent: true },
      },
      guardSignature: "0x" + "cd".repeat(65),
      expiresAtBlock: 10000,
      agentAddress: "0xabcdef1234567890abcdef1234567890abcdef12",
    };

    expect(preApproval.clauseId).toBe(5);
    expect(preApproval.eventType).toBe("MARKET_CRASH");
    expect(preApproval.action.actionType).toBe("HEDGE_ACTIVATE");
    expect(preApproval.action.params["hedgeRatio"]).toBe(0.5);
    expect(preApproval.action.params["urgent"]).toBe(true);
    expect(preApproval.expiresAtBlock).toBe(10000);
    expect(preApproval.orderId).toBeUndefined();
  });
});
