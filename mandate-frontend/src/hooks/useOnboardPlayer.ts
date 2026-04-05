'use client';

import { useState, useCallback } from 'react';

interface OnboardResult {
  success: boolean;
  txHash?: string;
  agentId?: number;
  error?: string;
}

interface OnboardPlayerState {
  /** Call to register a player on-chain */
  onboard: (playerAddress: string, role: number) => Promise<OnboardResult>;
  /** Whether registration is in progress */
  isLoading: boolean;
  /** Error message if registration failed */
  error: string | null;
  /** Result of last successful registration */
  result: OnboardResult | null;
}

/**
 * Hook to register a new player via the /api/register endpoint.
 * This calls the backend relay which uses the operator wallet to call
 * PlayerOnboarding.onboardPlayer().
 */
export function useOnboardPlayer(): OnboardPlayerState {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OnboardResult | null>(null);

  const onboard = useCallback(async (playerAddress: string, role: number): Promise<OnboardResult> => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerAddress, role }),
      });

      const data = await res.json();

      if (!res.ok) {
        const errMsg = data.error ?? 'Registration failed';
        setError(errMsg);
        return { success: false, error: errMsg };
      }

      const onboardResult: OnboardResult = {
        success: true,
        txHash: data.txHash,
        agentId: data.agentId,
      };
      setResult(onboardResult);
      return onboardResult;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error';
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { onboard, isLoading, error, result };
}
