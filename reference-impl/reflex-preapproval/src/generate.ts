import { Wallet } from "ethers";
import type {
  ParsedClauseForReflex,
  PreApproval,
  PreApprovalResult,
  ReflexConstraints,
  ReflexEventType,
  ReflexGameState,
} from "./types.js";
import { REFLEX_PREAPPROVAL_DOMAIN, REFLEX_PREAPPROVAL_TYPES } from "./types.js";

interface GenerateConfig {
  readonly triggerThreshold?: number;
  readonly expiryBlocks?: number;
}

const DEFAULT_TRIGGER_THRESHOLD = 0.4;
const DEFAULT_EXPIRY_BLOCKS = 1000;

/**
 * Check whether a clause is "close to triggering" based on prediction market
 * probabilities exceeding the given threshold.
 */
export function isCloseToTriggering(
  clause: ParsedClauseForReflex,
  gameState: ReflexGameState,
  threshold: number,
): boolean {
  return clause.conditions.some((condition) => {
    if (condition.source !== "PredictionMarket") {
      return false;
    }
    const marketId = condition.resourceOrMarketId;
    if (marketId === undefined) {
      return false;
    }
    const probability = gameState.predictionProbabilities[marketId];
    if (probability === undefined) {
      return false;
    }
    return probability > threshold;
  });
}

/**
 * Validate a clause's action against the guard constraints.
 * Returns undefined if valid, or a rejection reason string.
 */
function validateAgainstConstraints(
  clause: ParsedClauseForReflex,
  constraints: ReflexConstraints,
): string | undefined {
  const { actionType, params } = clause.action;

  // Check if the action type is in the allowed list
  if (!constraints.allowedActions.includes(actionType)) {
    return `Action type "${actionType}" is not in the allowed actions list`;
  }

  // Check resource budgets
  if (constraints.resourceBudgets !== undefined) {
    const resourceId = params["resourceId"];
    const amount = params["amount"];
    if (typeof resourceId === "string" && typeof amount === "number") {
      const budget = constraints.resourceBudgets[resourceId];
      if (budget !== undefined && amount > budget) {
        return `Amount ${amount} exceeds budget ${budget} for resource "${resourceId}"`;
      }
    }
  }

  // Check price thresholds
  if (constraints.priceThresholds !== undefined) {
    const marketId = params["marketId"];
    const price = params["price"];
    if (typeof marketId === "string" && typeof price === "number") {
      const thresholds = constraints.priceThresholds[marketId];
      if (thresholds !== undefined) {
        if (actionType === "POSITION_ADJUST" && price > thresholds.maxBuy) {
          return `Price ${price} exceeds max buy threshold ${thresholds.maxBuy} for market "${marketId}"`;
        }
      }
    }
  }

  // Check risk limits
  if (constraints.riskLimits?.maxDealExposure !== undefined) {
    const exposure = params["exposure"];
    if (typeof exposure === "number" && exposure > constraints.riskLimits.maxDealExposure) {
      return `Exposure ${exposure} exceeds max deal exposure ${constraints.riskLimits.maxDealExposure}`;
    }
  }

  return undefined;
}

/**
 * Find the matching event type from prediction probabilities that caused
 * this clause to be considered close to triggering.
 */
function findMatchingEventType(
  clause: ParsedClauseForReflex,
  gameState: ReflexGameState,
  threshold: number,
): ReflexEventType {
  for (const condition of clause.conditions) {
    if (condition.source !== "PredictionMarket") {
      continue;
    }
    const marketId = condition.resourceOrMarketId;
    if (marketId === undefined) {
      continue;
    }
    const probability = gameState.predictionProbabilities[marketId];
    if (probability !== undefined && probability > threshold) {
      // Map market ID to event type — use the market ID itself if it matches
      // a known event type, otherwise default to WORLD_EVENT
      const knownEventTypes: readonly ReflexEventType[] = [
        "CHIP_SHORTAGE",
        "ENERGY_CRISIS",
        "COOLING_CASCADE",
        "REGULATORY_CRACKDOWN",
        "DATA_BREACH",
        "TALENT_EXODUS",
        "MARKET_CRASH",
        "WORLD_EVENT",
      ];
      if (knownEventTypes.includes(marketId as ReflexEventType)) {
        return marketId as ReflexEventType;
      }
      return "WORLD_EVENT";
    }
  }
  return "WORLD_EVENT";
}

/**
 * Generate pre-signed reflex actions for clauses that are close to triggering.
 *
 * For each clause:
 * 1. Check if conditions are close to triggering (prediction probability > threshold)
 * 2. Validate action against guard constraints
 * 3. Sign using EIP-712 with the guard's private key
 * 4. Return PreApprovalResult with the signed pre-approval
 */
export async function generatePreApprovals(
  clauses: readonly ParsedClauseForReflex[],
  constraints: ReflexConstraints,
  gameState: ReflexGameState,
  guardSigner: Wallet,
  config?: GenerateConfig,
): Promise<readonly PreApprovalResult[]> {
  const threshold = config?.triggerThreshold ?? DEFAULT_TRIGGER_THRESHOLD;
  const expiryBlocks = config?.expiryBlocks ?? DEFAULT_EXPIRY_BLOCKS;

  const results: PreApprovalResult[] = [];

  for (const clause of clauses) {
    // Step 1: Check if clause is close to triggering
    if (!isCloseToTriggering(clause, gameState, threshold)) {
      results.push({
        generated: false,
        reason: "No conditions approaching trigger threshold",
      });
      continue;
    }

    // Step 2: Validate against guard constraints
    const rejectionReason = validateAgainstConstraints(clause, constraints);
    if (rejectionReason !== undefined) {
      results.push({
        generated: false,
        reason: rejectionReason,
      });
      continue;
    }

    // Step 3: Determine event type and build pre-approval data
    const eventType = findMatchingEventType(clause, gameState, threshold);
    const expiresAtBlock = gameState.currentBlock + expiryBlocks;
    const agentAddress = guardSigner.address;
    const orderId = typeof clause.action.params["orderId"] === "number"
      ? clause.action.params["orderId"]
      : 0;

    // Step 4: Sign using EIP-712
    const domain = {
      name: REFLEX_PREAPPROVAL_DOMAIN.name,
      version: REFLEX_PREAPPROVAL_DOMAIN.version,
    };

    const message = {
      clauseId: clause.clauseId,
      eventType,
      actionType: clause.action.actionType,
      orderId,
      expiresAtBlock,
      agentAddress,
    };

    const guardSignature = await guardSigner.signTypedData(
      domain,
      REFLEX_PREAPPROVAL_TYPES,
      message,
    );

    const preApproval: PreApproval = {
      clauseId: clause.clauseId,
      eventType,
      action: {
        actionType: clause.action.actionType,
        params: clause.action.params,
      },
      guardSignature,
      expiresAtBlock,
      agentAddress,
      ...(clause.action.actionType === "ORDER_CANCEL" && orderId > 0
        ? { orderId }
        : {}),
    };

    results.push({
      generated: true,
      preApproval,
    });
  }

  return results;
}
