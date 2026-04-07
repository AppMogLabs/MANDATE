'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePlayerRegistration } from '@/hooks/chain/usePlayerRegistration';

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? '';
const PRIVY_CONFIGURED = !!PRIVY_APP_ID && PRIVY_APP_ID !== 'placeholder';
const PRIVY_TIMEOUT_MS = 8_000; // Fall back to dev mode if Privy doesn't init in 8s

interface LoginGateProps {
  /** Render when authenticated + registration checked */
  readonly children: (props: {
    walletAddress: string;
    isRegistered: boolean;
    agentId: bigint | undefined;
  }) => React.ReactNode;
}

/**
 * LoginGate — blocks access until the player authenticates via Privy.
 * Once authenticated, checks on-chain registration status and passes it down.
 *
 * When Privy is not configured (no NEXT_PUBLIC_PRIVY_APP_ID), renders
 * children with a dev-mode fallback address.
 */
export function LoginGate({ children }: LoginGateProps) {
  if (!PRIVY_CONFIGURED) {
    return <DevModeFallback>{children}</DevModeFallback>;
  }

  return <AuthenticatedGate>{children}</AuthenticatedGate>;
}

// ── Dev Mode Fallback ─────────────────────────────────────────────────────────

function DevModeFallback({
  children,
}: {
  children: LoginGateProps['children'];
}) {
  const devAddress =
    process.env.NEXT_PUBLIC_PLAYER_ADDRESS ??
    '0x3382189F8a29607FdDf3D692B10a2D74480a503F';

  const { isRegistered, agentId, isLoading } =
    usePlayerRegistration(devAddress);

  if (isLoading || isRegistered === undefined) {
    return <LoadingScreen message="Dev mode — checking agent status..." />;
  }

  return (
    <>
      {children({
        walletAddress: devAddress,
        isRegistered: isRegistered ?? false,
        agentId,
      })}
    </>
  );
}

// ── Authenticated Gate (Privy active) ─────────────────────────────────────────

function AuthenticatedGate({
  children,
}: {
  children: LoginGateProps['children'];
}) {
  const { ready, authenticated, walletAddress, login } = useAuth();
  const { isRegistered, agentId, isLoading: registrationLoading } =
    usePlayerRegistration(walletAddress);

  // Privy still initializing — fall back to dev mode after timeout
  const [privyTimedOut, setPrivyTimedOut] = useState(false);
  useEffect(() => {
    if (ready) return;
    const timer = setTimeout(() => setPrivyTimedOut(true), PRIVY_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [ready]);

  if (!ready && !privyTimedOut) {
    return <LoadingScreen message="Initializing..." />;
  }

  if (!ready && privyTimedOut) {
    // Privy failed to initialize — fall back to dev mode
    return <DevModeFallback>{children}</DevModeFallback>;
  }

  // Not logged in — show landing with Play button
  if (!authenticated) {
    return <LandingScreen onPlay={login} />;
  }

  // Waiting for embedded wallet
  if (!walletAddress) {
    return <LoadingScreen message="Provisioning wallet..." />;
  }

  // Checking registration
  if (registrationLoading || isRegistered === undefined) {
    return <LoadingScreen message="Checking agent status..." />;
  }

  return (
    <>
      {children({
        walletAddress,
        isRegistered,
        agentId,
      })}
    </>
  );
}

// ── Landing Screen ────────────────────────────────────────────────────────────

function LandingScreen({ onPlay }: { onPlay: () => void }) {
  return (
    <div className="fixed inset-0 bg-night-sky flex flex-col items-center justify-center z-[9999]">
      <div className="text-center space-y-8">
        {/* Title */}
        <div className="space-y-2">
          <h1 className="text-5xl font-bold tracking-[0.3em] text-text-primary">
            MANDATE
          </h1>
          <p className="text-sm text-text-tertiary tracking-widest uppercase">
            AI-Native Strategy Game
          </p>
        </div>

        {/* Tagline */}
        <p className="text-text-secondary max-w-md mx-auto text-sm leading-relaxed">
          Write strategic mandates. Deploy autonomous agents. Compete for
          dominance on a persistent blockchain world.
        </p>

        {/* Play Button */}
        <button
          onClick={onPlay}
          className="px-10 py-3 bg-[#7CD8D5] text-night-sky font-bold text-sm tracking-wider uppercase rounded hover:bg-[#9AE4E2] transition-colors"
        >
          Play
        </button>

        {/* Subtitle */}
        <p className="text-xs text-text-tertiary">
          No wallet required. No gas fees. Sign in to start.
        </p>
      </div>

      {/* Version tag */}
      <div className="absolute bottom-6 text-xs text-text-tertiary">
        MegaETH Testnet | Phase 6
      </div>
    </div>
  );
}

// ── Loading Screen ────────────────────────────────────────────────────────────

function LoadingScreen({ message }: { message: string }) {
  return (
    <div className="fixed inset-0 bg-night-sky flex flex-col items-center justify-center z-[9999]">
      <div className="text-center space-y-4">
        <div className="w-6 h-6 border-2 border-text-tertiary border-t-[#7CD8D5] rounded-full animate-spin mx-auto" />
        <p className="text-sm text-text-secondary">{message}</p>
      </div>
    </div>
  );
}
