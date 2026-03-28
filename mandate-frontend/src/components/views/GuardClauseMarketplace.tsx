"use client";

import { useState } from "react";
import type { GuardClauseTemplate } from "@/mock/types";

interface GuardClauseMarketplaceProps {
  templates: GuardClauseTemplate[];
}

type SortKey = "priceCompute" | "sellerReputation" | "activationSuccessRate";

export function GuardClauseMarketplace({
  templates,
}: GuardClauseMarketplaceProps) {
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("sellerReputation");

  const filtered = verifiedOnly
    ? templates.filter((t) => t.verified)
    : templates;

  const sorted = [...filtered].sort(
    (a, b) => b[sortKey] - a[sortKey]
  );

  return (
    <div className="h-full flex flex-col font-dashboard">
      {/* Filters */}
      <div className="flex items-center gap-3 px-3 py-2 bg-surface-1 border-b border-border-default shrink-0">
        <label className="flex items-center gap-1.5 text-xs text-text-secondary cursor-pointer">
          <input
            type="checkbox"
            checked={verifiedOnly}
            onChange={(e) => setVerifiedOnly(e.target.checked)}
            className="accent-compute"
          />
          Verified only
        </label>
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="bg-surface-2 text-text-secondary text-xs border border-border-default rounded px-2 py-1 outline-none"
        >
          <option value="sellerReputation">Reputation</option>
          <option value="priceCompute">Price</option>
          <option value="activationSuccessRate">Success Rate</option>
        </select>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-3 grid grid-cols-1 gap-2">
        {sorted.map((tpl) => (
          <div
            key={tpl.id}
            className="bg-surface-1 border border-border-default rounded p-3 space-y-2 hover:border-border-focus/50 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div>
                <h4 className="text-sm text-text-primary">{tpl.name}</h4>
                <p className="text-xs text-text-tertiary">by {tpl.seller}</p>
              </div>
              {tpl.verified ? (
                <span className="text-xs bg-status-success/15 text-status-success px-1.5 py-0.5 rounded">
                  Verified
                </span>
              ) : (
                <span className="text-xs bg-surface-3 text-text-tertiary px-1.5 py-0.5 rounded">
                  Unverified
                </span>
              )}
            </div>
            <p className="text-xs text-text-secondary leading-relaxed">
              {tpl.description}
            </p>
            <div className="flex items-center gap-4 text-xs">
              <span className="text-compute tabular-nums">
                {tpl.priceCompute} CMP
              </span>
              <span className="text-text-tertiary tabular-nums">
                Rep: {(tpl.sellerReputation / 100).toFixed(1)}%
              </span>
              <span className="text-text-tertiary tabular-nums">
                Success: {tpl.activationSuccessRate}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default GuardClauseMarketplace;
