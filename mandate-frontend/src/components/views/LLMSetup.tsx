"use client";

import { useState } from "react";
import { Button } from "@/components/interactive/Button";
import { Input } from "@/components/interactive/Input";

interface LLMSetupProps {
  readonly onConfigured: (config: LLMConfig) => void;
  readonly isConfigured: boolean;
}

export interface LLMConfig {
  provider: "anthropic" | "openai" | "google";
  model: string;
  tier: "free" | "byo";
  apiKey?: string; // only for BYO
}

const PROVIDERS = [
  { value: "anthropic", label: "Anthropic (Claude)", models: ["claude-haiku-4-5-20251001", "claude-sonnet-4-5-20250514"] },
  { value: "openai", label: "OpenAI", models: ["gpt-4o-mini", "gpt-4o"] },
  { value: "google", label: "Google (Gemini)", models: ["gemini-2.0-flash", "gemini-2.5-pro-preview-06-05"] },
] as const;

/**
 * LLM Setup panel — player enters API key or selects free tier.
 * Rendered in the mandate editor area before the agent can be activated.
 */
export function LLMSetup({ onConfigured, isConfigured }: LLMSetupProps) {
  const [tier, setTier] = useState<"free" | "byo">("free");
  const [provider, setProvider] = useState<LLMConfig["provider"]>("anthropic");
  const [apiKey, setApiKey] = useState("");

  const selectedProvider = PROVIDERS.find((p) => p.value === provider)!;
  const model = tier === "free" ? "claude-haiku-4-5-20251001" : selectedProvider.models[0];

  const handleActivate = () => {
    onConfigured({
      provider: tier === "free" ? "anthropic" : provider,
      model,
      tier,
      apiKey: tier === "byo" ? apiKey : undefined,
    });
  };

  if (isConfigured) {
    return (
      <div className="px-3 py-2 bg-surface-1 border-b border-border-default flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-status-success" />
        <span className="text-xs text-text-secondary font-dashboard">
          Agent LLM: {tier === "free" ? "Free tier (Haiku)" : `${provider} — ${model}`}
        </span>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col items-center justify-center p-6">
      <div className="max-w-sm w-full space-y-4">
        <div className="text-center space-y-1">
          <h3 className="text-sm text-text-primary font-dashboard font-medium">
            Activate Your Agent
          </h3>
          <p className="text-xs text-text-tertiary">
            Your agent needs an AI model to think. Choose free tier or bring your own key.
          </p>
        </div>

        {/* Tier selection */}
        <div className="flex gap-1">
          <button
            onClick={() => setTier("free")}
            className={[
              "flex-1 py-2 text-xs font-dashboard rounded transition-colors",
              tier === "free"
                ? "bg-[#7CD8D5]/20 text-[#7CD8D5] border border-[#7CD8D5]/30"
                : "bg-surface-2 text-text-tertiary border border-border-default",
            ].join(" ")}
          >
            Free Tier
            <div className="text-[10px] mt-0.5 opacity-70">Claude Haiku — 60s ticks</div>
          </button>
          <button
            onClick={() => setTier("byo")}
            className={[
              "flex-1 py-2 text-xs font-dashboard rounded transition-colors",
              tier === "byo"
                ? "bg-[#7CD8D5]/20 text-[#7CD8D5] border border-[#7CD8D5]/30"
                : "bg-surface-2 text-text-tertiary border border-border-default",
            ].join(" ")}
          >
            Bring Your Key
            <div className="text-[10px] mt-0.5 opacity-70">Any provider — 30s ticks</div>
          </button>
        </div>

        {tier === "byo" && (
          <div className="space-y-3">
            {/* Provider */}
            <div className="flex gap-1">
              {PROVIDERS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setProvider(p.value as LLMConfig["provider"])}
                  className={[
                    "flex-1 py-1.5 text-[10px] font-dashboard rounded transition-colors",
                    provider === p.value
                      ? "bg-surface-hover text-text-primary border border-border-default"
                      : "text-text-tertiary hover:text-text-secondary",
                  ].join(" ")}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* API Key */}
            <Input
              value={apiKey}
              onChange={setApiKey}
              placeholder={`${selectedProvider.label} API key`}
              variant="terminal"
            />
            <p className="text-[10px] text-text-tertiary">
              Your key is stored in memory only. Never saved to disk or logged.
            </p>
          </div>
        )}

        <Button
          variant="primary"
          onClick={handleActivate}
          disabled={tier === "byo" && !apiKey}
        >
          {tier === "free" ? "Start with Free Tier" : "Activate Agent"}
        </Button>
      </div>
    </div>
  );
}
