"use client";

import { useState } from "react";
import type { AgentReputation } from "@/mock/types";

interface ReputationScoresProps {
  agents: AgentReputation[];
}

type SortKey = keyof Omit<AgentReputation, "agentName">;

function bpsToPercent(bps: number): string {
  return (bps / 100).toFixed(1) + "%";
}

export function ReputationScores({ agents }: ReputationScoresProps) {
  const [sortKey, setSortKey] = useState<SortKey>("compositeScore");
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = [...agents].sort((a, b) =>
    sortAsc ? a[sortKey] - b[sortKey] : b[sortKey] - a[sortKey]
  );

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((prev) => !prev);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const arrow = (key: SortKey) =>
    sortKey === key ? (sortAsc ? " ▲" : " ▼") : "";

  const columns: { key: SortKey; label: string }[] = [
    { key: "compositeScore", label: "Score" },
    { key: "dealCompletionRate", label: "Deals" },
    { key: "disinformationScore", label: "Disinfo" },
    { key: "anomalyCount", label: "Anomalies" },
    { key: "activityScore", label: "Activity" },
  ];

  return (
    <div className="h-full flex flex-col font-dashboard">
      <div className="overflow-auto flex-1">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-surface-1">
            <tr className="text-text-tertiary uppercase tracking-wider">
              <th className="text-left px-3 py-2">Agent</th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="text-right px-2 py-2 cursor-pointer hover:text-text-secondary whitespace-nowrap"
                  onClick={() => toggleSort(col.key)}
                >
                  {col.label}
                  {arrow(col.key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((agent) => (
              <tr
                key={agent.agentName}
                className="border-t border-border-default hover:bg-surface-hover/50"
              >
                <td className="px-3 py-2 text-text-primary">
                  {agent.agentName}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-text-primary">
                  {bpsToPercent(agent.compositeScore)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-text-secondary">
                  {bpsToPercent(agent.dealCompletionRate)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-text-secondary">
                  {bpsToPercent(agent.disinformationScore)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-text-secondary">
                  {agent.anomalyCount}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-text-secondary">
                  {bpsToPercent(agent.activityScore)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ReputationScores;
