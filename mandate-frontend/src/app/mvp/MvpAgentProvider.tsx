'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAgentWorker } from '@/hooks/useAgentWorker';
import { useResourceBalances } from '@/hooks/chain/useResourceBalances';
import { useMvpMarket } from '@/hooks/useMvpMarket';
import { useMvpMandate } from '@/hooks/useMvpMandate';
import { useMvpEpochChain } from '@/hooks/useMvpEpochChain';
import { useMvpOnboarding, type OnboardingState } from '@/hooks/useMvpOnboarding';
import { useMvpActionSubmitter } from '@/hooks/useMvpActionSubmitter';
import { useMvpActiveOrders } from '@/hooks/useMvpActiveOrders';
import type { AgentConfig, GameState, Mandate, ProposedAction } from '@/agent/types';

interface SubmittedAction {
  readonly timestamp: number;
  readonly description: string;
  readonly txHash?: string;
  readonly error?: string;
}

interface MvpAgentContext {
  readonly agent: ReturnType<typeof useAgentWorker>;
  readonly onboarding: OnboardingState;
  readonly submittedActions: readonly SubmittedAction[];
  readonly deploy: (mandateText: string) => Promise<void>;
}

const Ctx = createContext<MvpAgentContext | null>(null);

/**
 * MVP provider. Owns the agent worker, onboarding flow, and client-side
 * Privy-signing submitter. Replaces useAgentLifecycle for the /mvp route so
 * trades come from the player's own embedded wallet and actually change
 * their on-chain balance.
 */
export function MvpAgentProvider({ children }: { children: ReactNode }) {
  const { walletAddress } = useAuth();
  const onboarding = useMvpOnboarding(walletAddress);
  const submitAction = useMvpActionSubmitter(walletAddress);
  const [submittedActions, setSubmittedActions] = useState<readonly SubmittedAction[]>([]);

  const handleSignAndSubmit = useCallback(
    async (_requestId: string, action: ProposedAction) => {
      const result = await submitAction(action);
      setSubmittedActions((prev) => [
        ...prev,
        {
          timestamp: Date.now(),
          description: result.description,
          txHash: result.txHash,
          error: result.error,
        },
      ]);
    },
    [submitAction],
  );

  const agent = useAgentWorker(handleSignAndSubmit);

  const { balances, rateBalance } = useResourceBalances(
    walletAddress as `0x${string}` | undefined,
  );
  const { prices } = useMvpMarket();
  const { remainingMs } = useMvpEpochChain();
  const { mandate: savedMandateText } = useMvpMandate();
  const { byResource: openSells } = useMvpActiveOrders(3);

  // Configure the LLM once we have a wallet.
  const configuredRef = useRef(false);
  useEffect(() => {
    if (!walletAddress || configuredRef.current) return;
    configuredRef.current = true;
    const sessionToken = `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const cfg: AgentConfig = {
      proxyUrl: '',
      provider: 'anthropic',
      model: 'claude-haiku-4-5-20251001',
      sessionToken,
      tickIntervalMs: 60_000,
      playerAddress: walletAddress,
      agentId: 0,
      promptVariant: 'mvp',
    };
    agent.setConfig(cfg);
  }, [walletAddress, agent]);

  // Push live game state every render (cheap — just updates a ref inside
  // the worker).
  useEffect(() => {
    if (!walletAddress) return;
    const state: GameState = {
      balances: balances ?? {},
      rateBalance,
      epochNumber: 1,
      timeRemaining: Math.floor(remainingMs / 1000),
      marketPrices: {
        COMPUTE: prices.COMPUTE.price,
        CHIPS: prices.CHIPS.price,
        DATA: prices.DATA.price,
      },
      mvpOpenSells: {
        COMPUTE: openSells.COMPUTE,
        CHIPS: openSells.CHIPS,
        DATA: openSells.DATA,
      },
    };
    agent.updateGameState(state);
  }, [walletAddress, balances, rateBalance, remainingMs, prices, openSells, agent]);

  // Re-deploy persisted mandate on reload once onboarding is done.
  const reDeployedRef = useRef(false);
  useEffect(() => {
    if (reDeployedRef.current) return;
    if (onboarding.status !== 'ready') return;
    if (!savedMandateText) return;
    reDeployedRef.current = true;
    const mandate: Mandate = {
      layer1: savedMandateText,
      layer2: {
        trading: {
          aggressiveness: 5,
          maxSingleTradeSize: 1000,
          priceFloors: {},
          priceCeilings: {},
          blockedCounterparties: [],
          minCounterpartyReputation: 0,
        },
        reserves: { floors: {}, priorityResource: 'COMPUTE', secondaryResource: 'CHIPS' },
        risk: { tolerance: 'moderate' },
      },
    };
    agent.setMandate(mandate);
    if (agent.status === 'idle') agent.start();
  }, [onboarding.status, savedMandateText, agent]);

  const deploy = useCallback(
    async (mandateText: string) => {
      // 1. Onboard (register + approvals) — idempotent.
      const ok = await onboarding.ensureOnboarded();
      if (!ok) return;

      // 2. Set the mandate, start the worker.
      const mandate: Mandate = {
        layer1: mandateText,
        layer2: {
          trading: {
            aggressiveness: 5,
            maxSingleTradeSize: 1000,
            priceFloors: {},
            priceCeilings: {},
            blockedCounterparties: [],
            minCounterpartyReputation: 0,
          },
          reserves: { floors: {}, priorityResource: 'COMPUTE', secondaryResource: 'CHIPS' },
          risk: { tolerance: 'moderate' },
        },
      };
      agent.setMandate(mandate);
      if (agent.status === 'idle') agent.start();
      setTimeout(() => agent.tickNow(), 3_000);
    },
    [onboarding, agent],
  );

  const value = useMemo<MvpAgentContext>(
    () => ({ agent, onboarding, submittedActions, deploy }),
    [agent, onboarding, submittedActions, deploy],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMvpAgent(): MvpAgentContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useMvpAgent must be used within MvpAgentProvider');
  return ctx;
}
