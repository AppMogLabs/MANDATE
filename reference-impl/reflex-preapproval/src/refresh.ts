import type { ReflexGameState, RefreshThresholds } from "./types.js";

interface RefreshResult {
  readonly refresh: boolean;
  readonly reasons: readonly string[];
}

/**
 * Determine whether pre-approvals should be regenerated based on
 * changes in game state since the last generation.
 *
 * Returns true if ANY threshold is exceeded, along with human-readable reasons.
 */
export function shouldRefresh(
  currentState: ReflexGameState,
  lastState: ReflexGameState,
  thresholds: RefreshThresholds,
): RefreshResult {
  const reasons: string[] = [];

  // Check market price changes
  for (const [marketId, current] of Object.entries(currentState.marketSnapshot)) {
    const previous = lastState.marketSnapshot[marketId];
    if (previous === undefined) {
      continue;
    }
    if (previous.twapPrice === 0) {
      continue;
    }
    const changePercent =
      Math.abs(current.twapPrice - previous.twapPrice) / previous.twapPrice * 100;
    if (changePercent > thresholds.priceChangePercent) {
      reasons.push(
        `Market "${marketId}" price changed by ${changePercent.toFixed(2)}% (threshold: ${thresholds.priceChangePercent}%)`,
      );
    }
  }

  // Check balance changes
  for (const [resource, currentBalance] of Object.entries(currentState.currentBalances)) {
    const previousBalance = lastState.currentBalances[resource];
    if (previousBalance === undefined) {
      continue;
    }
    if (previousBalance === 0) {
      continue;
    }
    const changePercent =
      Math.abs(currentBalance - previousBalance) / previousBalance * 100;
    if (changePercent > thresholds.balanceChangePercent) {
      reasons.push(
        `Balance for "${resource}" changed by ${changePercent.toFixed(2)}% (threshold: ${thresholds.balanceChangePercent}%)`,
      );
    }
  }

  // Check age
  const ageBlocks = currentState.currentBlock - lastState.currentBlock;
  if (ageBlocks > thresholds.maxAgeBlocks) {
    reasons.push(
      `Pre-approval age is ${ageBlocks} blocks (threshold: ${thresholds.maxAgeBlocks} blocks)`,
    );
  }

  return {
    refresh: reasons.length > 0,
    reasons,
  };
}
