import { keccak256, toUtf8Bytes } from "ethers";
import type { Mandate } from "./types.js";

/**
 * Produce a deterministic JSON string from an arbitrary value.
 * Object keys are sorted recursively; no whitespace is added.
 */
export function canonicalJson(obj: unknown): string {
  if (obj === null || obj === undefined) {
    return JSON.stringify(obj);
  }

  if (typeof obj !== "object") {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    const items = obj.map((item) => canonicalJson(item));
    return `[${items.join(",")}]`;
  }

  const record = obj as Record<string, unknown>;
  const sortedKeys = Object.keys(record).sort();
  const pairs = sortedKeys.map(
    (key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`,
  );
  return `{${pairs.join(",")}}`;
}

/**
 * Compute the keccak256 hash of a Mandate using deterministic
 * JSON serialisation. Returns a hex string (0x-prefixed).
 */
export function computeMandateHash(mandate: Mandate): string {
  const serialised = canonicalJson(mandate);
  return keccak256(toUtf8Bytes(serialised));
}
