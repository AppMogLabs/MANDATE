import { describe, test, expect } from "bun:test";
import { Wallet } from "ethers";
import { generatePreApprovals, isCloseToTriggering } from "../generate.js";
import type {
  ParsedClauseForReflex,
  ReflexConstraints,
  ReflexGameState,
} from "../types.js";

const TEST_PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const guardSigner = new Wallet(TEST_PRIVATE_KEY);

function makeClause(overrides?: Partial<ParsedClauseForReflex>): ParsedClauseForReflex {
  return {
    clauseId: 1,
    conditions: [
      {
        source: "PredictionMarket",
        comparator: ">=",
        value: 50n,
        resourceOrMarketId: "CHIP_SHORTAGE",
      },
    ],
    action: {
      actionType: "ORDER_CANCEL",
      params: { orderId: 42 },
    },
    gasEstimate: 100_000,
    ...overrides,
  };
}

function makeGameState(overrides?: Partial<ReflexGameState>): ReflexGameState {
  return {
    currentBalances: { COMPUTE: 1000, ENERGY: 500 },
    marketSnapshot: { COMPUTE: { twapPrice: 100 } },
    predictionProbabilities: { CHIP_SHORTAGE: 0.6 },
    currentBlock: 5000,
    rateBalance: 10_000,
    ...overrides,
  };
}

function makeConstraints(overrides?: Partial<ReflexConstraints>): ReflexConstraints {
  return {
    allowedActions: ["ORDER_CANCEL", "HEDGE_ACTIVATE", "POSITION_ADJUST"],
    ...overrides,
  };
}

