import type { ReturnValueType } from "./types";

/** ABI word size: 32 bytes = 64 hex characters */
const ABI_WORD_HEX_LENGTH = 64;

/** Expected hex lengths for fixed-size types (in hex characters, without 0x prefix) */
const FIXED_TYPE_LENGTHS: Record<string, number> = {
  address: ABI_WORD_HEX_LENGTH,
  uint256: ABI_WORD_HEX_LENGTH,
  bool: ABI_WORD_HEX_LENGTH,
  bytes32: ABI_WORD_HEX_LENGTH,
};

interface ReturnValueValidation {
  valid: boolean;
  error?: string;
}

/**
 * Validate that a hex-encoded contract return value matches the expected
 * ABI type length before decoding. Rejects return values that exceed
 * expected length for their type (spec section 5.3).
 */
export function validateReturnValue(
  hexBytes: string,
  expectedType: ReturnValueType,
): ReturnValueValidation {
  // Strip optional 0x prefix
  const hex = hexBytes.startsWith("0x") ? hexBytes.slice(2) : hexBytes;

  // Must be valid hex
  if (!/^[0-9a-fA-F]*$/.test(hex)) {
    return { valid: false, error: "Invalid hex characters in return value" };
  }

  // Must not be empty
  if (hex.length === 0) {
    return { valid: false, error: "Empty return value" };
  }

  if (expectedType === "string") {
    // String type uses dynamic ABI encoding:
    // First word is the offset, second word is the length, then the data.
    // Minimum valid encoding is at least one word (the offset).
    if (hex.length < ABI_WORD_HEX_LENGTH) {
      return {
        valid: false,
        error: `String return value too short: expected at least ${ABI_WORD_HEX_LENGTH} hex chars for ABI offset, got ${hex.length}`,
      };
    }

    // The offset must be a valid multiple of 32 (0x20)
    const offset = parseInt(hex.slice(0, ABI_WORD_HEX_LENGTH), 16);
    if (offset % 32 !== 0) {
      return {
        valid: false,
        error: `Invalid ABI offset for string type: ${offset} is not a multiple of 32`,
      };
    }

    return { valid: true };
  }

  // Fixed-size types
  const expectedLength = FIXED_TYPE_LENGTHS[expectedType];
  if (expectedLength === undefined) {
    return { valid: false, error: `Unknown return value type: ${expectedType}` };
  }

  if (hex.length !== expectedLength) {
    return {
      valid: false,
      error: `Expected ${expectedLength} hex chars for ${expectedType}, got ${hex.length}`,
    };
  }

  return { valid: true };
}
