import { test, expect, describe } from "bun:test";
import { validateMessage } from "../validate.js";

const VALID_ADDRESS = "0x1234567890abcdef1234567890abcdef12345678";
const VALID_ADDRESS_2 = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";
const VALID_SIGNATURE = "0xdeadbeef";

describe("validateMessage", () => {
  describe("valid messages", () => {
    test("valid REQUEST message", () => {
      const result = validateMessage({
        type: "REQUEST",
        from: VALID_ADDRESS,
        signature: VALID_SIGNATURE,
        requestId: "req-001",
        resource: "wood",
        quantity: 100,
        urgency: "high",
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test("valid PROPOSE message", () => {
      const result = validateMessage({
        type: "PROPOSE",
        from: VALID_ADDRESS,
        signature: VALID_SIGNATURE,
        proposalId: "prop-001",
        to: VALID_ADDRESS_2,
        legs: [
          {
            party: "A",
            gives: "wood",
            amount: 50,
            receivesResource: "stone",
            receivesAmount: 30,
          },
        ],
        expiresAt: 1700000000,
        nonce: 1,
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test("valid ACCEPT message", () => {
      const result = validateMessage({
        type: "ACCEPT",
        from: VALID_ADDRESS,
        signature: VALID_SIGNATURE,
        proposalId: "prop-001",
        to: VALID_ADDRESS_2,
        dealHash: "0xabc123",
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test("valid REJECT message", () => {
      const result = validateMessage({
        type: "REJECT",
        from: VALID_ADDRESS,
        signature: VALID_SIGNATURE,
        proposalId: "prop-001",
        to: VALID_ADDRESS_2,
        reason: "Price too high",
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test("valid COUNTER message", () => {
      const result = validateMessage({
        type: "COUNTER",
        from: VALID_ADDRESS,
        signature: VALID_SIGNATURE,
        proposalId: "counter-001",
        inResponseTo: "prop-001",
        to: VALID_ADDRESS_2,
        legs: [
          {
            party: "B",
            gives: "stone",
            amount: 20,
            receivesResource: "wood",
            receivesAmount: 40,
          },
        ],
        expiresAt: 1700000000,
        nonce: 2,
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test("valid WITHDRAW message", () => {
      const result = validateMessage({
        type: "WITHDRAW",
        from: VALID_ADDRESS,
        signature: VALID_SIGNATURE,
        to: VALID_ADDRESS_2,
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("invalid messages", () => {
    test("missing type field", () => {
      const result = validateMessage({
        from: VALID_ADDRESS,
        signature: VALID_SIGNATURE,
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Missing or invalid 'type' field");
    });

    test("unknown type", () => {
      const result = validateMessage({
        type: "BARTER",
        from: VALID_ADDRESS,
        signature: VALID_SIGNATURE,
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("Unknown message type");
    });

    test("missing required field (from)", () => {
      const result = validateMessage({
        type: "WITHDRAW",
        signature: VALID_SIGNATURE,
        to: VALID_ADDRESS_2,
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Missing required field: from");
    });

    test("bad address format", () => {
      const result = validateMessage({
        type: "WITHDRAW",
        from: "not-an-address",
        signature: VALID_SIGNATURE,
        to: VALID_ADDRESS_2,
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("not a valid address"))).toBe(true);
    });

    test("PROPOSE missing legs", () => {
      const result = validateMessage({
        type: "PROPOSE",
        from: VALID_ADDRESS,
        signature: VALID_SIGNATURE,
        proposalId: "prop-001",
        to: VALID_ADDRESS_2,
        expiresAt: 1700000000,
        nonce: 1,
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Missing required field: legs");
    });

    test("COUNTER missing inResponseTo", () => {
      const result = validateMessage({
        type: "COUNTER",
        from: VALID_ADDRESS,
        signature: VALID_SIGNATURE,
        proposalId: "counter-001",
        to: VALID_ADDRESS_2,
        legs: [
          {
            party: "A",
            gives: "wood",
            amount: 10,
            receivesResource: null,
            receivesAmount: 0,
          },
        ],
        expiresAt: 1700000000,
        nonce: 1,
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Missing required field: inResponseTo");
    });
  });
});
