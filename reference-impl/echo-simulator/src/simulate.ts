/**
 * Echo Simulation Engine
 *
 * Deterministic rule-based engine that reads the mandate's tactical directives
 * and operational constraints to determine how the agent would reposition
 * if the highest-probability event fires.
 *
 * NOT an LLM — same inputs always produce same outputs.
 * Players who want more sophisticated simulation can replace this module.
 */

import type {
  ResourceName,
  EventProbability,
  RepositioningLeg,
  RepositioningPlan,
  MandateForEcho,
  GameStateForEcho,
  TradeDirection,
} from "./types.js";
import { RESOURCE_NAMES } from "./types.js";

/**
 * Simulate how the agent would reposition if the highest-probability
 * predicted event fires.
 *
 * @param mandate - Agent's Layer 1+2 mandate
 * @param gameState - Agent's Layer 3 game state
 * @param eventProbabilities - Prediction market probabilities
 * @returns RepositioningPlan with trade legs, or a plan with empty legs
 *          if no matching directives or no events above threshold
 */
export function simulateRepositioning(
  mandate: MandateForEcho,
  gameState: GameStateForEcho,
  eventProbabilities: readonly EventProbability[],
): RepositioningPlan {
  // 1. Find the highest-probability event
  const triggerEvent = selectTriggerEvent(eventProbabilities);

  if (triggerEvent === undefined) {
    return {
      triggerEventId: 0,
      triggerEventType: "NONE",
      triggerProbability: 0,
      legs: [],
      timestamp: gameState.timestamp,
    };
  }

  // 2. Match tactical directives against the trigger event
  const matchedDirectives = matchDirectives(
    mandate.tacticalDirectives ?? [],
    triggerEvent,
    gameState,
  );

  // 3. Convert matched directives into repositioning legs
  const rawLegs = directivesToLegs(matchedDirectives, gameState);

  // 4. Constrain legs within operational bounds (budgets, thresholds, risk)
  const constrainedLegs = constrainLegs(rawLegs, mandate, gameState);

  return {
    triggerEventId: triggerEvent.eventId,
    triggerEventType: triggerEvent.eventType,
    triggerProbability: triggerEvent.probability,
    legs: constrainedLegs,
    timestamp: gameState.timestamp,
  };
}

/**
 * Select the highest-probability event above the 10% threshold.
 * Events below 10% are considered noise.
 */
function selectTriggerEvent(
  events: readonly EventProbability[],
): EventProbability | undefined {
  const MIN_PROBABILITY = 0.1;

  let best: EventProbability | undefined;
  for (const ev of events) {
    if (ev.probability >= MIN_PROBABILITY) {
      if (best === undefined || ev.probability > best.probability) {
        best = ev;
      }
    }
  }
  return best;
}

/** A matched directive with its parsed action */
interface ParsedDirective {
  readonly resource: ResourceName;
  readonly direction: TradeDirection;
  readonly priority: "low" | "medium" | "high";
}

/**
 * Match tactical directives against the trigger event.
 * A directive matches if:
 *  - Its condition contains the event type (case-insensitive substring match)
 *  - OR its condition is "default" (always matches, lowest precedence)
 *  - AND its action references a resource name and a buy/sell direction
 */
function matchDirectives(
  directives: readonly { condition: string; action: string; priority: "low" | "medium" | "high" }[],
  triggerEvent: EventProbability,
  gameState: GameStateForEcho,
): readonly ParsedDirective[] {
  const parsed: ParsedDirective[] = [];
  const eventTypeLower = triggerEvent.eventType.toLowerCase();

  // Sort by priority: high > medium > low
  const priorityOrder: Record<string, number> = { high: 3, medium: 2, low: 1 };
  const sorted = [...directives].sort(
    (a, b) => (priorityOrder[b.priority] ?? 0) - (priorityOrder[a.priority] ?? 0),
  );

  for (const directive of sorted) {
    const condLower = directive.condition.toLowerCase();
    const isDefault = condLower === "default";

    // Check if condition matches event type or TWAP conditions
    const matchesEvent = condLower.includes(eventTypeLower);
    const matchesTwap = evaluateTwapCondition(condLower, gameState);

    if (!matchesEvent && !matchesTwap && !isDefault) continue;

    // Parse action to extract resource + direction
    const action = parseAction(directive.action);
    if (action !== undefined) {
      parsed.push({ ...action, priority: directive.priority });
    }
  }

  return parsed;
}

/**
 * Evaluate a simple TWAP condition like "CHIPS TWAP > 6".
 * Returns true if the condition matches current market state.
 */
function evaluateTwapCondition(
  condition: string,
  gameState: GameStateForEcho,
): boolean {
  // Match patterns like "CHIPS TWAP > 6" or "COMPUTE twap < 3"
  const twapPattern = /(\w+)\s+twap\s*([<>]=?)\s*(\d+(?:\.\d+)?)/i;
  const match = condition.match(twapPattern);
  if (match === null) return false;

  const [, resourceStr, operator, thresholdStr] = match;
  if (resourceStr === undefined || operator === undefined || thresholdStr === undefined) return false;

  const resource = resourceStr.toUpperCase() as ResourceName;
  if (!RESOURCE_NAMES.includes(resource)) return false;

  const threshold = parseFloat(thresholdStr);
  const twapPrice = gameState.marketSnapshot?.[resource]?.twapPrice;
  if (twapPrice === undefined) return false;

  switch (operator) {
    case ">": return twapPrice > threshold;
    case ">=": return twapPrice >= threshold;
    case "<": return twapPrice < threshold;
    case "<=": return twapPrice <= threshold;
    default: return false;
  }
}

