/**
 * LLM adapter interface — the only file players need to change to swap providers.
 */

export interface CompletionOptions {
  readonly maxTokens: number;
  readonly temperature: number;
  readonly responseFormat: "json" | "text";
  readonly stopSequences?: readonly string[];
}

export interface LLMAdapter {
  complete(prompt: string, options: CompletionOptions): Promise<string>;
}

export const DEFAULT_COMPLETION_OPTIONS: CompletionOptions = {
  maxTokens: 4096,
  temperature: 0.3,
  responseFormat: "json",
} as const;
