'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useCallback, useMemo } from 'react';

export interface AuthState {
  /** Whether Privy has finished loading */
  ready: boolean;
  /** Whether the user is authenticated via social login */
  authenticated: boolean;
  /** The embedded wallet address (if available) */
  walletAddress: string | undefined;
  /** Trigger Privy login modal */
  login: () => void;
  /** Log out and clear session */
  logout: () => Promise<void>;
  /** The Privy user object */
  user: ReturnType<typeof usePrivy>['user'];
}

/**
 * Unified auth hook wrapping Privy.
 * Returns wallet address from the embedded wallet (not external wallets).
 *
 * IMPORTANT: This hook must only be called inside a PrivyProvider.
 * The LoginGate component handles the case where Privy isn't configured.
 */
export function useAuth(): AuthState {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const { wallets } = useWallets();

  const embeddedWallet = useMemo(
    () => wallets.find((w) => w.walletClientType === 'privy'),
    [wallets],
  );

  const handleLogout = useCallback(async () => {
    await logout();
  }, [logout]);

  return {
    ready,
    authenticated,
    walletAddress: embeddedWallet?.address,
    login,
    logout: handleLogout,
    user,
  };
}
