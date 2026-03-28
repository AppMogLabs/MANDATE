/**
 * OpenAI adapter — uses the Chat Completions API directly via fetch.
 * No SDK dependency to keep the agent lightweight.
 */

import type { LLMAdapter, CompletionOptions } from "./adapter.ts";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

export class OpenAIAdapter implements LLMAdapter {
  private readonly apiKey: string;
  private readonly model: string;

  constructor(apiKey: string, model: string = "gpt-4o") {
    this.apiKey = apiKey;
    this.model = model;
  }

  async complete(prompt: string, options: CompletionOptions): Promise<string> {
    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: options.maxTokens,
      temperature: options.temperature,
      messages: [{ role: "user", content: prompt }],
    };

    if (options.responseFormat === "json") {
      body.response_format = { type: "json_object" };
    }

    if (options.stopSequences && options.stopSequences.length > 0) {
      body.stop = options.stopSequences;
    }

    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as {
      choices: ReadonlyArray<{ message: { content: string | null } }>;
    };

    const content = data.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No content in OpenAI response");
    }

    return content;
  }
}
