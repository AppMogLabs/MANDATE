import type { Mandate, ResourceName } from "./types.js";

function renderResourceBudgets(budgets: Partial<Record<ResourceName, number>> | undefined): string {
  if (!budgets || Object.keys(budgets).length === 0) {
    return "Not configured";
  }
  return Object.entries(budgets)
    .map(([resource, amount]) => `${resource}: max ${amount} RATE`)
    .join(", ");
}

function renderPriceThresholds(
  thresholds: Partial<Record<ResourceName, { maxBuy: number; minSell: number }>> | undefined
): string {
  if (!thresholds || Object.keys(thresholds).length === 0) {
    return "Not configured";
  }
  return Object.entries(thresholds)
    .map(([resource, t]) => `${resource}: buy up to ${t.maxBuy} RATE/unit, sell above ${t.minSell} RATE/unit`)
    .join(". ");
}

function renderCounterpartyRules(
  prefs: { prefer?: number[]; avoid?: number[]; block?: number[] } | undefined
): string {
  if (!prefs) {
    return "Not configured";
  }
  const parts: string[] = [];
  if (prefs.prefer && prefs.prefer.length > 0) {
    parts.push(`Prefer agents ${prefs.prefer.join(", ")}`);
  }
  if (prefs.avoid && prefs.avoid.length > 0) {
    parts.push(`Avoid agent${prefs.avoid.length > 1 ? "s" : ""} ${prefs.avoid.join(", ")}`);
  }
  if (prefs.block && prefs.block.length > 0) {
    parts.push(`Block agent${prefs.block.length > 1 ? "s" : ""} ${prefs.block.join(", ")}`);
  }
  return parts.length > 0 ? parts.join(". ") + "." : "Not configured";
}

function renderRiskLimits(
  limits: { maxResourceConcentration?: number; maxDealExposure?: number; maxOpenNegotiations?: number } | undefined
): string {
  if (!limits) {
    return "Not configured";
  }
  const parts: string[] = [];
  if (limits.maxResourceConcentration !== undefined) {
    parts.push(`Max resource concentration: ${limits.maxResourceConcentration}%`);
  }
  if (limits.maxDealExposure !== undefined) {
    parts.push(`Max deal exposure: ${limits.maxDealExposure} RATE`);
  }
  if (limits.maxOpenNegotiations !== undefined) {
    parts.push(`Max open negotiations: ${limits.maxOpenNegotiations}`);
  }
  return parts.length > 0 ? parts.join(". ") + "." : "Not configured";
}

function renderTimeHorizon(
  horizon: { type: "epoch" | "duration" | "indefinite"; value?: number } | undefined
): string {
  if (!horizon) {
    return "Not configured";
  }
  switch (horizon.type) {
    case "epoch":
      return "Current epoch";
    case "duration": {
      const seconds = horizon.value ?? 0;
      const hours = Math.floor(seconds / 3600);
      const remainderMinutes = Math.floor((seconds % 3600) / 60);
      const parts: string[] = [];
      if (hours > 0) parts.push(`${hours} hour${hours > 1 ? "s" : ""}`);
      if (remainderMinutes > 0) parts.push(`${remainderMinutes} minute${remainderMinutes > 1 ? "s" : ""}`);
      const humanReadable = parts.length > 0 ? parts.join(" ") : "0 seconds";
      return `${seconds} seconds (${humanReadable})`;
    }
    case "indefinite":
      return "Indefinite";
  }
}

function renderTacticalDirectives(
  directives: Array<{ condition: string; action: string; priority: "low" | "medium" | "high" }> | undefined
): string {
  if (!directives || directives.length === 0) {
    return "None configured.";
  }
  return directives
    .map((d, i) => `${i + 1}. [${d.priority.toUpperCase()}] If ${d.condition}: ${d.action}`)
    .join("\n");
}

export function renderZone2(mandate: Mandate): string {
  const lines = [
    "=== MANDATE (PRIVILEGED — set by your owner) ===",
    "",
    "STRATEGIC INTENT:",
    mandate.strategicIntent,
    "",
    "OPERATIONAL CONSTRAINTS (enforced by guard — do not violate):",
    `- Resource budgets: ${renderResourceBudgets(mandate.resourceBudgets)}`,
    `- Price thresholds: ${renderPriceThresholds(mandate.priceThresholds)}`,
    `- Counterparty rules: ${renderCounterpartyRules(mandate.counterpartyPreferences)}`,
    `- Risk limits: ${renderRiskLimits(mandate.riskLimits)}`,
    `- Time horizon: ${renderTimeHorizon(mandate.timeHorizon)}`,
    "",
    "TACTICAL DIRECTIVES (guide your reasoning, not enforced by guard):",
    renderTacticalDirectives(mandate.tacticalDirectives),
    "",
    "=== END MANDATE ===",
  ];
  return lines.join("\n");
}
