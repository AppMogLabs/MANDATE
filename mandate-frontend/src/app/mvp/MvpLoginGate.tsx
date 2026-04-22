'use client';

import type { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';

/**
 * Gates /mvp behind Privy login. While Privy is still booting shows a
 * skeleton. If Privy isn't configured at all (dev mode), renders children
 * with the default player address (existing behaviour).
 */
export function MvpLoginGate({ children }: { children: ReactNode }) {
  const PRIVY_CONFIGURED = !!process.env.NEXT_PUBLIC_PRIVY_APP_ID &&
    process.env.NEXT_PUBLIC_PRIVY_APP_ID !== 'placeholder';

  if (!PRIVY_CONFIGURED) return <>{children}</>;

  return <PrivyGate>{children}</PrivyGate>;
}

function PrivyGate({ children }: { children: ReactNode }) {
  const { ready, authenticated, login, walletAddress } = useAuth();

  if (!ready) {
    return <Skeleton label="Initialising wallet..." />;
  }

  if (!authenticated || !walletAddress) {
    return <Landing onLogin={login} />;
  }

  return <>{children}</>;
}

function Skeleton({ label }: { label: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-night-sky text-text-secondary">
      <div className="text-center">
        <div className="inline-block w-6 h-6 border border-border-default border-t-moon-white rounded-full animate-spin mb-4" />
        <p className="text-xs font-[family-name:var(--font-terminal)] uppercase tracking-wide">
          {label}
        </p>
      </div>
    </div>
  );
}

function Landing({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="min-h-screen bg-night-sky text-text-primary">
      <div className="mx-auto max-w-[420px] px-6 pt-20 pb-10 flex flex-col min-h-screen">
        <div className="flex-1">
          <h1 className="text-3xl font-[family-name:var(--font-terminal)] tracking-tight">
            MANDATE
          </h1>
          <p className="mt-2 text-[11px] uppercase tracking-[0.2em] text-text-tertiary font-[family-name:var(--font-terminal)]">
            AI-native trading game on MegaETH
          </p>

          <div className="mt-12 space-y-6 text-sm text-text-secondary leading-relaxed">
            <p>
              Write a natural-language mandate. Your autonomous AI agent trades
              COMPUTE, CHIPS and DATA on your behalf for the next seven days.
            </p>
            <p>
              World events shift prices. Whoever reads events fastest and updates
              their mandate best wins the epoch.
            </p>
          </div>

          <div className="mt-10 border-t border-border-default/60 pt-6 space-y-3 font-[family-name:var(--font-terminal)] text-[11px] text-text-tertiary">
            <div className="flex justify-between">
              <span>CHAIN</span>
              <span className="text-text-secondary">MegaETH testnet</span>
            </div>
            <div className="flex justify-between">
              <span>EPOCH</span>
              <span className="text-text-secondary">7 days — active now</span>
            </div>
            <div className="flex justify-between">
              <span>WALLET</span>
              <span className="text-text-secondary">Privy embedded, gasless</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onLogin}
          className="mt-10 w-full py-3.5 bg-moon-white text-night-sky text-sm tracking-wide uppercase hover:opacity-90 transition-opacity"
        >
          Connect wallet
        </button>
        <p className="mt-3 text-center text-[10px] text-text-tertiary font-[family-name:var(--font-terminal)]">
          Email or social login. No seed phrase. Testnet only.
        </p>
      </div>
    </div>
  );
}
