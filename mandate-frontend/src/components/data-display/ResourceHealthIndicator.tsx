"use client";

import type { ResourceBalance } from "@/mock/types";

interface ResourceHealthIndicatorProps {
  readonly resources: ResourceBalance[];
  readonly rateBalance: number;
}

type HealthLevel = "healthy" | "warning" | "critical";

function computeHealth(resources: ResourceBalance[], rateBalance: number): HealthLevel {
  if (rateBalance <= 0) return "critical";

  let warningCount = 0;
  for (const r of resources) {
    const bal = typeof r.balance === 'string' ? parseFloat(r.balance) : r.balance;
    if (bal <= 0) return "critical";
    if (bal < 10 || r.change1h < -10) warningCount++;
  }

  return warningCount >= 2 ? "warning" : warningCount === 1 ? "warning" : "healthy";
}

const HEALTH_CONFIG: Record<HealthLevel, { color: string; label: string }> = {
  healthy: { color: "bg-status-success", label: "Resources stable" },
  warning: { color: "bg-status-warning", label: "Resources at risk" },
  critical: { color: "bg-status-critical", label: "Resources critical" },
};

/**
 * Aggregates 7 resource balances into a single health indicator.
 */
export function ResourceHealthIndicator({ resources, rateBalance }: ResourceHealthIndicatorProps) {
  const level = computeHealth(resources, rateBalance);
  const { color, label } = HEALTH_CONFIG[level];

  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-2 h-2 rounded-full ${color} ${level === "critical" ? "animate-pulse" : ""}`} />
      <span className="text-xs text-text-secondary font-dashboard">{label}</span>
    </div>
  );
}
