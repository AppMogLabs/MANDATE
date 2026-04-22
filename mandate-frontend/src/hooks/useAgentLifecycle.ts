'use client';

import { useState, useCallback, useRef } from 'react';
import type { LLMConfig } from '@/components/views/LLMSetup';
import type { Mandate, AgentConfig, GameState, ProposedAction } from '@/agent/types';
import { useAgentWorker } from './useAgentWorker';

interface AgentLifecycleState {
  llmConfigured: boolean;
  llmConfig: LLMConfig | null;
  mandateDeployed: boolean;
  agent: ReturnType<typeof useAgentWorker>;
  /** Actions submitted on-chain this session */
  submittedActions: readonly SubmittedAction[];
  configureLLM: (config: LLMConfig) => Promise<void>;
  deployMandate: (mandateText: string, aggressiveness: number, priorityResource: string) => void;
  updateGameState: (state: GameState) => void;
}

interface SubmittedAction {
  timestamp: number;
  description: string;
  txHash?: string;
  error?: string;
}

/**
 * Manages the full agent lifecycle:
 * 1. Player configures LLM (free tier or BYO key)
 * 2. Key is registered with the /api/llm proxy
 * 3. Player deploys a mandate
 * 4. Agent worker starts ticking
 * 5. Approved actions are submitted on-chain via /api/agent-action
 */
export function useAgentLifecycle(
  walletAddress: string,
  opts: { promptVariant?: 'full' | 'mvp' } = {},
): AgentLifecycleState {
  const [llmConfig, setLlmConfig] = useState<LLMConfig | null>(null);
  const [mandateDeployed, setMandateDeployed] = useState(false);
  const [submittedActions, setSubmittedActions] = useState<readonly SubmittedAction[]>([]);
  const sessionTokenRef = useRef<string>(`session-${Date.now()}-${Math.random().toString(36).slice(2)}`);

  // Handler for approved actions — submits them on-chain via API route
  const handleSignAndSubmit = useCallback(async (_requestId: string, action: ProposedAction) => {
    try {
      const res = await fetch('/api/agent-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionType: action.type,
          params: action.params,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSubmittedActions((prev) => [...prev, {
          timestamp: Date.now(),
          description: data.description ?? action.type,
          txHash: data.txHash,
        }]);
      } else {
        setSubmittedActions((prev) => [...prev, {
          timestamp: Date.now(),
          description: action.type,
          error: data.error ?? 'Unknown error',
        }]);
      }
    } catch (err: unknown) {
      setSubmittedActions((prev) => [...prev, {
        timestamp: Date.now(),
        description: action.type,
        error: err instanceof Error ? err.message : 'Network error',
      }]);
    }
  }, []);

  const agent = useAgentWorker(handleSignAndSubmit);

  const configureLLM = useCallback(async (config: LLMConfig) => {
    const sessionToken = sessionTokenRef.current;

    if (config.tier === 'byo' && config.apiKey) {
      await fetch('/api/llm', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionToken,
          key: config.apiKey,
          provider: config.provider,
        }),
      });
    }

    const agentConfig: AgentConfig = {
      proxyUrl: '',
      provider: config.tier === 'free' ? 'anthropic' : config.provider,
      model: config.model,
      sessionToken,
      tickIntervalMs: config.tier === 'free' ? 60_000 : 30_000,
      playerAddress: walletAddress,
      agentId: 0,
      promptVariant: opts.promptVariant ?? 'full',
    };
    agent.setConfig(agentConfig);

    setLlmConfig(config);
  }, [walletAddress, agent, opts.promptVariant]);

  const deployMandate = useCallback((
    mandateText: string,
    aggressiveness: number,
    priorityResource: string,
  ) => {
    const mandate: Mandate = {
      layer1: mandateText,
      layer2: {
        trading: {
          aggressiveness,
          maxSingleTradeSize: 1000,
          priceFloors: {},
          priceCeilings: {},
          blockedCounterparties: [],
          minCounterpartyReputation: 0,
        },
        reserves: {
          floors: {},
          priorityResource,
          secondaryResource: 'ENERGY',
        },
        risk: {
          tolerance: aggressiveness > 7 ? 'aggressive' : aggressiveness > 3 ? 'moderate' : 'conservative',
        },
      },
    };

    agent.setMandate(mandate);
    setMandateDeployed(true);

    if (agent.status === 'idle') {
      agent.start();
    }
  }, [agent]);

  return {
    llmConfigured: !!llmConfig,
    llmConfig,
    mandateDeployed,
    agent,
    submittedActions,
    configureLLM,
    deployMandate,
    updateGameState: agent.updateGameState,
  };
}
