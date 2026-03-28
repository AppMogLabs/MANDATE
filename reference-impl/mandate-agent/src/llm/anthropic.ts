/**
 * Anthropic Claude adapter — uses the Messages API directly via fetch.
 * No SDK dependency to keep the agent lightweight.
 */

import type { LLMAdapter, CompletionOptions } from "./adapter.ts";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

export class AnthropicAdapter implements LLMAdapter {
  private readonly apiKey: string;
  private readonly model: string;

  constructor(apiKey: string, model: string = "claude-sonnet-4-20250514") {
    this.apiKey = apiKey;
    this.model = model;
  }

  async complete(prompt: string, options: CompletionOptions): Promise<string> {
    const body = {
      model: this.model,
      max_tokens: options.maxTokens,
      messages: [{ role: "user", content: prompt }],
      ...(options.temperature !== undefined && { temperature: options.temperature }),
    };

    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as {
      content: ReadonlyArray<{ type: string; text?: string }>;
    };

    const textBlock = data.content.find((block) => block.type === "text");
    if (!textBlock?.text) {
      throw new Error("No text content in Anthropic response");
    }

    return textBlock.text;
  }
}
