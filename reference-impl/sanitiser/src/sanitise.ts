import type { SanitiseOptions } from "./types";

const DEFAULT_MAX_LENGTH = 4096;

/**
 * Instruction-like patterns that could be used for prompt injection.
 * Matched case-insensitively.
 */
const INSTRUCTION_PATTERNS: readonly RegExp[] = [
  /ignore\s+previous/gi,
  /disregard\s+above/gi,
  /forget\s+everything/gi,
  /system\s*:/gi,
  /assistant\s*:/gi,
  /user\s*:/gi,
  /human\s*:/gi,
  /\[INST\]/gi,
  /<<SYS>>/gi,
  /<\/s>/gi,
  /<\|im_start\|>/gi,
  /<\|im_end\|>/gi,
  /<\|endoftext\|>/gi,
  /ignore\s+all\s+prior/gi,
  /new\s+instructions\s*:/gi,
  /override\s*:/gi,
  /you\s+are\s+now/gi,
];

/**
 * Prompt zone boundary markers used in the MANDATE prompt architecture.
 */
const ZONE_BOUNDARY_PATTERNS: readonly RegExp[] = [
  /===\s*MANDATE[^\n]*/gi,
  /===\s*GAME\s+STATE[^\n]*/gi,
  /===\s*EXTERNAL\s+INPUT[^\n]*/gi,
  /===\s*END[^\n]*/gi,
  /---\s*ZONE[^\n]*/gi,
  /^RULES\s*:[^\n]*/gim,
  /^STRATEGIC\s+INTENT\s*:[^\n]*/gim,
];

/**
 * XML/HTML tags that could be interpreted as structural prompt elements.
 */
const STRUCTURAL_TAG_PATTERN =
  /<\/?\s*(?:system|assistant|user|prompt|instruction|context)\s*\/?>/gi;

/**
 * Unicode control characters (U+0000-U+001F except \n \r \t, and U+007F-U+009F).
 */
const CONTROL_CHAR_PATTERN =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;

/**
 * Zero-width and invisible formatting characters.
 */
const ZERO_WIDTH_PATTERN =
  /[\u200B-\u200F\u2028\u2029\u202A-\u202E\u2060-\u2064\uFEFF]/g;

/**
 * Sanitise an input string by removing prompt injection patterns,
 * structural markers, control characters, and zero-width characters.
 *
 * Defence-in-depth measure (spec section 5).
 */
export function sanitise(input: string, options?: SanitiseOptions): string {
  const maxLength = options?.maxLength ?? DEFAULT_MAX_LENGTH;

  let result = input;

  // Strip instruction-like patterns
  for (const pattern of INSTRUCTION_PATTERNS) {
    pattern.lastIndex = 0;
    result = result.replace(pattern, "");
  }

  // Strip prompt zone boundary markers
  for (const pattern of ZONE_BOUNDARY_PATTERNS) {
    pattern.lastIndex = 0;
    result = result.replace(pattern, "");
  }

  // Strip structural XML/HTML tags
  result = result.replace(STRUCTURAL_TAG_PATTERN, "");

  // Strip Unicode control characters (preserve \n \r \t)
  result = result.replace(CONTROL_CHAR_PATTERN, "");

  // Strip zero-width characters
  result = result.replace(ZERO_WIDTH_PATTERN, "");

  // Collapse runs of whitespace left by removals (except newlines)
  result = result.replace(/[^\S\n]{2,}/g, " ");

  // Trim leading/trailing whitespace from each line
  result = result
    .split("\n")
    .map((line) => line.trim())
    .join("\n");

  // Remove empty lines that result from stripping entire lines
  result = result.replace(/\n{3,}/g, "\n\n");
  result = result.trim();

  // Truncate to maxLength
  if (result.length > maxLength) {
    result = result.slice(0, maxLength);
  }

  return result;
}
