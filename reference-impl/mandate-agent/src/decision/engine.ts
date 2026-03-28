/**
 * Decision engine — the LLM-powered core.
 * Receives mandate + chain state, calls LLM, produces ranked actions.
 */

import type { LLMAdapter, CompletionOptions } from "../llm/adapter.ts";
import type { ChainState } from "../chain/reader.ts";
import { assemblePrompt } from "./prompts.ts";
import { log } from "../logging/audit.ts";

export interface ProposedAction {
  readonly actionType: string;
  readonly resource: string;
  readonly quantity: number;
  readonly price: number;
  readonly rationale: string;
}

export interface DecisionResult {
  readonly actions: readonly ProposedAction[];
  readonly holdReason: string | null;
  readonly rawResponse: string;
}

interface LLMResponse {
  actions: ProposedAction[];
  holdReason: string | null;
}

const DECISION_OPTIONS: CompletionOptions = {
  maxTokens: 2048,
  temperature: 0.3,
  responseFormat: "json",
};

export class DecisionEngine {
  private readonly llm: LLMAdapter;

  constructor(llm: LLMAdapter) {
    this.llm = llm;
  }

  async decide(
    strategicIntent: string,
    constraints: Record<string, unknown>,
    state: ChainState,
    negotiationMessages: readonly string[] = [],
    marketAlerts: readonly string[] = [],
  ): Promise<DecisionResult> {
    const prompt = assemblePrompt(
      strategicIntent,
      constraints,
      state,
      negotiationMessages,
      marketAlerts,
    );

    log("debug", "Decision engine calling LLM", {
      promptLength: prompt.length,
      balances: state.balances,
    });

    const rawResponse = await this.llm.complete(prompt, DECISION_OPTIONS);

    const parsed = parseResponse(rawResponse);

    log("info", "Decision engine produced actions", {
      actionCount: parsed.actions.length,
      holdReason: parsed.holdReason,
    });

    return {
      actions: parsed.actions,
      holdReason: parsed.holdReason,
      rawResponse,
    };
  }
}

function parseResponse(raw: string): LLMResponse {
  // Extract JSON from potential markdown code blocks
  let jsonStr = raw.trim();
  const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim();
  }

  try {
    const parsed = JSON.parse(jsonStr) as LLMResponse;

    if (!Array.isArray(parsed.actions)) {
      return { actions: [], holdReason: "Failed to parse LLM response: missing actions array" };
    }

    // Validate each action has required fields
    const validActions = parsed.actions.filter(
      (a) =>
        typeof a.actionType === "string" &&
        typeof a.resource === "string" &&
        typeof a.quantity === "number" &&
        typeof a.price === "number",
    );

    return {
      actions: validActions,
      holdReason: parsed.holdReason ?? null,
    };
  } catch {
    log("warn", "Failed to parse LLM response as JSON", { raw: raw.slice(0, 500) });
    return { actions: [], holdReason: `Failed to parse LLM response` };
  }
}
