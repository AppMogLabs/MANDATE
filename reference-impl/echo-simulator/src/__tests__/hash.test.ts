import { test, expect, describe } from "bun:test";
import { generateEchoHash, generateEchoCommitment, verifyEchoReveal } from "../hash.js";
import type { RepositioningPlan } from "../types.js";

const samplePlan: RepositioningPlan = {
  triggerEventId: 1,
  triggerEventType: "CHIP_SHORTAGE",
  triggerProbability: 0.75,
  legs: [
    { resource: "COMPUTE", direction: "SELL", amount: 1500, estimatedPricePerUnit: 5 },
    { resource: "CHIPS", direction: "BUY", amount: 500, estimatedPricePerUnit: 8 },
  ],
  timestamp: 1711400000,
};

const emptyPlan: RepositioningPlan = {
  triggerEventId: 0,
  triggerEventType: "NONE",
  triggerProbability: 0,
  legs: [],
  timestamp: 1711400000,
};

describe("generateEchoHash", () => {
  test("returns a bytes32 hex string", () => {
    const hash = generateEchoHash(samplePlan);
    expect(hash).toMatch(/^0x[0-9a-f]{64}$/);
  });

  test("deterministic — same plan always produces same hash", () => {
    const hash1 = generateEchoHash(samplePlan);
    const hash2 = generateEchoHash(samplePlan);
    expect(hash1).toBe(hash2);
  });

  test("different plans produce different hashes", () => {
    const differentPlan: RepositioningPlan = {
      ...samplePlan,
      legs: [
        { resource: "DATA", direction: "BUY", amount: 1000, estimatedPricePerUnit: 3 },
      ],
    };
    const hash1 = generateEchoHash(samplePlan);
    const hash2 = generateEchoHash(differentPlan);
    expect(hash1).not.toBe(hash2);
  });

  test("different amounts produce different hashes", () => {
    const planA: RepositioningPlan = {
      ...samplePlan,
      legs: [{ resource: "COMPUTE", direction: "SELL", amount: 100, estimatedPricePerUnit: 5 }],
    };
    const planB: RepositioningPlan = {
      ...samplePlan,
      legs: [{ resource: "COMPUTE", direction: "SELL", amount: 200, estimatedPricePerUnit: 5 }],
    };
    expect(generateEchoHash(planA)).not.toBe(generateEchoHash(planB));
  });

  test("empty plan returns deterministic hash", () => {
    const hash1 = generateEchoHash(emptyPlan);
    const hash2 = generateEchoHash(emptyPlan);
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^0x[0-9a-f]{64}$/);
  });

  test("leg order does not affect hash (sorted internally)", () => {
    const planAB: RepositioningPlan = {
      ...samplePlan,
      legs: [
        { resource: "COMPUTE", direction: "SELL", amount: 1500, estimatedPricePerUnit: 5 },
        { resource: "CHIPS", direction: "BUY", amount: 500, estimatedPricePerUnit: 8 },
      ],
    };
    const planBA: RepositioningPlan = {
      ...samplePlan,
      legs: [
        { resource: "CHIPS", direction: "BUY", amount: 500, estimatedPricePerUnit: 8 },
        { resource: "COMPUTE", direction: "SELL", amount: 1500, estimatedPricePerUnit: 5 },
      ],
    };
    expect(generateEchoHash(planAB)).toBe(generateEchoHash(planBA));
  });

  test("single leg plan produces valid hash", () => {
    const singleLeg: RepositioningPlan = {
      ...samplePlan,
      legs: [{ resource: "DATA", direction: "BUY", amount: 100, estimatedPricePerUnit: 3 }],
    };
    const hash = generateEchoHash(singleLeg);
    expect(hash).toMatch(/^0x[0-9a-f]{64}$/);
  });
});

describe("generateEchoCommitment", () => {
  test("returns commitment with all fields", () => {
    const commitment = generateEchoCommitment(samplePlan, 42);

    expect(commitment.commitment).toMatch(/^0x[0-9a-f]{64}$/);
    expect(commitment.nonce).toBe(42);
    expect(commitment.plan).toEqual(samplePlan);
  });

  test("different nonces produce different commitments", () => {
    const c1 = generateEchoCommitment(samplePlan, 1);
    const c2 = generateEchoCommitment(samplePlan, 2);
    expect(c1.commitment).not.toBe(c2.commitment);
  });

  test("same plan + same nonce = same commitment", () => {
    const c1 = generateEchoCommitment(samplePlan, 42);
    const c2 = generateEchoCommitment(samplePlan, 42);
    expect(c1.commitment).toBe(c2.commitment);
  });

  test("commitment is different from raw echo hash", () => {
    const echoHash = generateEchoHash(samplePlan);
    const commitment = generateEchoCommitment(samplePlan, 0);
    expect(commitment.commitment).not.toBe(echoHash);
  });
});

describe("verifyEchoReveal", () => {
  test("valid reveal returns true", () => {
    const commitment = generateEchoCommitment(samplePlan, 42);
    const echoHash = generateEchoHash(samplePlan);

    expect(verifyEchoReveal(commitment.commitment, echoHash, 42)).toBe(true);
  });

  test("wrong nonce returns false", () => {
    const commitment = generateEchoCommitment(samplePlan, 42);
    const echoHash = generateEchoHash(samplePlan);

    expect(verifyEchoReveal(commitment.commitment, echoHash, 99)).toBe(false);
  });

  test("wrong echo hash returns false", () => {
    const commitment = generateEchoCommitment(samplePlan, 42);
    const wrongHash = generateEchoHash(emptyPlan);

    expect(verifyEchoReveal(commitment.commitment, wrongHash, 42)).toBe(false);
  });

  test("roundtrip: generate commitment, reveal, verify", () => {
    const nonce = 12345;
    const commitment = generateEchoCommitment(samplePlan, nonce);
    const echoHash = generateEchoHash(commitment.plan);

    const verified = verifyEchoReveal(commitment.commitment, echoHash, nonce);
    expect(verified).toBe(true);
  });
});
