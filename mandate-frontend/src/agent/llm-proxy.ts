/**
 * LLM Proxy Adapter — routes all LLM calls through the proxy endpoint.
 * The proxy attaches API keys from session memory.
 */

import type { AgentConfig } from './types';

export interface LLMCallResult {
  readonly content: string;
  readonly error?: string;
}

/**
 * Call the LLM via the proxy endpoint.
 * The proxy handles API key attachment and provider routing.
 */
export async function callLLMProxy(
  prompt: string,
  config: AgentConfig,
): Promise<LLMCallResult> {
  const { proxyUrl, provider, model, sessionToken } = config;

  try {
    const response = await fetch(`${proxyUrl}/api/llm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionToken,
        provider,
        model,
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 2048,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { content: '', error: `LLM proxy error (${response.status}): ${errorText}` };
    }

    const data = await response.json();

    // Handle different provider response formats
    const content = extractContent(data, provider);
    if (!content) {
      return { content: '', error: 'Empty response from LLM' };
    }

    return { content };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Network error';
    return { content: '', error: `LLM call failed: ${msg}` };
  }
}

function extractContent(data: unknown, provider: string): string | null {
  const d = data as Record<string, unknown>;

  switch (provider) {
    case 'anthropic': {
      // Anthropic: { content: [{ type: "text", text: "..." }] }
      const content = d.content as Array<{ type: string; text: string }> | undefined;
      return content?.[0]?.text ?? null;
    }
    case 'openai': {
      // OpenAI: { choices: [{ message: { content: "..." } }] }
      const choices = d.choices as Array<{ message: { content: string } }> | undefined;
      return choices?.[0]?.message?.content ?? null;
    }
    case 'google': {
      // Gemini: { candidates: [{ content: { parts: [{ text: "..." }] } }] }
      const candidates = d.candidates as Array<{ content: { parts: Array<{ text: string }> } }> | undefined;
      return candidates?.[0]?.content?.parts?.[0]?.text ?? null;
    }
    default:
      // Try to extract from common patterns
      if (typeof d.content === 'string') return d.content;
      if (typeof d.text === 'string') return d.text;
      return JSON.stringify(data);
  }
}
