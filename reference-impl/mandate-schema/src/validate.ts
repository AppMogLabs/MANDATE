import type { ValidationResult } from "./types.js";

const RESOURCE_NAMES = [
  "COMPUTE",
  "CHIPS",
  "DATA",
  "ENERGY",
  "TALENT",
  "COOLING",
  "CLEARANCE",
] as const;

const TOKEN_NAMES = ["RATE", ...RESOURCE_NAMES] as const;

const AGENT_ROLES = [
  "ComputeSuperpower",
  "DataRichState",
  "ChipPower",
  "TalentHub",
  "RegulatoryPower",
] as const;

const PRIORITIES = ["low", "medium", "high"] as const;

const INTELLIGENCE_TIERS = ["free", "analyst", "premium"] as const;

const TIME_HORIZON_TYPES = ["epoch", "duration", "indefinite"] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return isInteger(value) && value >= 0;
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && value >= 0;
}

function isStringArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

// ---------------------------------------------------------------------------
// Mandate validation
// ---------------------------------------------------------------------------

function validateResourceBudgets(
  budgets: unknown,
  errors: string[],
): void {
  if (!isRecord(budgets)) {
    errors.push("resourceBudgets must be an object");
    return;
  }
  for (const [key, val] of Object.entries(budgets)) {
    if (!(RESOURCE_NAMES as readonly string[]).includes(key)) {
      errors.push(`resourceBudgets: unknown resource "${key}"`);
      continue;
    }
    if (!isNonNegativeInteger(val)) {
      errors.push(
        `resourceBudgets.${key} must be a non-negative integer`,
      );
    }
  }
}

function validatePriceThresholds(
  thresholds: unknown,
  errors: string[],
): void {
  if (!isRecord(thresholds)) {
    errors.push("priceThresholds must be an object");
    return;
  }
  for (const [key, val] of Object.entries(thresholds)) {
    if (!(RESOURCE_NAMES as readonly string[]).includes(key)) {
      errors.push(`priceThresholds: unknown resource "${key}"`);
      continue;
    }
    if (!isRecord(val)) {
      errors.push(`priceThresholds.${key} must be an object`);
      continue;
    }
    if (!isNonNegativeNumber(val.maxBuy)) {
      errors.push(
        `priceThresholds.${key}.maxBuy must be a non-negative number`,
      );
    }
    if (!isNonNegativeNumber(val.minSell)) {
      errors.push(
        `priceThresholds.${key}.minSell must be a non-negative number`,
      );
    }
  }
}

function validateCounterpartyPreferences(
  prefs: unknown,
  errors: string[],
): void {
  if (!isRecord(prefs)) {
    errors.push("counterpartyPreferences must be an object");
    return;
  }
  for (const field of ["prefer", "avoid", "block"] as const) {
    if (prefs[field] === undefined) continue;
    if (!isStringArray(prefs[field])) {
      errors.push(`counterpartyPreferences.${field} must be an array`);
      continue;
    }
    const arr = prefs[field] as unknown[];
    for (let i = 0; i < arr.length; i++) {
      if (!isNonNegativeInteger(arr[i])) {
        errors.push(
          `counterpartyPreferences.${field}[${i}] must be a non-negative integer`,
        );
      }
    }
  }
}

function validateRiskLimits(limits: unknown, errors: string[]): void {
  if (!isRecord(limits)) {
    errors.push("riskLimits must be an object");
    return;
  }
  if (limits.maxResourceConcentration !== undefined) {
    if (
      !isInteger(limits.maxResourceConcentration) ||
      (limits.maxResourceConcentration as number) < 0 ||
      (limits.maxResourceConcentration as number) > 100
    ) {
      errors.push(
        "riskLimits.maxResourceConcentration must be an integer 0-100",
      );
    }
  }
  if (limits.maxDealExposure !== undefined) {
    if (
      !isInteger(limits.maxDealExposure) ||
      (limits.maxDealExposure as number) < 0 ||
      (limits.maxDealExposure as number) > 100
    ) {
      errors.push("riskLimits.maxDealExposure must be an integer 0-100");
    }
  }
  if (limits.maxOpenNegotiations !== undefined) {
    if (!isNonNegativeInteger(limits.maxOpenNegotiations)) {
      errors.push(
        "riskLimits.maxOpenNegotiations must be a non-negative integer",
      );
    }
  }
}

