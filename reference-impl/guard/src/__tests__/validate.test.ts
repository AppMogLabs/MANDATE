import { test, expect, describe } from "bun:test";
import { validateAction } from "../validate.ts";
import type {
  ProposedAction,
  OperationalConstraints,
  EpochState,
} from "../types.ts";

// ---------------------------------------------------------------------------
// Helpers — build minimal valid inputs, override per-test
// ---------------------------------------------------------------------------

function baseConstraints(overrides?: Partial<OperationalConstraints>): OperationalConstraints {
  return {
    allowedActions: ["ORDER_PLACE", "ORDER_MATCH", "DEAL_SETTLE", "TRANSFER"],
    ...overrides,
  };
}

function baseState(overrides?: Partial<EpochState>): EpochState {
  return {
    cumulativeSpend: {},
    currentRateBalance: 10_000,
    currentResourceBalances: {},
    ...overrides,
  };
}

function baseAction(overrides?: Partial<ProposedAction>): ProposedAction {
  return {
    actionType: "ORDER_PLACE",
    resource: "COMPUTE",
    amount: 10,
    pricePerUnit: 5,
    totalRateCost: 50,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. Allowlist
// ---------------------------------------------------------------------------

describe("allowlist check", () => {
  test("action type on allowlist → approved", () => {
    const result = validateAction(
      baseAction({ actionType: "ORDER_PLACE" }),
      baseConstraints({ allowedActions: ["ORDER_PLACE"] }),
      baseState(),
    );
    expect(result.approved).toBe(true);
  });

  test("action type NOT on allowlist → rejected with 'allowlist'", () => {
    const result = validateAction(
      baseAction({ actionType: "POISON_PIPELINE" }),
      baseConstraints({ allowedActions: ["ORDER_PLACE"] }),
      baseState(),
    );
    expect(result.approved).toBe(false);
    expect(result.failedCheck).toBe("allowlist");
    expect(result.reason).toContain("POISON_PIPELINE");
  });
});

// ---------------------------------------------------------------------------
// 2. Counterparty
// ---------------------------------------------------------------------------

describe("counterparty check", () => {
  test("counterparty blocked → rejected with 'counterparty'", () => {
    const result = validateAction(
      baseAction({ counterpartyId: 42 }),
      baseConstraints({ counterpartyPreferences: { block: [42, 99] } }),
      baseState(),
    );
    expect(result.approved).toBe(false);
    expect(result.failedCheck).toBe("counterparty");
    expect(result.reason).toContain("42");
    expect(result.reason).toContain("blocked");
  });

  test("counterparty on avoid list but not block → approved (avoid is soft guidance)", () => {
    const result = validateAction(
      baseAction({ counterpartyId: 42 }),
      baseConstraints({ counterpartyPreferences: { avoid: [42], block: [] } }),
      baseState(),
    );
    expect(result.approved).toBe(true);
  });

  test("no counterpartyId set → skip check", () => {
    const result = validateAction(
      baseAction({ counterpartyId: undefined }),
      baseConstraints({ counterpartyPreferences: { block: [1, 2, 3] } }),
      baseState(),
    );
    expect(result.approved).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. Price
// ---------------------------------------------------------------------------

describe("price check", () => {
  test("buy price above maxBuy → rejected with 'price'", () => {
    const result = validateAction(
      baseAction({ actionType: "ORDER_MATCH", resource: "COMPUTE", pricePerUnit: 150 }),
      baseConstraints({
        allowedActions: ["ORDER_MATCH"],
        priceThresholds: { COMPUTE: { maxBuy: 100, minSell: 10 } },
      }),
      baseState(),
    );
    expect(result.approved).toBe(false);
    expect(result.failedCheck).toBe("price");
    expect(result.reason).toContain("maxBuy");
  });

  test("sell price below minSell → rejected with 'price'", () => {
    const result = validateAction(
      baseAction({ actionType: "ORDER_PLACE", resource: "COMPUTE", pricePerUnit: 5 }),
      baseConstraints({
        priceThresholds: { COMPUTE: { maxBuy: 100, minSell: 10 } },
      }),
      baseState(),
    );
    expect(result.approved).toBe(false);
    expect(result.failedCheck).toBe("price");
    expect(result.reason).toContain("minSell");
  });

  test("price within thresholds → approved", () => {
    const result = validateAction(
      baseAction({ actionType: "ORDER_MATCH", resource: "COMPUTE", pricePerUnit: 50 }),
      baseConstraints({
        allowedActions: ["ORDER_MATCH"],
        priceThresholds: { COMPUTE: { maxBuy: 100, minSell: 10 } },
      }),
      baseState(),
    );
    expect(result.approved).toBe(true);
  });

  test("no priceThresholds configured for resource → skip check", () => {
    const result = validateAction(
      baseAction({ actionType: "ORDER_MATCH", resource: "CHIPS", pricePerUnit: 9999 }),
      baseConstraints({
        allowedActions: ["ORDER_MATCH"],
        priceThresholds: { COMPUTE: { maxBuy: 1, minSell: 1 } },
      }),
      baseState(),
    );
    expect(result.approved).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4. Budget
// ---------------------------------------------------------------------------

describe("budget check", () => {
  test("budget exceeded → rejected with 'budget'", () => {
    const result = validateAction(
      baseAction({ resource: "COMPUTE", amount: 10, pricePerUnit: 5, totalRateCost: 50 }),
      baseConstraints({ resourceBudgets: { COMPUTE: 60 } }),
      baseState({ cumulativeSpend: { COMPUTE: 20 } }),
    );
    expect(result.approved).toBe(false);
    expect(result.failedCheck).toBe("budget");
  });

  test("budget OK → approved", () => {
    const result = validateAction(
      baseAction({ resource: "COMPUTE", amount: 10, pricePerUnit: 5, totalRateCost: 50 }),
      baseConstraints({ resourceBudgets: { COMPUTE: 100 } }),
      baseState({ cumulativeSpend: { COMPUTE: 20 } }),
    );
    expect(result.approved).toBe(true);
  });

  test("no budget configured for resource → skip check", () => {
    const result = validateAction(
      baseAction({ resource: "CHIPS", amount: 100, pricePerUnit: 100, totalRateCost: 10_000 }),
      baseConstraints({ resourceBudgets: { COMPUTE: 10 } }),
      baseState(),
    );
    expect(result.approved).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 5. Exposure
// ---------------------------------------------------------------------------

describe("exposure check", () => {
  test("exposure exceeded → rejected with 'exposure'", () => {
    const result = validateAction(
      baseAction({ totalRateCost: 6000 }),
      baseConstraints({ riskLimits: { maxDealExposure: 50 } }),
      baseState({ currentRateBalance: 10_000 }),
    );
    expect(result.approved).toBe(false);
    expect(result.failedCheck).toBe("exposure");
  });

  test("exposure within limit → approved", () => {
    const result = validateAction(
      baseAction({ totalRateCost: 4000 }),
      baseConstraints({ riskLimits: { maxDealExposure: 50 } }),
      baseState({ currentRateBalance: 10_000 }),
    );
    expect(result.approved).toBe(true);
  });

  test("no maxDealExposure configured → skip check", () => {
    const result = validateAction(
      baseAction({ totalRateCost: 9999 }),
      baseConstraints({ riskLimits: {} }),
      baseState({ currentRateBalance: 10_000 }),
    );
    expect(result.approved).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 6. Concentration
// ---------------------------------------------------------------------------

describe("concentration check", () => {
  test("concentration exceeded → rejected with 'concentration'", () => {
    const result = validateAction(
      baseAction({ resource: "COMPUTE", amount: 500 }),
      baseConstraints({ riskLimits: { maxResourceConcentration: 25 } }),
      baseState({
        currentResourceBalances: { COMPUTE: 200 },
        totalResourceSupply: { COMPUTE: 1000 },
      }),
    );
    // (200 + 500) / 1000 = 70% > 25%
    expect(result.approved).toBe(false);
    expect(result.failedCheck).toBe("concentration");
  });

  test("concentration within limit → approved", () => {
    const result = validateAction(
      baseAction({ resource: "COMPUTE", amount: 10 }),
      baseConstraints({ riskLimits: { maxResourceConcentration: 25 } }),
      baseState({
        currentResourceBalances: { COMPUTE: 50 },
        totalResourceSupply: { COMPUTE: 1000 },
      }),
    );
    // (50 + 10) / 1000 = 6% < 25%
    expect(result.approved).toBe(true);
  });

  test("no totalResourceSupply → skip check", () => {
    const result = validateAction(
      baseAction({ resource: "COMPUTE", amount: 99999 }),
      baseConstraints({ riskLimits: { maxResourceConcentration: 1 } }),
      baseState({ currentResourceBalances: { COMPUTE: 99999 } }),
    );
    expect(result.approved).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 7. Multi-leg deals
// ---------------------------------------------------------------------------

describe("multi-leg deals", () => {
  test("multi-leg deal with budget check on each leg", () => {
    const result = validateAction(
      baseAction({
        actionType: "DEAL_SETTLE",
        resource: undefined,
        amount: undefined,
        pricePerUnit: undefined,
        totalRateCost: undefined,
        dealLegs: [
          { resource: "COMPUTE", amount: 10, pricePerUnit: 5 },
          { resource: "DATA", amount: 20, pricePerUnit: 3 },
        ],
      }),
      baseConstraints({
        allowedActions: ["DEAL_SETTLE"],
        resourceBudgets: { COMPUTE: 100, DATA: 50 },
      }),
      baseState({ cumulativeSpend: { COMPUTE: 0, DATA: 0 } }),
    );
    // COMPUTE: 0 + 50 <= 100 OK, DATA: 0 + 60 > 50 FAIL
    expect(result.approved).toBe(false);
    expect(result.failedCheck).toBe("budget");
    expect(result.reason).toContain("DATA");
  });

  test("multi-leg deal all legs within budget → approved", () => {
    const result = validateAction(
      baseAction({
        actionType: "DEAL_SETTLE",
        resource: undefined,
        amount: undefined,
        pricePerUnit: undefined,
        totalRateCost: undefined,
        dealLegs: [
          { resource: "COMPUTE", amount: 10, pricePerUnit: 5 },
          { resource: "DATA", amount: 5, pricePerUnit: 3 },
        ],
      }),
      baseConstraints({
        allowedActions: ["DEAL_SETTLE"],
        resourceBudgets: { COMPUTE: 100, DATA: 50 },
      }),
      baseState({ cumulativeSpend: {} }),
    );
    expect(result.approved).toBe(true);
  });

  test("multi-leg deal exposure summed across legs", () => {
    const result = validateAction(
      baseAction({
        actionType: "DEAL_SETTLE",
        resource: undefined,
        amount: undefined,
        pricePerUnit: undefined,
        totalRateCost: undefined,
        dealLegs: [
          { resource: "COMPUTE", amount: 100, pricePerUnit: 50 },
          { resource: "DATA", amount: 100, pricePerUnit: 50 },
        ],
      }),
      baseConstraints({
        allowedActions: ["DEAL_SETTLE"],
        riskLimits: { maxDealExposure: 50 },
      }),
      baseState({ currentRateBalance: 10_000 }),
    );
    // total cost = 5000 + 5000 = 10000, exposure = 100% > 50%
    expect(result.approved).toBe(false);
    expect(result.failedCheck).toBe("exposure");
  });
});

// ---------------------------------------------------------------------------
// 8. Missing optional constraints → skip those checks
// ---------------------------------------------------------------------------

describe("missing optional constraints", () => {
  test("no priceThresholds, no budgets, no riskLimits → all optional checks skipped", () => {
    const result = validateAction(
      baseAction({ counterpartyId: 5 }),
      baseConstraints(),
      baseState(),
    );
    expect(result.approved).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 9. All checks pass end-to-end
// ---------------------------------------------------------------------------

describe("full pass", () => {
  test("all checks pass → approved", () => {
    const result = validateAction(
      baseAction({
        actionType: "ORDER_MATCH",
        resource: "COMPUTE",
        amount: 10,
        pricePerUnit: 50,
        counterpartyId: 7,
        totalRateCost: 500,
      }),
      baseConstraints({
        allowedActions: ["ORDER_MATCH"],
        priceThresholds: { COMPUTE: { maxBuy: 100, minSell: 10 } },
        resourceBudgets: { COMPUTE: 1000 },
        counterpartyPreferences: { block: [99], avoid: [7] },
        riskLimits: {
          maxDealExposure: 50,
          maxResourceConcentration: 50,
        },
      }),
      baseState({
        cumulativeSpend: { COMPUTE: 100 },
        currentRateBalance: 10_000,
        currentResourceBalances: { COMPUTE: 100 },
        totalResourceSupply: { COMPUTE: 1000 },
      }),
    );
    expect(result.approved).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 10. Check ordering — allowlist fails before counterparty
// ---------------------------------------------------------------------------

describe("check ordering", () => {
  test("allowlist fails before counterparty even if both would fail", () => {
    const result = validateAction(
      baseAction({
        actionType: "POISON_PIPELINE",
        counterpartyId: 42,
      }),
      baseConstraints({
        allowedActions: ["ORDER_PLACE"],
        counterpartyPreferences: { block: [42] },
      }),
      baseState(),
    );
    expect(result.approved).toBe(false);
    expect(result.failedCheck).toBe("allowlist");
    // Should NOT be "counterparty" because allowlist is checked first
  });

  test("counterparty fails before price even if both would fail", () => {
    const result = validateAction(
      baseAction({
        actionType: "ORDER_MATCH",
        resource: "COMPUTE",
        pricePerUnit: 9999,
        counterpartyId: 42,
      }),
      baseConstraints({
        allowedActions: ["ORDER_MATCH"],
        counterpartyPreferences: { block: [42] },
        priceThresholds: { COMPUTE: { maxBuy: 1, minSell: 1 } },
      }),
      baseState(),
    );
    expect(result.approved).toBe(false);
    expect(result.failedCheck).toBe("counterparty");
  });
});
