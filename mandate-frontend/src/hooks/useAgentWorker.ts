'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import type {
  Mandate,
  AgentConfig,
  GameState,
  Sitrep,
  AgentStatus,
  ProposedAction,
} from '@/agent/types';
import { assemblePrompt } from '@/agent/prompts';
import { assembleMvpPrompt } from '@/agent/mvp-prompts';
import { callLLMProxy } from '@/agent/llm-proxy';
import { parseLLMResponse } from '@/agent/parse-response';
import { guardValidate } from '@/agent/guard';

interface AgentWorkerState {
  status: AgentStatus;
  latestSitrep: Sitrep | null;
  sitreps: readonly Sitrep[];
  error: string | null;
  tickNumber: number;
  start: () => void;
  stop: () => void;
  tickNow: () => void;
  setMandate: (mandate: Mandate) => void;
  setConfig: (config: AgentConfig) => void;
  updateGameState: (state: GameState) => void;
}

/**
 * Agent tick loop running on the main thread.
 * For testnet with 30-60s ticks, a Web Worker isn't needed.
 * The loop runs async so it doesn't block the UI.
 */
export function useAgentWorker(
  onSignAndSubmit?: (requestId: string, action: ProposedAction) => void,
): AgentWorkerState {
  const [status, setStatus] = useState<AgentStatus>('idle');
  const [latestSitrep, setLatestSitrep] = useState<Sitrep | null>(null);
  const [sitreps, setSitreps] = useState<readonly Sitrep[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tickNumber, setTickNumber] = useState(0);

  const mandateRef = useRef<Mandate | null>(null);
  const configRef = useRef<AgentConfig | null>(null);
  const gameStateRef = useRef<GameState | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef(0);

  const addSitrep = useCallback((sitrep: Sitrep) => {
    setLatestSitrep(sitrep);
    setSitreps((prev) => [...prev, sitrep]);
  }, []);

  const executeTick = useCallback(async () => {
    const config = configRef.current;
    const mandate = mandateRef.current;
    const gameState = gameStateRef.current;

    if (!config || !mandate) {
      return;
    }

    tickRef.current++;
    const currentTick = tickRef.current;
    setTickNumber(currentTick);

    // Use a default game state if none provided
    const state: GameState = gameState ?? {
      balances: { COMPUTE: 100, ENERGY: 200, CHIPS: 50, COOLING: 50, TALENT: 30, DATA: 80, CLEARANCE: 40 },
      rateBalance: 5000,
      epochNumber: 1,
      timeRemaining: 3600,
      marketPrices: { COMPUTE: 1.2, ENERGY: 0.5, CHIPS: 2.1, COOLING: 0.8, TALENT: 3.5, DATA: 1.8, CLEARANCE: 1.0 },
    };

    try {
      // 1. Assemble prompt (MVP variant trims production/building concepts)
      const prompt = config.promptVariant === 'mvp'
        ? assembleMvpPrompt(mandate, state)
        : assemblePrompt(mandate, state);

      // 2. Call LLM
      const llmResult = await callLLMProxy(prompt, config);

      if (llmResult.error) {
        setError(`Tick ${currentTick}: ${llmResult.error}`);
        addSitrep({
          tickNumber: currentTick,
          timestamp: Date.now(),
          summary: `LLM call failed: ${llmResult.error}`,
          marketConditions: '',
          alerts: [{ severity: 'warning', message: llmResult.error }],
          mandateEffectiveness: { actionsAttempted: 0, actionsApproved: 0, actionsRejected: 0, rejectionReasons: [] },
          confidence: 'low',
        });
        return;
      }

      // 3. Parse response
      const parsed = parseLLMResponse(llmResult.content);

      if (!parsed) {
        addSitrep({
          tickNumber: currentTick,
          timestamp: Date.now(),
          summary: "Could not parse agent's response. Skipping tick.",
          marketConditions: '',
          alerts: [{ severity: 'warning', message: 'Unparseable LLM response' }],
          mandateEffectiveness: { actionsAttempted: 0, actionsApproved: 0, actionsRejected: 0, rejectionReasons: [] },
          confidence: 'low',
        });
        return;
      }

      // 4. Guard validation
      const guardResult = guardValidate(parsed.actions, mandate.layer2, state);

      // 5. Build sitrep
      const sitrep: Sitrep = {
        tickNumber: currentTick,
        timestamp: Date.now(),
        summary: parsed.sitrep.summary,
        marketConditions: parsed.sitrep.market_conditions,
        alerts: parsed.sitrep.alerts,
        mandateEffectiveness: {
          actionsAttempted: parsed.actions.length,
          actionsApproved: guardResult.approved.length,
          actionsRejected: guardResult.rejected.length,
          rejectionReasons: guardResult.rejected.map((r) => `${r.action.type}: ${r.reason}`),
        },
        confidence: parsed.sitrep.confidence,
      };

      addSitrep(sitrep);

      // 6. Submit approved actions
      for (const action of guardResult.approved) {
        const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        onSignAndSubmit?.(requestId, action);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(`Tick ${currentTick}: ${msg}`);
    }
  }, [addSitrep, onSignAndSubmit]);

  const start = useCallback(() => {
    if (intervalRef.current) return;
    const config = configRef.current;
    if (!config) {
      setError('Cannot start: no config set');
      return;
    }

    setStatus('running');
    // Execute first tick immediately
    executeTick();
    // Then at interval
    intervalRef.current = setInterval(executeTick, config.tickIntervalMs);
  }, [executeTick]);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setStatus('idle');
  }, []);

  const tickNow = useCallback(() => {
    executeTick();
  }, [executeTick]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    status,
    latestSitrep,
    sitreps,
    error,
    tickNumber,
    start,
    stop,
    tickNow,
    setMandate: useCallback((mandate: Mandate) => { mandateRef.current = mandate; }, []),
    setConfig: useCallback((config: AgentConfig) => { configRef.current = config; }, []),
    updateGameState: useCallback((state: GameState) => { gameStateRef.current = state; }, []),
  };
}
