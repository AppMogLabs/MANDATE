"use client";

import { formatPrice, formatPercent } from "@/lib/format";

interface PriceCellProps {
  value: number;
  change?: number;
}

function PriceCell({ value, change }: PriceCellProps) {
  const changeColour =
    change === undefined || change === 0
      ? "text-text-secondary"
      : change > 0
        ? "text-status-success"
        : "text-status-critical";

  return (
    <div className="flex flex-col items-end font-dashboard">
      <span className="tabular-nums text-text-primary">
        {formatPrice(value)}
      </span>
      {change !== undefined && (
        <span className={`tabular-nums text-xs ${changeColour}`}>
          {formatPercent(change)}
        </span>
      )}
    </div>
  );
}

export { PriceCell };
export type { PriceCellProps };
