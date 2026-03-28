import type { ParsedClause, Condition, ClauseAction, ClauseActionType } from "./types.ts";

/**
 * Format a bigint value for human readability.
 * Values in wei (18 decimals) are converted to whole units.
 * Smaller values are displayed as-is.
 */
function formatValue(value: bigint, source: string): string {
  // For PredictionMarket, values are in basis points (0-10000)
  if (source === "PredictionMarket") {
    const percentage = Number(value) / 100;
    return `${percentage}%`;
  }

  // For EpochProgress, value is seconds
  if (source === "EpochProgress") {
    return `${value} seconds`;
  }

  // For ResourceBalance and TWAP, values are in wei — show whole units if large enough
  const weiPerUnit = 10n ** 18n;
  if (value >= weiPerUnit) {
    const wholeUnits = value / weiPerUnit;
    const remainder = value % weiPerUnit;
    if (remainder === 0n) {
      return `${wholeUnits}`;
    }
    // Show up to 4 decimal places
    const decimals = (remainder * 10000n) / weiPerUnit;
    return `${wholeUnits}.${decimals.toString().padStart(4, "0")}`;
  }

  return `${value}`;
}

/**
 * Render a comparator as a human-readable phrase.
 */
function comparatorPhrase(comparator: string, source: string): string {
  switch (comparator) {
    case "gt":
      return source === "PredictionMarket" ? "exceeds" : "rises above";
    case "gte":
      return source === "PredictionMarket" ? "reaches or exceeds" : "is at or above";
    case "lt":
      return "drops below";
    case "lte":
      return "is at or below";
    case "eq":
      return "equals";
    default:
      return comparator;
  }
}

/**
 * Render a single condition as a human-readable clause.
 */
function renderCondition(condition: Condition): string {
  const id = condition.resourceOrMarketId ?? "unknown";
  const valueStr = formatValue(condition.value, condition.source);
  const phrase = comparatorPhrase(condition.comparator, condition.source);

  switch (condition.source) {
    case "PredictionMarket":
      return `${id} probability ${phrase} ${valueStr}`;
    case "ResourceBalance":
      return `${id} balance ${phrase} ${valueStr}`;
    case "TWAP":
      return `${id} TWAP ${phrase} ${valueStr} RATE`;
    case "EpochProgress":
      return `epoch time remaining ${phrase} ${valueStr}`;
  }
}

/**
 * Render a clause action as a human-readable directive.
 */
function renderAction(action: ClauseAction): string {
  switch (action.actionType) {
    case "ORDER_CANCEL":
      return "auto-cancel hedged orders";
    case "HEDGE_ACTIVATE": {
      const target = action.params["target"] ?? "position";
      return `activate hedge on ${target}`;
    }
    case "POSITION_ADJUST": {
      const direction = action.params["direction"] ?? "adjust";
      const resource = action.params["resource"] ?? "position";
      if (direction === "buy" || direction === "acquire") {
        return `adjust position by acquiring more ${resource}`;
      }
      if (direction === "sell" || direction === "reduce") {
        return `adjust position by reducing ${resource}`;
      }
      return `adjust ${resource} position`;
    }
  }
}

/**
 * Convert a ParsedClause into a human-readable tactical directive
 * suitable for Zone 2 of the LLM agent context.
 *
 * Format: "If {condition1} and {condition2}, {action}."
 */
export function clauseToDirective(parsed: ParsedClause): string {
  const conditionParts = parsed.conditions.map(renderCondition);
  const conditionStr = conditionParts.join(" and ");
  const actionStr = renderAction(parsed.action);

  return `If ${conditionStr}, ${actionStr}.`;
}
