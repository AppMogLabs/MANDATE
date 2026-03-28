import { Wallet, verifyMessage as ethersVerify } from "ethers";
import type { NegotiationMessage } from "./types.js";

type UnsignedMessage = Omit<NegotiationMessage, "signature">;

function canonicalPayload(message: UnsignedMessage): string {
  const entries = Object.entries(message)
    .filter(([key]) => key !== "signature")
    .sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(Object.fromEntries(entries));
}

export async function signMessage(
  message: UnsignedMessage,
  privateKey: string,
): Promise<NegotiationMessage> {
  const wallet = new Wallet(privateKey);
  const payload = canonicalPayload(message);
  const signature = await wallet.signMessage(payload);
  return { ...message, signature } as NegotiationMessage;
}

interface VerificationResult {
  valid: boolean;
  recoveredAddress?: string;
  error?: string;
}

export function verifyMessage(message: NegotiationMessage): VerificationResult {
  try {
    const { signature, ...rest } = message;
    const payload = canonicalPayload(rest as UnsignedMessage);
    const recoveredAddress = ethersVerify(payload, signature);
    const valid = recoveredAddress.toLowerCase() === message.from.toLowerCase();
    return { valid, recoveredAddress };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Unknown verification error";
    return { valid: false, error: errorMessage };
  }
}
