'use client';

import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAgentLifecycle } from '@/hooks/useAgentLifecycle';
import { useResourceBalances } from '@/hooks/chain/useResourceBalances';
import { useMvpMarket } from '@/hooks/useMvpMarket';
import { useMvpMandate } from '@/hooks/useMvpMandate';
import { useMvpEpoch } from '@/hooks/useMvpEpoch';
import type { GameState } from '@/agent/types';

interface MvpAgentContext {
  readonly lifecycle: ReturnType<typeof useAgentLifecycle>;
  readonly deploy: (mandateText: string) => void;
}

const Ctx = createContext<MvpAgentContext | null>(null);

/**
 * Wraps the /mvp route. Auto-configures the free-tier Anthropic LLM on wallet
 * ready, pushes current game state (balances + prices + epoch) to the agent
 * worker every 15s, and exposes a single `deploy(text)` call for the mandate
 * editor. Aggressiveness and priority resource use sensible MVP defaults so
 * the player only has to write text.
 */
export function MvpAgentProvider({ children }: { children: ReactNode }) {
  const { walletAddress } = useAuth();
  const lifecycle = useAgentLifecycle(walletAddress ?? '');
  const configuredRef = useRef(false);

  const { balances, rateBalance } = useResourceBalances(
    walletAddress as `0x${string}` | undefined,
  );
  const { prices } = useMvpMarket();
  const { remainingMs } = useMvpEpoch();
  const { mandate: savedMandateText } = useMvpMandate();

  // 1. Auto-configure LLM once wallet is ready
  useEffect(() => {
    if (!walletAddress || configuredRef.current) return;
    configuredRef.current = true;
    void lifecycle.configureLLM({
      provider: 'anthropic',
      model: 'claude-haiku-4-5-20251001',
      tier: 'free',
    });
  }, [walletAddress, lifecycle]);

  // 2. Push current game state to the worker regularly
  useEffect(() => {
    if (!lifecycle.llmConfigured) return;

    const gameState: GameState = {
      balances: balances ?? {},
      rateBalance,
      epochNumber: 1,
      timeRemaining: Math.floor(remainingMs / 1000),
      marketPrices: {
        COMPUTE: prices.COMPUTE.price,
        CHIPS: prices.CHIPS.price,
        DATA: prices.DATA.price,
      },
    };
    lifecycle.updateGameState(gameState);
  }, [lifecycle, balances, rateBalance, remainingMs, prices]);

  // 3. If we have a saved mandate from a previous session, re-deploy it so
  //    the worker picks up where it left off.
  useEffect(() => {
    if (!lifecycle.llmConfigured || lifecycle.mandateDeployed) return;
    if (!savedMandateText) return;
    lifecycle.deployMandate(savedMandateText, 5, 'COMPUTE');
  }, [lifecycle, savedMandateText]);

  const value = useMemo<MvpAgentContext>(
    () => ({
      lifecycle,
      deploy: (mandateText: string) => {
        lifecycle.deployMandate(mandateText, 5, 'COMPUTE');
      },
    }),
    [lifecycle],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMvpAgent(): MvpAgentContext {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error('useMvpAgent must be used within MvpAgentProvider');
  }
  return ctx;
}
