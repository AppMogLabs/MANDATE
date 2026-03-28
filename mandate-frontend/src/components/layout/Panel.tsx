"use client";

import { useState, type ReactNode } from "react";
import { StatusDot } from "@/components/data-display/StatusDot";

interface PanelProps {
  title?: string;
  children: ReactNode;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  statusIndicators?: Array<"critical" | "warning" | "info" | "success">;
  className?: string;
  minWidth?: number;
  minHeight?: number;
}

export function Panel({
  title,
  children,
  collapsible = false,
  defaultCollapsed = false,
  statusIndicators = [],
  className = "",
  minWidth = 240,
  minHeight = 160,
}: PanelProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  if (collapsed) {
    return (
      <div
        className={`bg-surface-0 border border-border-default flex items-center gap-2 h-8 px-3 cursor-pointer select-none hover:bg-surface-1 transition-colors duration-150 ${className}`}
        style={{ minWidth }}
        onClick={() => setCollapsed(false)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && setCollapsed(false)}
      >
        {title && (
          <span className="text-xs text-text-tertiary font-dashboard truncate">
            {title}
          </span>
        )}
        <div className="flex items-center gap-1 ml-auto">
          {statusIndicators.map((status, i) => (
            <StatusDot key={i} status={status} size={6} />
          ))}
        </div>
        <svg
          className="w-3 h-3 text-text-tertiary"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M4 2l4 4-4 4" />
        </svg>
      </div>
    );
  }

  return (
    <div
      className={`bg-surface-0 border border-border-default flex flex-col overflow-hidden ${className}`}
      style={{ minWidth, minHeight }}
    >
      {title && (
        <div className="flex items-center justify-between h-8 px-3 bg-surface-1 border-b border-border-default shrink-0">
          <span className="text-xs text-text-secondary font-dashboard uppercase tracking-wider">
            {title}
          </span>
          {collapsible && (
            <button
              onClick={() => setCollapsed(true)}
              className="text-text-tertiary hover:text-text-secondary transition-colors"
              aria-label="Collapse panel"
            >
              <svg
                className="w-3 h-3"
                viewBox="0 0 12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M2 6h8" />
              </svg>
            </button>
          )}
        </div>
      )}
      <div className="flex-1 overflow-auto p-4">{children}</div>
    </div>
  );
}

export default Panel;
