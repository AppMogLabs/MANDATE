/**
 * Echo Hash Generation
 *
 * Generates the repositioning hash committed to MandateEchoOracle.
 * Uses keccak256(abi.encodePacked(resource, direction, amount)) per leg,
 * then hashes all leg hashes together for the final commitment.
 *
 * Deterministic: same plan always produces the same hash.
 */

import { keccak256, solidityPacked, AbiCoder } from "ethers";
import type { RepositioningPlan, RepositioningLeg, EchoCommitment } from "./types.js";

/**
 * Generate the echo hash for a repositioning plan.
 *
 * Each leg is encoded as keccak256(abi.encodePacked(resource, direction, amount)).
 * The final hash is keccak256(abi.encodePacked(legHash0, legHash1, ...)).
 *
 * @param plan - The repositioning plan to hash
 * @returns bytes32 hex string (the echo hash for on-chain commitment)
 */
export function generateEchoHash(plan: RepositioningPlan): string {
  if (plan.legs.length === 0) {
    // Empty plan hashes to a deterministic "null" value
    return keccak256(solidityPacked(["string"], ["EMPTY_ECHO"]));
  }

  // Hash each leg
  const legHashes: string[] = [];
  for (const leg of plan.legs) {
    const legHash = hashLeg(leg);
    legHashes.push(legHash);
  }

  // Combine all leg hashes into final echo hash
  // Sort leg hashes for deterministic ordering regardless of leg order
  legHashes.sort();
  return keccak256(solidityPacked(
    legHashes.map(() => "bytes32"),
    legHashes,
  ));
}

/**
 * Hash a single repositioning leg.
 * keccak256(abi.encodePacked(resource, direction, amount))
 */
function hashLeg(leg: RepositioningLeg): string {
  return keccak256(solidityPacked(
    ["string", "string", "uint256"],
    [leg.resource, leg.direction, BigInt(leg.amount)],
  ));
}

/**
 * Generate a full echo commitment for the commit-reveal pattern.
 *
 * The commitment is keccak256(abi.encode(echoHash, nonce)).
 * The agent stores the nonce privately; the commitment goes on-chain
 * via MandateEchoOracle.commitVector().
 *
 * After the event resolves, the agent reveals (echoHash, nonce) and
 * the contract verifies keccak256(abi.encode(echoHash, nonce)) == commitment.
 *
 * @param plan - The repositioning plan
 * @param nonce - Random nonce for the commitment (stored privately)
 * @returns EchoCommitment with commitment hash, nonce, and original plan
 */
export function generateEchoCommitment(
  plan: RepositioningPlan,
  nonce: number,
): EchoCommitment {
  const echoHash = generateEchoHash(plan);

  // commitment = keccak256(abi.encode(echoHash, nonce))
  const coder = AbiCoder.defaultAbiCoder();
  const encoded = coder.encode(["bytes32", "uint256"], [echoHash, BigInt(nonce)]);
  const commitment = keccak256(encoded);

  return {
    commitment,
    nonce,
    plan,
  };
}

/**
 * Verify that a revealed echo hash matches a commitment.
 * Used by the verification system to check reveals.
 *
 * @param commitment - The on-chain commitment (bytes32)
 * @param echoHash - The revealed echo hash
 * @param nonce - The revealed nonce
 * @returns true if keccak256(abi.encode(echoHash, nonce)) == commitment
 */
export function verifyEchoReveal(
  commitment: string,
  echoHash: string,
  nonce: number,
): boolean {
  const coder = AbiCoder.defaultAbiCoder();
  const encoded = coder.encode(["bytes32", "uint256"], [echoHash, BigInt(nonce)]);
  const computed = keccak256(encoded);
  return computed === commitment;
}
