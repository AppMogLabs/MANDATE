import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/llm — Thin LLM proxy.
 *
 * Accepts: { sessionToken, provider, model, messages, maxTokens?, temperature? }
 * Routes to the appropriate provider API with the stored API key.
 *
 * Keys are stored in volatile memory only (Map with TTL).
 * No disk, no database, no logs.
 */

// In-memory API key store: sessionToken -> { key, provider, expires }
const sessionKeys = new Map<string, { key: string; provider: string; expires: number }>();

// Free tier shared key (Anthropic Haiku)
const FREE_TIER_KEY = process.env.MANDATE_FREE_TIER_API_KEY;

// Rate limiting: sessionToken -> last request timestamp
const rateLimits = new Map<string, number>();
const RATE_LIMIT_MS = 25_000; // 25 seconds (allows 30-second tick cycle with margin)
const FREE_TIER_RATE_LIMIT_MS = 55_000; // 55 seconds for free tier

// Provider API URLs
const PROVIDER_URLS: Record<string, string> = {
  anthropic: 'https://api.anthropic.com/v1/messages',
  openai: 'https://api.openai.com/v1/chat/completions',
  google: 'https://generativelanguage.googleapis.com/v1beta/models',
};

// ── Register Key ──────────────────────────────────────────────────────────────

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { sessionToken, key, provider } = body as {
    sessionToken: string;
    key: string;
    provider: string;
  };

  if (!sessionToken || !key || !provider) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  // Store key with 24-hour TTL
  sessionKeys.set(sessionToken, {
    key,
    provider,
    expires: Date.now() + 24 * 60 * 60 * 1000,
  });

  return NextResponse.json({ success: true });
}

// ── LLM Call ──────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const {
    sessionToken,
    provider,
    model,
    messages,
    maxTokens = 2048,
    temperature = 0.3,
  } = body as {
    sessionToken: string;
    provider: string;
    model: string;
    messages: Array<{ role: string; content: string }>;
    maxTokens?: number;
    temperature?: number;
  };

  if (!sessionToken || !provider || !model || !messages) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Look up API key
  const session = sessionKeys.get(sessionToken);
  let apiKey: string | undefined;
  let isFreeTier = false;

  if (session && session.expires > Date.now()) {
    apiKey = session.key;
  } else if (FREE_TIER_KEY) {
    apiKey = FREE_TIER_KEY;
    isFreeTier = true;
  } else {
    return NextResponse.json({ error: 'No API key registered for this session' }, { status: 401 });
  }

  // Rate limiting
  const rateLimit = isFreeTier ? FREE_TIER_RATE_LIMIT_MS : RATE_LIMIT_MS;
  const lastRequest = rateLimits.get(sessionToken) ?? 0;
  if (Date.now() - lastRequest < rateLimit) {
    return NextResponse.json(
      { error: `Rate limited. Wait ${Math.ceil((rateLimit - (Date.now() - lastRequest)) / 1000)}s.` },
      { status: 429 },
    );
  }
  rateLimits.set(sessionToken, Date.now());

  // Evict expired sessions periodically
  if (Math.random() < 0.01) evictExpired();

  // Route to provider
  try {
    const response = await routeToProvider(provider, model, messages, apiKey, maxTokens, temperature);
    return NextResponse.json(response);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Provider error';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

// ── Provider Routing ──────────────────────────────────────────────────────────

async function routeToProvider(
  provider: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  apiKey: string,
  maxTokens: number,
  temperature: number,
): Promise<unknown> {
  switch (provider) {
    case 'anthropic':
      return callAnthropic(model, messages, apiKey, maxTokens, temperature);
    case 'openai':
      return callOpenAI(model, messages, apiKey, maxTokens, temperature);
    case 'google':
      return callGoogle(model, messages, apiKey, maxTokens, temperature);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

async function callAnthropic(
  model: string,
  messages: Array<{ role: string; content: string }>,
  apiKey: string,
  maxTokens: number,
  temperature: number,
): Promise<unknown> {
  const res = await fetch(PROVIDER_URLS.anthropic, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic ${res.status}: ${text}`);
  }

  return res.json();
}

async function callOpenAI(
  model: string,
  messages: Array<{ role: string; content: string }>,
  apiKey: string,
  maxTokens: number,
  temperature: number,
): Promise<unknown> {
  const res = await fetch(PROVIDER_URLS.openai, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI ${res.status}: ${text}`);
  }

  return res.json();
}

async function callGoogle(
  model: string,
  messages: Array<{ role: string; content: string }>,
  apiKey: string,
  maxTokens: number,
  temperature: number,
): Promise<unknown> {
  const url = `${PROVIDER_URLS.google}/${model}:generateContent?key=${apiKey}`;
  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      generationConfig: { maxOutputTokens: maxTokens, temperature },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google ${res.status}: ${text}`);
  }

  return res.json();
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

function evictExpired(): void {
  const now = Date.now();
  for (const [token, session] of sessionKeys) {
    if (session.expires < now) {
      sessionKeys.delete(token);
      rateLimits.delete(token);
    }
  }
}