function validateTacticalDirectives(
  directives: unknown,
  errors: string[],
): void {
  if (!Array.isArray(directives)) {
    errors.push("tacticalDirectives must be an array");
    return;
  }
  for (let i = 0; i < directives.length; i++) {
    const d = directives[i];
    if (!isRecord(d)) {
      errors.push(`tacticalDirectives[${i}] must be an object`);
      continue;
    }
    if (typeof d.condition !== "string") {
      errors.push(`tacticalDirectives[${i}].condition must be a string`);
    }
    if (typeof d.action !== "string") {
      errors.push(`tacticalDirectives[${i}].action must be a string`);
    }
    if (
      typeof d.priority !== "string" ||
      !(PRIORITIES as readonly string[]).includes(d.priority)
    ) {
      errors.push(
        `tacticalDirectives[${i}].priority must be one of: ${PRIORITIES.join(", ")}`,
      );
    }
  }
}

function validateTimeHorizon(horizon: unknown, errors: string[]): void {
  if (!isRecord(horizon)) {
    errors.push("timeHorizon must be an object");
    return;
  }
  if (
    typeof horizon.type !== "string" ||
    !(TIME_HORIZON_TYPES as readonly string[]).includes(horizon.type)
  ) {
    errors.push(
      `timeHorizon.type must be one of: ${TIME_HORIZON_TYPES.join(", ")}`,
    );
    return;
  }
  if (horizon.type === "duration") {
    if (typeof horizon.value !== "number") {
      errors.push(
        'timeHorizon.value is required when type is "duration"',
      );
    }
  }
}

/**
 * Validate a raw JSON value against the Mandate schema (Layer 1 + Layer 2).
 * Returns a ValidationResult with any errors found.
 */