describe("generatePreApprovals", () => {
  test("generates pre-approval for clause close to triggering", async () => {
    const clauses = [makeClause()];
    const results = await generatePreApprovals(
      clauses,
      makeConstraints(),
      makeGameState(),
      guardSigner,
    );

    expect(results).toHaveLength(1);
    expect(results[0].generated).toBe(true);
    expect(results[0].preApproval).toBeDefined();
    expect(results[0].preApproval!.clauseId).toBe(1);
    expect(results[0].preApproval!.eventType).toBe("CHIP_SHORTAGE");
    expect(results[0].preApproval!.action.actionType).toBe("ORDER_CANCEL");
    expect(results[0].preApproval!.agentAddress).toBe(guardSigner.address);
  });

  test("does NOT generate when no conditions approach threshold", async () => {
    const gameState = makeGameState({ predictionProbabilities: { CHIP_SHORTAGE: 0.1 } });
    const results = await generatePreApprovals(
      [makeClause()],
      makeConstraints(),
      gameState,
      guardSigner,
    );

    expect(results).toHaveLength(1);
    expect(results[0].generated).toBe(false);
    expect(results[0].reason).toBe("No conditions approaching trigger threshold");
  });

  test("does NOT generate when guard validation fails (action not in allowed list)", async () => {
    const constraints = makeConstraints({ allowedActions: ["HEDGE_ACTIVATE"] });
    const results = await generatePreApprovals(
      [makeClause()],
      constraints,
      makeGameState(),
      guardSigner,
    );

    expect(results).toHaveLength(1);
    expect(results[0].generated).toBe(false);
    expect(results[0].reason).toContain("not in the allowed actions list");
  });

  test("does NOT generate when guard validation fails (budget exceeded)", async () => {
    const clause = makeClause({
      action: {
        actionType: "POSITION_ADJUST",
        params: { resourceId: "COMPUTE", amount: 999 },
      },
    });
    const constraints = makeConstraints({
      resourceBudgets: { COMPUTE: 100 },
    });
    const results = await generatePreApprovals(
      [clause],
      constraints,
      makeGameState(),
      guardSigner,
    );

    expect(results).toHaveLength(1);
    expect(results[0].generated).toBe(false);
    expect(results[0].reason).toContain("exceeds budget");
  });

  test("signature is a valid hex string", async () => {
    const results = await generatePreApprovals(
      [makeClause()],
      makeConstraints(),
      makeGameState(),
      guardSigner,
    );

    expect(results[0].generated).toBe(true);
    const sig = results[0].preApproval!.guardSignature;
    expect(sig).toMatch(/^0x[0-9a-fA-F]+$/);
    // EIP-712 signatures are 65 bytes = 130 hex chars + "0x" prefix
    expect(sig.length).toBe(132);
  });

  test("expiresAtBlock is set correctly (currentBlock + expiryBlocks)", async () => {
    const gameState = makeGameState({ currentBlock: 5000 });
    const results = await generatePreApprovals(
      [makeClause()],
      makeConstraints(),
      gameState,
      guardSigner,
      { expiryBlocks: 500 },
    );

    expect(results[0].generated).toBe(true);
    expect(results[0].preApproval!.expiresAtBlock).toBe(5500);
  });

  test("multiple clauses generate multiple pre-approvals independently", async () => {
    const clause1 = makeClause({ clauseId: 1 });
    const clause2 = makeClause({
      clauseId: 2,
      conditions: [
        {
          source: "PredictionMarket",
          comparator: ">=",
          value: 70n,
          resourceOrMarketId: "ENERGY_CRISIS",
        },
      ],
      action: { actionType: "HEDGE_ACTIVATE", params: {} },
    });
    const clause3 = makeClause({
      clauseId: 3,
      conditions: [
        {
          source: "PredictionMarket",
          comparator: ">=",
          value: 80n,
          resourceOrMarketId: "DATA_BREACH",
        },
      ],
    });

    const gameState = makeGameState({
      predictionProbabilities: {
        CHIP_SHORTAGE: 0.6,
        ENERGY_CRISIS: 0.8,
        DATA_BREACH: 0.1, // below threshold
      },
    });

    const results = await generatePreApprovals(
      [clause1, clause2, clause3],
      makeConstraints(),
      gameState,
      guardSigner,
    );

    expect(results).toHaveLength(3);
    expect(results[0].generated).toBe(true);
    expect(results[0].preApproval!.clauseId).toBe(1);
    expect(results[1].generated).toBe(true);
    expect(results[1].preApproval!.clauseId).toBe(2);
    expect(results[2].generated).toBe(false);
  });

  test("configurable trigger threshold", async () => {
    const gameState = makeGameState({ predictionProbabilities: { CHIP_SHORTAGE: 0.35 } });

    // Default threshold (0.4) — should NOT generate
    const results1 = await generatePreApprovals(
      [makeClause()],
      makeConstraints(),
      gameState,
      guardSigner,
    );
    expect(results1[0].generated).toBe(false);

    // Lower threshold (0.3) — should generate
    const results2 = await generatePreApprovals(
      [makeClause()],
      makeConstraints(),
      gameState,
      guardSigner,
      { triggerThreshold: 0.3 },
    );
    expect(results2[0].generated).toBe(true);
  });
});

describe("isCloseToTriggering", () => {
  test("returns true when prediction probability exceeds threshold", () => {
    const clause = makeClause();
    const gameState = makeGameState({ predictionProbabilities: { CHIP_SHORTAGE: 0.5 } });
    expect(isCloseToTriggering(clause, gameState, 0.4)).toBe(true);
  });

  test("returns false when prediction probability is below threshold", () => {
    const clause = makeClause();
    const gameState = makeGameState({ predictionProbabilities: { CHIP_SHORTAGE: 0.3 } });
    expect(isCloseToTriggering(clause, gameState, 0.4)).toBe(false);
  });

  test("returns false for non-PredictionMarket conditions", () => {
    const clause = makeClause({
      conditions: [
        { source: "BalanceCheck", comparator: ">=", value: 100n, resourceOrMarketId: "COMPUTE" },
      ],
    });
    const gameState = makeGameState();
    expect(isCloseToTriggering(clause, gameState, 0.4)).toBe(false);
  });
});
