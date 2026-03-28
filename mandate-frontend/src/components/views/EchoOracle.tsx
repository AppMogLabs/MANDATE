"use client";

import { useState } from "react";
import type { EchoOracleEntry } from "@/mock/types";
import { formatTimestamp } from "@/lib/format";
import { RESOURCE_TW_COLOURS } from "@/lib/constants";

interface EchoOracleProps {
  entries: EchoOracleEntry[];
}

type SortKey = "reliabilityScore" | "lastEchoTimestamp" | "agentName";

export function EchoOracle({ entries }: EchoOracleProps) {
  const [sortKey, setSortKey] = useState<SortKey>("reliabilityScore");
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = [...entries].sort((a, b) => {
    const va = a[sortKey];
    const vb = b[sortKey];
    if (typeof va === "string" && typeof vb === "string") {
      return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    }
    return sortAsc
      ? (va as number) - (vb as number)
      : (vb as number) - (va as number);
  });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc((prev) => !prev);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const arrow = (key: SortKey) =>
    sortKey === key ? (sortAsc ? " ▲" : " ▼") : "";

  return (
    <div className="h-full flex flex-col font-dashboard">
      <div className="overflow-auto flex-1">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-surface-1">
            <tr className="text-text-tertiary uppercase tracking-wider">
              <th
                className="text-left px-3 py-2 cursor-pointer hover:text-text-secondary"
                onClick={() => toggleSort("agentName")}
              >
                Agent{arrow("agentName")}
              </th>
              <th
                className="text-right px-3 py-2 cursor-pointer hover:text-text-secondary"
                onClick={() => toggleSort("reliabilityScore")}
              >
                Reliability{arrow("reliabilityScore")}
              </th>
              <th className="text-center px-3 py-2">Direction</th>
              <th className="text-left px-3 py-2">Resource</th>
              <th
                className="text-right px-3 py-2 cursor-pointer hover:text-text-secondary"
                onClick={() => toggleSort("lastEchoTimestamp")}
              >
                Last Echo{arrow("lastEchoTimestamp")}
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((entry) => (
              <tr
                key={entry.agentName}
                className="border-t border-border-default hover:bg-surface-hover/50"
              >
                <td className="px-3 py-2 text-text-primary">
                  {entry.agentName}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-text-primary">
                  {entry.reliabilityScore}%
                </td>
                <td className="px-3 py-2 text-center">
                  <span
                    className={`text-xs font-medium ${
                      entry.direction === "BUY"
                        ? "text-status-success"
                        : entry.direction === "SELL"
                          ? "text-status-critical"
                          : "text-text-tertiary"
                    }`}
                  >
                    {entry.direction}
                  </span>
                </td>
                <td
                  className={`px-3 py-2 ${RESOURCE_TW_COLOURS[entry.resource]}`}
                >
                  {entry.resource}
                </td>
                <td className="px-3 py-2 text-right text-text-tertiary tabular-nums">
                  {formatTimestamp(entry.lastEchoTimestamp)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default EchoOracle;
