'use client';

import type { AgentStatus, Sitrep } from '@/agent/types';

interface HintInput {
  agentStatus: AgentStatus;
  sitreps: readonly Sitrep[];
  hasMandateText: boolean;
  epochTimeRemainingPct: number; // 0-100
}

/**
 * Derives contextual guidance for the player based on game state.
 * Returns the highest-priority hint.
 */
export function useSimpleModeHints({
  agentStatus,
  sitreps,
  hasMandateText,
  epochTimeRemainingPct,
}: HintInput): string {
  if (!hasMandateText) {
    return "Write your mandate below. Tell your agent what resources to prioritize, what to trade, and how aggressive to be.";
  }

  if (agentStatus === "idle") {
    return "Your agent is waiting. Submit your mandate to activate it.";
  }

  if (agentStatus === "error") {
    return "Something went wrong with your agent. Check the sitrep feed for details.";
  }

  if (agentStatus === "running" && sitreps.length === 0) {
    return "Your agent is starting up. Watch the sitrep feed for its first report.";
  }

  const latest = sitreps[sitreps.length - 1];
  if (latest) {
    if (latest.mandateEffectiveness.actionsRejected > 0) {
      return "Your agent's guard rejected some actions. Your mandate constraints might be too tight — try loosening them.";
    }
    if (latest.confidence === "low") {
      return "Your agent has low confidence. Try being more specific about what you want in your mandate.";
    }
  }

  if (epochTimeRemainingPct < 20) {
    return "Epoch ending soon. Review your sitreps and consider adjusting your strategy.";
  }

  return "Your agent is working. Read sitreps on the left, adjust your mandate on the right if needed.";
}
