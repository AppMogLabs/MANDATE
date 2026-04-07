"use client";

import { useState } from "react";
import type { AgentFeedEntry } from "@/mock/types";
import { formatTimestamp } from "@/lib/format";
import { NOTIFICATION_TIERS } from "@/lib/constants";
import { Tag } from "@/components/data-display";

const ACTION_KEYWORD_COLOURS: Record<string, string> = {
  TRADE: "var(--text-secondary)",
  NEGOTIATE: "var(--colour-clearance)",
  GUARD_CLAUSE: "var(--status-warning)",
  ECHO_SIGNAL: "var(--colour-talent)",
  LINEAGE_CHECK: "var(--colour-data)",
  MANDATE_EXEC: "var(--colour-compute)",
  ORACLE_READ: "var(--colour-cooling)",
  REPUTATION: "var(--colour-energy)",
};

const ACTION_KEYWORDS = Object.keys(ACTION_KEYWORD_COLOURS);

function parseActionKeyword(action: string): string | null {
  for (const keyword of ACTION_KEYWORDS) {
    if (action === keyword || action.startsWith(`${keyword} `) || action.startsWith(`${keyword}:`)) {
      return keyword;
    }
  }
  return null;
}

interface FeedEntryProps {
  entry: AgentFeedEntry;
}

export function FeedEntry({ entry }: FeedEntryProps) {
  const [expanded, setExpanded] = useState(false);
  const tier = NOTIFICATION_TIERS[entry.tier];
  const actionKeyword = parseActionKeyword(entry.action);

  const borderStyles: React.CSSProperties = {
    borderLeftWidth: tier.borderWidth,
    borderLeftStyle: "solid",
    borderLeftColor: tier.colour,
  };

  return (
    <div
      className="px-3 py-1.5 cursor-pointer hover:bg-surface-hover/50 transition-colors duration-100"
      style={borderStyles}
      onClick={() => setExpanded((prev) => !prev)}
    >
      <div className="flex items-baseline gap-2 font-terminal text-xs leading-tight">
        <span className="text-text-tertiary tabular-nums shrink-0">
          {formatTimestamp(entry.timestamp)}
        </span>
        <span className="text-text-primary shrink-0">{entry.agentName}</span>
        {actionKeyword ? (
          <span className="flex items-baseline gap-1.5 truncate">
            <Tag label={actionKeyword} colour={ACTION_KEYWORD_COLOURS[actionKeyword]} />
            <span className="text-text-secondary truncate">{entry.detail || entry.action}</span>
          </span>
        ) : (
          <span className="text-text-primary truncate">{entry.detail || entry.action}</span>
        )}
      </div>

      {expanded && (
        <div className="mt-1.5 pl-[4.5rem] font-terminal text-xs text-text-secondary leading-relaxed">
          <p>{entry.detail}</p>
          {entry.mandateClause && (
            <p className="mt-1 text-text-tertiary">
              Clause: {entry.mandateClause}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default FeedEntry;
