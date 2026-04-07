"use client";

import type { AgentFeedEntry } from "@/mock/types";
import { formatTimestamp } from "@/lib/format";

interface TradeHistoryProps {
  entries: AgentFeedEntry[];
}

export function TradeHistory({ entries }: TradeHistoryProps) {
  // Filter to trade-like entries
  const trades = entries.filter(
    (e) =>
      e.action.toLowerCase().includes("trade") ||
      e.action.toLowerCase().includes("purchase") ||
      e.action.toLowerCase().includes("sold") ||
      e.action.toLowerCase().includes("executed")
  );

  return (
    <div className="h-full overflow-y-auto font-terminal text-xs">
      {trades.length === 0 ? (
        <div className="flex items-center justify-center h-full text-text-tertiary">
          No recent trades
        </div>
      ) : (
        trades.map((entry) => (
          <div
            key={entry.id}
            className="flex items-center gap-2 px-3 py-1.5 border-b border-border-default hover:bg-surface-hover/50"
          >
            <span className="text-text-tertiary tabular-nums shrink-0">
              {formatTimestamp(entry.timestamp)}
            </span>
            <span className="text-text-secondary shrink-0">
              {entry.agentName}
            </span>
            <span className="text-text-primary truncate">{entry.detail || entry.action}</span>
          </div>
        ))
      )}
    </div>
  );
}

export default TradeHistory;