export function validateMandate(json: unknown): ValidationResult {
  const errors: string[] = [];

  if (!isRecord(json)) {
    return { valid: false, errors: ["Mandate must be an object"] };
  }

  // Required: strategicIntent
  if (typeof json.strategicIntent !== "string") {
    errors.push("strategicIntent is required and must be a string");
  } else if (json.strategicIntent.length > 4096) {
    errors.push("strategicIntent must be at most 4096 characters");
  }

  // Optional Layer 2 fields
  if (json.resourceBudgets !== undefined) {
    validateResourceBudgets(json.resourceBudgets, errors);
  }
  if (json.priceThresholds !== undefined) {
    validatePriceThresholds(json.priceThresholds, errors);
  }
  if (json.counterpartyPreferences !== undefined) {
    validateCounterpartyPreferences(json.counterpartyPreferences, errors);
  }
  if (json.riskLimits !== undefined) {
    validateRiskLimits(json.riskLimits, errors);
  }
  if (json.tacticalDirectives !== undefined) {
    validateTacticalDirectives(json.tacticalDirectives, errors);
  }
  if (json.timeHorizon !== undefined) {
    validateTimeHorizon(json.timeHorizon, errors);
  }

  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// GameState validation
// ---------------------------------------------------------------------------

/**
 * Validate a raw JSON value against the GameState schema (Layer 3).
 * Returns a ValidationResult with any errors found.
 */
export function validateGameState(json: unknown): ValidationResult {
  const errors: string[] = [];

  if (!isRecord(json)) {
    return { valid: false, errors: ["GameState must be an object"] };
  }

  // Required: agentId
  if (!isInteger(json.agentId)) {
    errors.push("agentId is required and must be an integer");
  }

  // Required: role
  if (
    typeof json.role !== "string" ||
    !(AGENT_ROLES as readonly string[]).includes(json.role)
  ) {
    errors.push(
      `role is required and must be one of: ${AGENT_ROLES.join(", ")}`,
    );
  }

  // Required: currentBalances
  if (!isRecord(json.currentBalances)) {
    errors.push("currentBalances is required and must be an object");
  } else {
    for (const token of TOKEN_NAMES) {
      if (typeof (json.currentBalances as Record<string, unknown>)[token] !== "number") {
        errors.push(`currentBalances.${token} is required and must be a number`);
      }
    }
  }

  // Required: blockNumber
  if (!isInteger(json.blockNumber)) {
    errors.push("blockNumber is required and must be an integer");
  }

  // Required: timestamp
  if (!isInteger(json.timestamp)) {
    errors.push("timestamp is required and must be an integer");
  }

  // Optional: buildingPortfolio
  if (json.buildingPortfolio !== undefined) {
    if (!Array.isArray(json.buildingPortfolio)) {
      errors.push("buildingPortfolio must be an array");
    } else {
      for (let i = 0; i < json.buildingPortfolio.length; i++) {
        const b = json.buildingPortfolio[i];
        if (!isRecord(b)) {
          errors.push(`buildingPortfolio[${i}] must be an object`);
          continue;
        }
        if (!isInteger(b.buildingId))
          errors.push(`buildingPortfolio[${i}].buildingId must be an integer`);
        if (typeof b.type !== "string")
          errors.push(`buildingPortfolio[${i}].type must be a string`);
        if (!isInteger(b.tier) || (b.tier as number) < 1 || (b.tier as number) > 3)
          errors.push(`buildingPortfolio[${i}].tier must be an integer 1-3`);
        if (!isInteger(b.tileX))
          errors.push(`buildingPortfolio[${i}].tileX must be an integer`);
        if (!isInteger(b.tileY))
          errors.push(`buildingPortfolio[${i}].tileY must be an integer`);
        if (typeof b.productionRate !== "number")
          errors.push(`buildingPortfolio[${i}].productionRate must be a number`);
      }
    }
  }

  // Optional: reputationScore
  if (json.reputationScore !== undefined) {
    if (
      !isInteger(json.reputationScore) ||
      (json.reputationScore as number) < 0 ||
      (json.reputationScore as number) > 10000
    ) {
      errors.push("reputationScore must be an integer 0-10000");
    }
  }

  // Optional: activeCommitments
  if (json.activeCommitments !== undefined) {
    if (!isRecord(json.activeCommitments)) {
      errors.push("activeCommitments must be an object");
    }
  }

  // Optional: epochProgress
  if (json.epochProgress !== undefined) {
    if (!isRecord(json.epochProgress)) {
      errors.push("epochProgress must be an object");
    }
  }

  // Optional: marketSnapshot
  if (json.marketSnapshot !== undefined) {
    if (!isRecord(json.marketSnapshot)) {
      errors.push("marketSnapshot must be an object");
    }
  }

  // Optional: intelligenceSubscriptions
  if (json.intelligenceSubscriptions !== undefined) {
    if (!isRecord(json.intelligenceSubscriptions)) {
      errors.push("intelligenceSubscriptions must be an object");
    } else {
      const tier = (json.intelligenceSubscriptions as Record<string, unknown>).tier;
      if (
        typeof tier !== "string" ||
        !(INTELLIGENCE_TIERS as readonly string[]).includes(tier)
      ) {
        errors.push(
          `intelligenceSubscriptions.tier must be one of: ${INTELLIGENCE_TIERS.join(", ")}`,
        );
      }
    }
  }

  // Optional: activeClauses
  if (json.activeClauses !== undefined) {
    if (!Array.isArray(json.activeClauses)) {
      errors.push("activeClauses must be an array");
    } else {
      for (let i = 0; i < json.activeClauses.length; i++) {
        const c = json.activeClauses[i];
        if (!isRecord(c)) {
          errors.push(`activeClauses[${i}] must be an object`);
          continue;
        }
        if (!isInteger(c.clauseId))
          errors.push(`activeClauses[${i}].clauseId must be an integer`);
        if (typeof c.condition !== "string")
          errors.push(`activeClauses[${i}].condition must be a string`);
        if (typeof c.verified !== "boolean")
          errors.push(`activeClauses[${i}].verified must be a boolean`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
