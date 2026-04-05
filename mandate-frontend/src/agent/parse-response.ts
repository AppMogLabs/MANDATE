/**
 * Parse LLM response into structured actions + sitrep.
 * Handles markdown code blocks, partial JSON, and malformed responses.
 */

import type { LLMResponse, ProposedAction } from './types';

const VALID_ACTION_TYPES = new Set([
  'ORDER_PLACE', 'ORDER_CANCEL', 'ORDER_MATCH',
  'CLAIM_PRODUCTION', 'BUILD', 'DEMOLISH',
]);

/**
 * Parse the raw LLM response string into a structured LLMResponse.
 * Returns null if the response is unparseable.
 */
export function parseLLMResponse(raw: string): LLMResponse | null {
  // Strip markdown code blocks if present
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    const lines = cleaned.split('\n');
    // Remove first line (```json or ```)
    lines.shift();
    // Remove last line (```)
    if (lines[lines.length - 1]?.trim() === '```') {
      lines.pop();
    }
    cleaned = lines.join('\n').trim();
  }

  try {
    const parsed = JSON.parse(cleaned);

    // Validate required fields
    if (!parsed || typeof parsed !== 'object') return null;
    if (!Array.isArray(parsed.actions)) return null;
    if (!parsed.sitrep || typeof parsed.sitrep !== 'object') return null;

    // Validate and filter actions
    const actions: ProposedAction[] = parsed.actions
      .filter((a: Record<string, unknown>) =>
        a && typeof a.type === 'string' && VALID_ACTION_TYPES.has(a.type),
      )
      .map((a: Record<string, unknown>) => ({
        type: a.type as ProposedAction['type'],
        params: (a.params as Record<string, unknown>) ?? {},
        reasoning: typeof a.reasoning === 'string' ? a.reasoning : '',
      }));

    return {
      actions,
      sitrep: {
        summary: parsed.sitrep.summary ?? 'No summary provided.',
        market_conditions: parsed.sitrep.market_conditions ?? '',
        alerts: Array.isArray(parsed.sitrep.alerts) ? parsed.sitrep.alerts : [],
        mandate_effectiveness: {
          actions_attempted: parsed.sitrep.mandate_effectiveness?.actions_attempted ?? actions.length,
          actions_approved: parsed.sitrep.mandate_effectiveness?.actions_approved ?? 0,
          actions_rejected: parsed.sitrep.mandate_effectiveness?.actions_rejected ?? 0,
          rejection_reasons: parsed.sitrep.mandate_effectiveness?.rejection_reasons ?? [],
        },
        confidence: parsed.sitrep.confidence ?? 'medium',
      },
    };
  } catch {
    return null;
  }
}
