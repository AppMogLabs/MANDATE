"use client";

import { useState, useCallback } from "react";

type SortDirection = "asc" | "desc";
type ColumnAlign = "left" | "center" | "right";

interface Column {
  key: string;
  label: string;
  sortable?: boolean;
  align?: ColumnAlign;
}

interface DataTableProps {
  columns: Column[];
  data: Record<string, unknown>[];
  onSort?: (key: string, direction: SortDirection) => void;
}

const ALIGN_CLASS: Record<ColumnAlign, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

function SortArrow({
  active,
  direction,
}: {
  active: boolean;
  direction: SortDirection;
}) {
  if (!active) {
    return (
      <span className="ml-1 inline-block w-3 text-text-tertiary opacity-0 group-hover:opacity-50">
        &#9650;
      </span>
    );
  }

  return (
    <span className="ml-1 inline-block w-3 text-text-secondary">
      {direction === "asc" ? "\u25B2" : "\u25BC"}
    </span>
  );
}

function DataTable({ columns, data, onSort }: DataTableProps) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>("asc");

  const handleHeaderClick = useCallback(
    (col: Column) => {
      if (!col.sortable) return;

      const nextDir: SortDirection =
        sortKey === col.key && sortDir === "asc" ? "desc" : "asc";

      setSortKey(col.key);
      setSortDir(nextDir);
      onSort?.(col.key, nextDir);
    },
    [sortKey, sortDir, onSort],
  );

  const sortedData = (() => {
    if (sortKey === null) return data;

    const sorted = [...data].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];

      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal);
      const bStr = String(bVal);
      return sortDir === "asc"
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr);
    });

    return sorted;
  })();

  return (
    <div className="overflow-x-auto font-dashboard">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-surface-1">
            {columns.map((col) => {
              const align = col.align ?? "left";
              return (
                <th
                  key={col.key}
                  className={`group h-8 whitespace-nowrap px-3 text-xs font-medium uppercase tracking-wider text-text-secondary ${ALIGN_CLASS[align]} ${
                    col.sortable
                      ? "cursor-pointer select-none hover:text-text-primary"
                      : ""
                  }`}
                  onClick={() => handleHeaderClick(col)}
                >
                  <span className="inline-flex items-center">
                    {col.label}
                    {col.sortable && (
                      <SortArrow
                        active={sortKey === col.key}
                        direction={sortKey === col.key ? sortDir : "asc"}
                      />
                    )}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sortedData.map((row, rowIdx) => (
            <tr
              key={rowIdx}
              className={`h-8 ${
                rowIdx % 2 === 0 ? "bg-surface-0" : "bg-surface-1/50"
              } hover:bg-surface-1`}
            >
              {columns.map((col) => {
                const align = col.align ?? "left";
                const cellValue = row[col.key];
                return (
                  <td
                    key={col.key}
                    className={`whitespace-nowrap px-3 tabular-nums text-text-primary ${ALIGN_CLASS[align]}`}
                  >
                    {cellValue as React.ReactNode}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export { DataTable };
export type { DataTableProps, Column, SortDirection, ColumnAlign };
