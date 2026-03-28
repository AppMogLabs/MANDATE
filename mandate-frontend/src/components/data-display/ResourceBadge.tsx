"use client";

import type { ResourceType } from "@/mock/types";
import {
  RESOURCE_LABELS,
  RESOURCE_TW_COLOURS,
  RESOURCE_BG_COLOURS,
} from "@/lib/constants";
import { formatNumber, formatPercent } from "@/lib/format";
import { Sparkline } from "./Sparkline";

interface ResourceBadgeProps {
  resource: ResourceType;
  balance: number;
  change: number;
  sparkline: number[];
  compact?: boolean;
}

function ResourceBadge({
  resource,
  balance,
  change,
  sparkline,
  compact = false,
}: ResourceBadgeProps) {
  const twColour = RESOURCE_TW_COLOURS[resource];
  const bgColour = RESOURCE_BG_COLOURS[resource];
  const label = RESOURCE_LABELS[resource];

  const changeColour =
    change > 0
      ? "text-status-success"
      : change < 0
        ? "text-status-critical"
        : "text-text-secondary";

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 font-dashboard text-xs ${bgColour}`}
      >
        <span className={`inline-block h-2 w-2 rounded-full bg-current ${twColour}`} />
        <span className={`font-medium ${twColour}`}>{label}</span>
        <span className="tabular-nums text-text-primary">
          {formatNumber(balance)}
        </span>
      </span>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 font-dashboard text-sm ${bgColour}`}
    >
      <span className={`inline-block h-2.5 w-2.5 rounded-full bg-current ${twColour}`} />
      <span className={`font-medium ${twColour}`}>{label}</span>
      <span className="tabular-nums text-text-primary">
        {formatNumber(balance)}
      </span>
      <span className={`tabular-nums text-xs ${changeColour}`}>
        {formatPercent(change)}
      </span>
      <Sparkline data={sparkline} width={48} height={16} />
    </div>
  );
}

export { ResourceBadge };
export type { ResourceBadgeProps };
