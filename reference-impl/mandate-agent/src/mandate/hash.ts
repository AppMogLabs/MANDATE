/**
 * On-chain hash commitment for the mandate.
 * keccak256(abi.encodePacked(layer1_text, canonicalJsonBytes(layer2_constraints)))
 */

import { keccak256, encodePacked } from "viem";
import type { Layer2Constraints } from "./schema.ts";

/**
 * Recursively sorts object keys for deterministic serialisation.
 */
function deepSortKeys(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(deepSortKeys);
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    sorted[key] = deepSortKeys((value as Record<string, unknown>)[key]);
  }
  return sorted;
}

/**
 * Produces canonical JSON bytes — recursively sorted keys, no whitespace.
 */
function canonicalJsonBytes(obj: unknown): `0x${string}` {
  const sorted = JSON.stringify(deepSortKeys(obj));
  const bytes = new TextEncoder().encode(sorted);
  return `0x${Buffer.from(bytes).toString("hex")}` as `0x${string}`;
}

/**
 * Computes the on-chain mandate hash per spec §1.4.
 * Only Layer 1 (text) and Layer 2 (constraints) are included.
 * Layer 3 is excluded because it changes every block.
 */
export function computeMandateHash(
  layer1Text: string,
  layer2Constraints: Layer2Constraints,
): `0x${string}` {
  const textBytes = new TextEncoder().encode(layer1Text);
  const textHex = `0x${Buffer.from(textBytes).toString("hex")}` as `0x${string}`;
  const constraintBytes = canonicalJsonBytes(layer2Constraints);

  return keccak256(
    encodePacked(["bytes", "bytes"], [textHex, constraintBytes]),
  );
}
