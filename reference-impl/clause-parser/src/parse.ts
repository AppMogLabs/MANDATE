import type {
  ClauseTemplate,
  Comparator,
  Condition,
  ConditionSource,
  ClauseActionType,
  ClauseAction,
  ParsedClause,
  ParseResult,
} from "./types.ts";
import { MAX_OPCODES, MAX_GAS_ESTIMATE } from "./types.ts";

const VALID_SOURCES: ReadonlySet<string> = new Set<ConditionSource>([
  "PredictionMarket",
  "ResourceBalance",
  "TWAP",
  "EpochProgress",
]);

const VALID_COMPARATORS: ReadonlySet<string> = new Set<Comparator>([
  "gt",
  "lt",
  "gte",
  "lte",
  "eq",
]);

const VALID_ACTION_TYPES: ReadonlySet<string> = new Set<ClauseActionType>([
  "ORDER_CANCEL",
  "HEDGE_ACTIVATE",
  "POSITION_ADJUST",
]);

/**
 * Decode a hex string to a UTF-8 string.
 * Accepts optional "0x" prefix.
 */
function hexToUtf8(hex: string): string {
  const cleaned = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (cleaned.length % 2 !== 0) {
    throw new Error("Invalid hex string: odd length");
  }
  const bytes = new Uint8Array(cleaned.length / 2);
  for (let i = 0; i < cleaned.length; i += 2) {
    const byte = parseInt(cleaned.slice(i, i + 2), 16);
    if (Number.isNaN(byte)) {
      throw new Error(`Invalid hex character at position ${i}`);
    }
    bytes[i / 2] = byte;
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Encode a UTF-8 string to a hex string with "0x" prefix.
 */
function utf8ToHex(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let hex = "0x";
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}

function isConditionSource(value: string): value is ConditionSource {
  return VALID_SOURCES.has(value);
}

function isComparator(value: string): value is Comparator {
  return VALID_COMPARATORS.has(value);
}

function isClauseActionType(value: string): value is ClauseActionType {
  return VALID_ACTION_TYPES.has(value);
}

/**
 * Parse a hex-encoded JSON clause template into a validated ParsedClause.
 *
 * Takes hex-encoded JSON bytes (as they come from the on-chain `clauseBody` mapping),
 * decodes the JSON, validates against rules, and returns a ParsedClause or errors.
 */
export function parseClause(templateBytes: string): ParseResult {
  const errors: string[] = [];

  // Decode hex to JSON string
  let jsonStr: string;
  try {
    jsonStr = hexToUtf8(templateBytes);
  } catch {
    return { success: false, errors: ["Failed to decode hex bytes to UTF-8"] };
  }

  // Parse JSON
  let raw: unknown;
  try {
    raw = JSON.parse(jsonStr);
  } catch {
    return { success: false, errors: ["Failed to parse JSON from decoded bytes"] };
  }

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { success: false, errors: ["Template must be a JSON object"] };
  }

  const template = raw as Record<string, unknown>;

  // Validate version
  if (template["version"] !== 1) {
    errors.push("Template version must be 1");
  }

  // Validate conditions
  if (!Array.isArray(template["conditions"])) {
    errors.push("Template must have a conditions array");
    return { success: false, errors };
  }

  const rawConditions = template["conditions"] as unknown[];
  const conditions: Condition[] = [];

  for (let i = 0; i < rawConditions.length; i++) {
    const cond = rawConditions[i] as Record<string, unknown>;
    if (typeof cond !== "object" || cond === null) {
      errors.push(`Condition ${i}: must be an object`);
      continue;
    }

    const source = cond["source"];
    if (typeof source !== "string" || !isConditionSource(source)) {
      errors.push(
        `Condition ${i}: invalid source "${String(source)}". Must be one of: ${[...VALID_SOURCES].join(", ")}`
      );
    }

    const comparator = cond["comparator"];
    if (typeof comparator !== "string" || !isComparator(comparator)) {
      errors.push(
        `Condition ${i}: invalid comparator "${String(comparator)}". Must be one of: ${[...VALID_COMPARATORS].join(", ")}`
      );
    }

    const valueStr = cond["value"];
    let parsedValue: bigint = 0n;
    if (typeof valueStr !== "string") {
      errors.push(`Condition ${i}: value must be a string representation of bigint`);
    } else {
      try {
        parsedValue = BigInt(valueStr);
      } catch {
        errors.push(`Condition ${i}: value "${valueStr}" is not a valid bigint`);
      }
    }

    const resourceOrMarketId = cond["resourceOrMarketId"];
    if (resourceOrMarketId !== undefined && typeof resourceOrMarketId !== "string") {
      errors.push(`Condition ${i}: resourceOrMarketId must be a string if provided`);
    }

    if (errors.length === 0 || (isConditionSource(source as string) && isComparator(comparator as string))) {
      conditions.push({
        source: source as ConditionSource,
        comparator: comparator as Comparator,
        value: parsedValue,
        resourceOrMarketId: resourceOrMarketId as string | undefined,
      });
    }
  }

  // Validate action
  const rawAction = template["action"] as Record<string, unknown> | undefined;
  if (typeof rawAction !== "object" || rawAction === null || Array.isArray(rawAction)) {
    errors.push("Template must have an action object");
    return { success: false, errors };
  }

  const actionType = rawAction["actionType"];
  if (typeof actionType !== "string" || !isClauseActionType(actionType)) {
    errors.push(
      `Invalid action type "${String(actionType)}". Must be one of: ${[...VALID_ACTION_TYPES].join(", ")}`
    );
  }

  const actionParams = rawAction["params"];
  if (typeof actionParams !== "object" || actionParams === null || Array.isArray(actionParams)) {
    errors.push("Action must have a params object");
  }

  // Opcode count: each condition is 1 opcode, the action is 1 opcode
  const opcodeCount = rawConditions.length + 1;
  if (opcodeCount > MAX_OPCODES) {
    errors.push(
      `Opcode count ${opcodeCount} exceeds maximum of ${MAX_OPCODES} (${rawConditions.length} conditions + 1 action)`
    );
  }

  // Gas estimate
  const gasEstimate = template["gasEstimate"];
  if (typeof gasEstimate !== "number" || !Number.isFinite(gasEstimate)) {
    errors.push("gasEstimate must be a finite number");
  } else if (gasEstimate > MAX_GAS_ESTIMATE) {
    errors.push(
      `Gas estimate ${gasEstimate} exceeds maximum of ${MAX_GAS_ESTIMATE}`
    );
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  const action: ClauseAction = {
    actionType: actionType as ClauseActionType,
    params: actionParams as Record<string, string | number | boolean>,
  };

  const clause: ParsedClause = {
    conditions,
    action,
    gasEstimate: gasEstimate as number,
    opcodeCount,
    verified: true,
  };

  return { success: true, clause, errors: [] };
}

/**
 * Encode a ClauseTemplate to hex bytes (0x-prefixed).
 * Used by the marketplace UI and for testing roundtrips.
 */
export function encodeClauseTemplate(template: ClauseTemplate): string {
  const jsonStr = JSON.stringify(template);
  return utf8ToHex(jsonStr);
}
