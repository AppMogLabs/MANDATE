import type {
  ProposedAction,
  OperationalConstraints,
  EpochState,
  GuardResult,
  ResourceName,
  DealLeg,
} from "./types.ts";

const BUY_ACTIONS: ReadonlySet<string> = new Set(["ORDER_MATCH", "DEAL_SETTLE"]);
const SELL_ACTIONS: ReadonlySet<string> = new Set(["ORDER_PLACE"]);

function rejected(
  failedCheck: GuardResult["failedCheck"],
  reason: string,
): GuardResult {
  return { approved: false, failedCheck, reason };
}

function checkAllowlist(
  action: ProposedAction,
  constraints: OperationalConstraints,
): GuardResult | undefined {
  if (!constraints.allowedActions.includes(action.actionType)) {
    return rejected("allowlist", `Action "${action.actionType}" is not on the allowlist`);
  }
  return undefined;
}

function checkCounterparty(
  action: ProposedAction,
  constraints: OperationalConstraints,
): GuardResult | undefined {
  const blocked = constraints.counterpartyPreferences?.block;
  if (
    action.counterpartyId !== undefined &&
    blocked !== undefined &&
    blocked.includes(action.counterpartyId)
  ) {
    return rejected("counterparty", `Counterparty ${action.counterpartyId} is blocked`);
  }
  return undefined;
}

function checkPriceForResource(
  resource: ResourceName,
  pricePerUnit: number,
  actionType: string,
  constraints: OperationalConstraints,
): GuardResult | undefined {
  const threshold = constraints.priceThresholds?.[resource];
  if (threshold === undefined) {
    return undefined;
  }

  if (BUY_ACTIONS.has(actionType) && pricePerUnit > threshold.maxBuy) {
    return rejected(
      "price",
      `Buy price ${pricePerUnit} for ${resource} exceeds maxBuy ${threshold.maxBuy}`,
    );
  }

  if (SELL_ACTIONS.has(actionType) && pricePerUnit < threshold.minSell) {
    return rejected(
      "price",
      `Sell price ${pricePerUnit} for ${resource} below minSell ${threshold.minSell}`,
    );
  }

  // DEAL_SETTLE can be both buy and sell depending on legs; handled per-leg in checkPrice
  return undefined;
}

function checkPrice(
  action: ProposedAction,
  constraints: OperationalConstraints,
): GuardResult | undefined {
  if (constraints.priceThresholds === undefined) {
    return undefined;
  }

  // Check deal legs individually
  if (action.dealLegs !== undefined && action.dealLegs.length > 0) {
    for (const leg of action.dealLegs) {
      const result = checkPriceForResource(
        leg.resource,
        leg.pricePerUnit,
        action.actionType,
        constraints,
      );
      if (result !== undefined) {
        return result;
      }
    }
    return undefined;
  }

  // Check single resource action
  if (action.resource !== undefined && action.pricePerUnit !== undefined) {
    return checkPriceForResource(
      action.resource,
      action.pricePerUnit,
      action.actionType,
      constraints,
    );
  }

  return undefined;
}

function computeLegCost(leg: DealLeg): number {
  return leg.amount * leg.pricePerUnit;
}

function checkBudget(
  action: ProposedAction,
  constraints: OperationalConstraints,
  state: EpochState,
): GuardResult | undefined {
  if (constraints.resourceBudgets === undefined) {
    return undefined;
  }

  // Multi-leg deals: check each leg separately
  if (action.dealLegs !== undefined && action.dealLegs.length > 0) {
    for (const leg of action.dealLegs) {
      const budget = constraints.resourceBudgets[leg.resource];
      if (budget === undefined) {
        continue;
      }
      const spent = state.cumulativeSpend[leg.resource] ?? 0;
      const cost = computeLegCost(leg);
      if (spent + cost > budget) {
        return rejected(
          "budget",
          `Budget exceeded for ${leg.resource}: cumulative ${spent} + cost ${cost} > budget ${budget}`,
        );
      }
    }
    return undefined;
  }

  // Single resource action
  if (action.resource !== undefined) {
    const budget = constraints.resourceBudgets[action.resource];
    if (budget === undefined) {
      return undefined;
    }
    const spent = state.cumulativeSpend[action.resource] ?? 0;
    const cost = action.totalRateCost ?? (action.amount ?? 0) * (action.pricePerUnit ?? 0);
    if (spent + cost > budget) {
      return rejected(
        "budget",
        `Budget exceeded for ${action.resource}: cumulative ${spent} + cost ${cost} > budget ${budget}`,
      );
    }
  }

  return undefined;
}

function checkExposure(
  action: ProposedAction,
  constraints: OperationalConstraints,
  state: EpochState,
): GuardResult | undefined {
  const maxExposure = constraints.riskLimits?.maxDealExposure;
  if (maxExposure === undefined) {
    return undefined;
  }

  let totalCost: number;
  if (action.dealLegs !== undefined && action.dealLegs.length > 0) {
    totalCost = action.dealLegs.reduce((sum, leg) => sum + computeLegCost(leg), 0);
  } else if (action.totalRateCost !== undefined) {
    totalCost = action.totalRateCost;
  } else {
    return undefined;
  }

  if (state.currentRateBalance <= 0) {
    return rejected(
      "exposure",
      `Cannot calculate exposure: RATE balance is ${state.currentRateBalance}`,
    );
  }

  const exposurePercent = (totalCost / state.currentRateBalance) * 100;
  if (exposurePercent > maxExposure) {
    return rejected(
      "exposure",
      `Deal exposure ${exposurePercent.toFixed(1)}% exceeds limit ${maxExposure}%`,
    );
  }

  return undefined;
}

function checkConcentration(
  action: ProposedAction,
  constraints: OperationalConstraints,
  state: EpochState,
): GuardResult | undefined {
  const maxConcentration = constraints.riskLimits?.maxResourceConcentration;
  if (maxConcentration === undefined) {
    return undefined;
  }

  if (state.totalResourceSupply === undefined) {
    return undefined;
  }

  if (action.resource !== undefined && action.amount !== undefined) {
    const supply = state.totalResourceSupply[action.resource];
    if (supply === undefined || supply <= 0) {
      return undefined;
    }
    const currentBalance = state.currentResourceBalances[action.resource] ?? 0;
    const concentrationPercent = ((currentBalance + action.amount) / supply) * 100;
    if (concentrationPercent > maxConcentration) {
      return rejected(
        "concentration",
        `Resource concentration ${concentrationPercent.toFixed(1)}% for ${action.resource} exceeds limit ${maxConcentration}%`,
      );
    }
  }

  return undefined;
}

/**
 * Deterministic guard validation for a proposed agent action.
 * Runs six checks in order per spec section 3.6 and returns on first failure.
 * No randomness, no LLM calls.
 */
export function validateAction(
  action: ProposedAction,
  constraints: OperationalConstraints,
  state: EpochState,
): GuardResult {
  const checks: ReadonlyArray<() => GuardResult | undefined> = [
    () => checkAllowlist(action, constraints),
    () => checkCounterparty(action, constraints),
    () => checkPrice(action, constraints),
    () => checkBudget(action, constraints, state),
    () => checkExposure(action, constraints, state),
    () => checkConcentration(action, constraints, state),
  ];

  for (const check of checks) {
    const result = check();
    if (result !== undefined) {
      return result;
    }
  }

  return { approved: true };
}
