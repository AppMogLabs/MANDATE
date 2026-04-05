/**
 * MANDATE Agent Web Worker — runs the OODA tick loop in a dedicated thread.
 *
 * Communication with main thread via postMessage:
 *   IN:  SET_MANDATE, SET_CONFIG, UPDATE_GAME_STATE, START, STOP, TICK_NOW, SIGN_RESULT
 *   OUT: SITREP, SIGN_AND_SUBMIT, STORE_SITREP, STATUS, ERROR, TICK_COMPLETE
 */

import type {
  WorkerInMessage, WorkerOutMessage,
  Mandate, AgentConfig, GameState, Sitrep, AgentStatus,
} from './types';
import { assemblePrompt } from './prompts';
import { callLLMProxy } from './llm-proxy';
import { parseLLMResponse } from './parse-response';
import { guardValidate } from './guard';

// ── State ─────────────────────────────────────────────────────────────────────

let mandate: Mandate | null = null;
let config: AgentConfig | null = null;
let gameState: GameState | null = null;
let tickInterval: ReturnType<typeof setInterval> | null = null;
let tickNumber = 0;
let status: AgentStatus = 'idle';

// Pending signature requests
const pendingSignatures = new Map<string, {
  resolve: (txHash: string | null) => void;
}>();

// ── Message Handler ───────────────────────────────────────────────────────────

self.onmessage = (event: MessageEvent<WorkerInMessage>) => {
  const msg = event.data;

  switch (msg.type) {
    case 'SET_MANDATE':
      mandate = msg.mandate;
      break;

    case 'SET_CONFIG':
      config = msg.config;
      break;

    case 'UPDATE_GAME_STATE':
      gameState = msg.state;
      break;

    case 'START':
      startLoop();
      break;

    case 'STOP':
      stopLoop();
      break;

    case 'TICK_NOW':
      executeTick();
      break;

    case 'SIGN_RESULT': {
      const pending = pendingSignatures.get(msg.requestId);
      if (pending) {
        pending.resolve(msg.txHash);
        pendingSignatures.delete(msg.requestId);
      }
      break;
    }
  }
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function emit(msg: WorkerOutMessage): void {
  self.postMessage(msg);
}

function setStatus(s: AgentStatus): void {
  status = s;
  emit({ type: 'STATUS', status: s });
}

function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── Tick Loop ─────────────────────────────────────────────────────────────────

function startLoop(): void {
  if (tickInterval) return;
  if (!config) {
    emit({ type: 'ERROR', error: 'Cannot start: no config set' });
    return;
  }

  setStatus('running');
  // Execute first tick immediately, then at interval
  executeTick();
  tickInterval = setInterval(executeTick, config.tickIntervalMs);
}

function stopLoop(): void {
  if (tickInterval) {
    clearInterval(tickInterval);
    tickInterval = null;
  }
  setStatus('idle');
}

// ── Core Tick ─────────────────────────────────────────────────────────────────

async function executeTick(): Promise<void> {
  if (!config || !mandate || !gameState) {
    emit({ type: 'ERROR', error: 'Tick skipped: missing config, mandate, or game state' });
    return;
  }

  tickNumber++;
  const currentTick = tickNumber;

  try {
    // 1. OBSERVE + ORIENT — Assemble prompt from mandate + game state
    const prompt = assemblePrompt(mandate, gameState);

    // 2. DECIDE — Call LLM via proxy
    const llmResult = await callLLMProxy(prompt, config);

    if (llmResult.error) {
      emit({ type: 'ERROR', error: `Tick ${currentTick}: ${llmResult.error}` });
      emitSkippedSitrep(currentTick, `LLM call failed: ${llmResult.error}`);
      return;
    }

    // 3. Parse response
    const parsed = parseLLMResponse(llmResult.content);

    if (!parsed) {
      emit({ type: 'ERROR', error: `Tick ${currentTick}: Could not parse LLM response` });
      emitSkippedSitrep(currentTick, "Couldn't understand LLM response.");
      return;
    }

    // 4. ACT — Guard validation
    const guardResult = guardValidate(parsed.actions, mandate.layer2, gameState);

    // 5. Submit approved actions via signing bridge
    for (const action of guardResult.approved) {
      const requestId = generateRequestId();
      emit({ type: 'SIGN_AND_SUBMIT', requestId, action });
      // Don't await signature for now — fire and forget
      // The main thread will handle signing and submission
    }

    // 6. Build and emit sitrep
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

    emit({ type: 'SITREP', sitrep });
    emit({ type: 'STORE_SITREP', sitrep });
    emit({ type: 'TICK_COMPLETE', tickNumber: currentTick });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    emit({ type: 'ERROR', error: `Tick ${currentTick} failed: ${msg}` });
    emitSkippedSitrep(currentTick, `Agent error: ${msg}`);
  }
}

function emitSkippedSitrep(tick: number, reason: string): void {
  const sitrep: Sitrep = {
    tickNumber: tick,
    timestamp: Date.now(),
    summary: reason,
    marketConditions: '',
    alerts: [{ severity: 'warning', message: reason }],
    mandateEffectiveness: {
      actionsAttempted: 0,
      actionsApproved: 0,
      actionsRejected: 0,
      rejectionReasons: [],
    },
    confidence: 'low',
  };
  emit({ type: 'SITREP', sitrep });
  emit({ type: 'STORE_SITREP', sitrep });
}
