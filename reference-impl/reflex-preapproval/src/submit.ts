import { Contract, keccak256, toUtf8Bytes } from "ethers";
import type { Signer } from "ethers";
import type { PreApproval, SubmitResult } from "./types.js";
import { ORDER_BOOK_REFLEX_ABI, REFLEX_WINDOW_ABI } from "./types.js";

/**
 * Submit a pre-approved reflex action to the chain.
 *
 * Validates:
 * 1. The reflex window is still active for the given event
 * 2. The agent has not already used their nonce for this event
 * 3. The pre-approval has not expired
 *
 * For ORDER_CANCEL actions, calls OrderBook.executeReflexCancellation.
 */
export async function submitReflexAction(
  preApproval: PreApproval,
  eventId: number,
  reflexManagerAddress: string,
  orderBookAddress: string,
  signer: Signer,
): Promise<SubmitResult> {
  // Check expiry first (no RPC needed)
  const provider = signer.provider;
  if (provider === null || provider === undefined) {
    return { success: false, error: "Signer has no provider attached" };
  }

  const currentBlock = await provider.getBlockNumber();
  if (preApproval.expiresAtBlock < currentBlock) {
    return {
      success: false,
      error: `Pre-approval expired at block ${preApproval.expiresAtBlock}, current block is ${currentBlock}`,
    };
  }

  // Check if reflex window is still active
  const reflexManager = new Contract(reflexManagerAddress, REFLEX_WINDOW_ABI, provider);

  const isActive = await reflexManager.isReflexActive(eventId) as boolean;
  if (!isActive) {
    return {
      success: false,
      error: `Reflex window is not active for event ${eventId}`,
    };
  }

  // Check if agent has already used their nonce for this event
  const hasUsed = await reflexManager.hasUsedNonce(
    preApproval.agentAddress,
    eventId,
  ) as boolean;
  if (hasUsed) {
    return {
      success: false,
      error: `Agent ${preApproval.agentAddress} has already used nonce for event ${eventId}`,
    };
  }

  // Submit the action based on type
  try {
    if (preApproval.action.actionType === "ORDER_CANCEL") {
      const orderId = preApproval.orderId;
      if (orderId === undefined) {
        return { success: false, error: "ORDER_CANCEL action requires an orderId" };
      }

      const guardHash = keccak256(toUtf8Bytes(preApproval.guardSignature));
      const orderBook = new Contract(orderBookAddress, ORDER_BOOK_REFLEX_ABI, signer);
      const tx = await orderBook.executeReflexCancellation(orderId, guardHash) as { hash: string };

      return { success: true, txHash: tx.hash };
    }

    // For other action types, return an error indicating they're not yet supported
    return {
      success: false,
      error: `Action type "${preApproval.action.actionType}" is not yet supported for on-chain submission`,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Transaction failed: ${message}` };
  }
}
