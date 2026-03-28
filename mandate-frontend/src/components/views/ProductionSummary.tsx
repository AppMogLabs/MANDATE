"use client";

import type { ResourceBalance } from "@/mock/types";
import { RESOURCE_ORDER, RESOURCE_LABELS, RESOURCE_TW_COLOURS } from "@/lib/constants";
import { formatNumber } from "@/lib/format";

interface ProductionSummaryProps {
  resources: ResourceBalance[];
}

export function ProductionSummary({ resources }: ProductionSummaryProps) {
  const ordered = RESOURCE_ORDER.map(
    (r) => resources.find((rb) => rb.resource === r)!
  ).filter(Boolean);

  return (
    <div className="h-full overflow-y-auto p-3 font-dashboard">
      <div className="space-y-2">
        {ordered.map((rb) => {
          const net = rb.production - rb.consumption;
          return (
            <div
              key={rb.resource}
              className="flex items-center gap-3 py-1"
            >
              <span
                className={`text-xs w-8 ${RESOURCE_TW_COLOURS[rb.resource]}`}
              >
                {RESOURCE_LABELS[rb.resource]}
              </span>

              {/* Production bar */}
              <div className="flex-1">
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="text-text-tertiary">
                    +{formatNumber(rb.production)}/hr
                  </span>
                  <span className="text-text-tertiary">
                    -{formatNumber(rb.consumption)}/hr
                  </span>
                </div>
                <div className="h-1.5 bg-surface-3 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      net >= 0 ? "bg-status-success/60" : "bg-status-critical/60"
                    }`}
                    style={{
                      width: `${Math.min(100, (rb.production / Math.max(rb.production, rb.consumption)) * 100)}%`,
                    }}
                  />
                </div>
              </div>

              <span
                className={`text-xs tabular-nums w-16 text-right ${
                  net >= 0 ? "text-status-success" : "text-status-critical"
                }`}
              >
                {net >= 0 ? "+" : ""}
                {formatNumber(net)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ProductionSummary;