/**
 * Parse an action string to extract resource and direction.
 * Handles patterns like:
 *  - "sell COMPUTE to build RATE reserves"
 *  - "buy DATA aggressively"
 *  - "prefer bilateral negotiation over OrderBook for CHIPS" → BUY CHIPS
 */
function parseAction(
  action: string,
): { resource: ResourceName; direction: TradeDirection } | undefined {
  const actionLower = action.toLowerCase();

  // Find which resource is mentioned
  let foundResource: ResourceName | undefined;
  for (const res of RESOURCE_NAMES) {
    if (actionLower.includes(res.toLowerCase())) {
      foundResource = res;
      break;
    }
  }

  if (foundResource === undefined) return undefined;

  // Determine direction by finding the first directional keyword
  // that appears BEFORE the resource name in the action string.
  // "sell COMPUTE to build RATE reserves" → "sell" is before "COMPUTE" → SELL
  const sellKeywords = ["sell", "dump", "liquidate", "divest", "reduce"];
  const buyKeywords = ["buy", "acquire", "accumulate", "prefer", "stockpile", "build"];

  const resourcePos = actionLower.indexOf(foundResource.toLowerCase());

  // Find earliest sell/buy keyword position before the resource
  let earliestSell = Infinity;
  for (const kw of sellKeywords) {
    const pos = actionLower.indexOf(kw);
    if (pos !== -1 && pos < earliestSell) earliestSell = pos;
  }

  let earliestBuy = Infinity;
  for (const kw of buyKeywords) {
    const pos = actionLower.indexOf(kw);
    if (pos !== -1 && pos < earliestBuy) earliestBuy = pos;
  }

  // Prefer the keyword that appears earliest (before the resource name)
  if (earliestSell < earliestBuy && earliestSell < resourcePos) {
    return { resource: foundResource, direction: "SELL" };
  }
  if (earliestBuy < earliestSell && earliestBuy < resourcePos) {
    return { resource: foundResource, direction: "BUY" };
  }

  // Fallback: check any keyword position if none appears before resource
  if (earliestSell < earliestBuy) return { resource: foundResource, direction: "SELL" };
  if (earliestBuy < earliestSell) return { resource: foundResource, direction: "BUY" };

  // Default to BUY if no directional keyword found
  return { resource: foundResource, direction: "BUY" };
}

/**
 * Convert parsed directives into raw repositioning legs.
 * Amount is calculated as a percentage of current balance (for sells)
 * or remaining budget (for buys).
 */
function directivesToLegs(
  directives: readonly ParsedDirective[],
  gameState: GameStateForEcho,
): RepositioningLeg[] {
  const legs: RepositioningLeg[] = [];
  const seenResources = new Set<ResourceName>();

  for (const directive of directives) {
    // Skip duplicate resources (higher-priority directive already handled it)
    if (seenResources.has(directive.resource)) continue;
    seenResources.add(directive.resource);

    const balance = gameState.currentBalances[directive.resource] ?? 0;
    const twapPrice = gameState.marketSnapshot?.[directive.resource]?.twapPrice ?? 1;

    let amount: number;
    if (directive.direction === "SELL") {
      // Sell a proportion based on priority
      const proportions: Record<string, number> = { high: 0.3, medium: 0.2, low: 0.1 };
      const proportion = proportions[directive.priority] ?? 0.1;
      amount = Math.floor(balance * proportion);
    } else {
      // Buy using a proportion of RATE balance
      const rateBalance = gameState.currentBalances["RATE"] ?? 0;
      const proportions: Record<string, number> = { high: 0.15, medium: 0.1, low: 0.05 };
      const proportion = proportions[directive.priority] ?? 0.05;
      const rateBudget = Math.floor(rateBalance * proportion);
      amount = twapPrice > 0 ? Math.floor(rateBudget / twapPrice) : 0;
    }

    if (amount > 0) {
      legs.push({
        resource: directive.resource,
        direction: directive.direction,
        amount,
        estimatedPricePerUnit: twapPrice,
      });
    }
  }

  return legs;
}

/**
 * Constrain repositioning legs within operational constraints.
 * Applies budget caps, price thresholds, exposure limits, and concentration limits.
 */
function constrainLegs(
  legs: readonly RepositioningLeg[],
  mandate: MandateForEcho,
  gameState: GameStateForEcho,
): RepositioningLeg[] {
  const constrained: RepositioningLeg[] = [];
  const rateBalance = gameState.currentBalances["RATE"] ?? 0;

  for (const leg of legs) {
    let { amount } = leg;

    // Price threshold check
    const threshold = mandate.priceThresholds?.[leg.resource];
    if (threshold !== undefined) {
      if (leg.direction === "BUY" && leg.estimatedPricePerUnit > threshold.maxBuy) continue;
      if (leg.direction === "SELL" && leg.estimatedPricePerUnit < threshold.minSell) continue;
    }

    // Budget check (for buys)
    if (leg.direction === "BUY") {
      const budget = mandate.resourceBudgets?.[leg.resource];
      if (budget !== undefined) {
        const costAtTwap = amount * leg.estimatedPricePerUnit;
        if (costAtTwap > budget) {
          amount = Math.floor(budget / leg.estimatedPricePerUnit);
        }
      }
    }

    // Exposure check (max % of RATE balance per deal)
    const maxExposure = mandate.riskLimits?.maxDealExposure;
    if (maxExposure !== undefined && leg.direction === "BUY" && rateBalance > 0) {
      const maxRateCost = Math.floor(rateBalance * maxExposure / 100);
      const costAtTwap = amount * leg.estimatedPricePerUnit;
      if (costAtTwap > maxRateCost) {
        amount = Math.floor(maxRateCost / leg.estimatedPricePerUnit);
      }
    }

    // Skip legs with zero amount after constraining
    if (amount > 0) {
      constrained.push({ ...leg, amount });
    }
  }

  return constrained;
}
