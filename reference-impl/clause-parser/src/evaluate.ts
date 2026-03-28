import type {
  ParsedClause,
  ClauseGameState,
  ClauseAction,
  Condition,
  Comparator,
} from "./types.ts";

/**
 * Apply a comparator to two values.
 * For bigint comparisons, both operands must be bigint.
 * For number comparisons (EpochProgress, PredictionMarket), values are compared as numbers.
 */
function applyComparator(actual: bigint, comparator: Comparator, threshold: bigint): boolean {
  switch (comparator) {
    case "gt":
      return actual > threshold;
    case "lt":
      return actual < threshold;
    case "gte":
      return actual >= threshold;
    case "lte":
      return actual <= threshold;
    case "eq":
      return actual === threshold;
  }
}

/**
 * Resolve the actual value for a condition from the game state.
 * Returns the value as bigint for uniform comparison.
 */
function resolveConditionValue(
  condition: Condition,
  gameState: ClauseGameState
): bigint | undefined {
  const key = condition.resourceOrMarketId ?? "";

  switch (condition.source) {
    case "PredictionMarket": {
      const probability = gameState.predictionMarketProbabilities[key];
      return probability !== undefined ? BigInt(probability) : undefined;
    }
    case "ResourceBalance": {
      return gameState.resourceBalances[key];
    }
    case "TWAP": {
      return gameState.twapPrices[key];
    }
    case "EpochProgress": {
      return BigInt(gameState.epochTimeRemaining);
    }
  }
}

/** Result of evaluating a clause against game state */
export interface EvaluationResult {
  readonly triggered: boolean;
  readonly action?: ClauseAction;
}

/**
 * Evaluate all conditions of a parsed clause against the current game state.
 * ALL conditions must pass for the clause to trigger.
 *
 * If a condition references a data source key that doesn't exist in the game state,
 * that condition is treated as failing (not triggered).
 */
export function evaluateClause(
  parsed: ParsedClause,
  gameState: ClauseGameState
): EvaluationResult {
  for (const condition of parsed.conditions) {
    const actualValue = resolveConditionValue(condition, gameState);

    // Missing data source key means condition fails
    if (actualValue === undefined) {
      return { triggered: false };
    }

    if (!applyComparator(actualValue, condition.comparator, condition.value)) {
      return { triggered: false };
    }
  }

  return { triggered: true, action: parsed.action };
}
