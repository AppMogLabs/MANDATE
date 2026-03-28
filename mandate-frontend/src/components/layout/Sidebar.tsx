"use client";

import { useState, type ReactNode } from "react";
import { StatusDot } from "@/components/data-display/StatusDot";

interface SidebarProps {
  children: ReactNode;
  defaultCollapsed?: boolean;
  criticalCount?: number;
  warningCount?: number;
}

export function Sidebar({
  children,
  defaultCollapsed = false,
  criticalCount = 0,
  warningCount = 0,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  if (collapsed) {
    return (
      <aside className="w-12 bg-surface-1 border-l border-border-default flex flex-col items-center py-3 gap-2 shrink-0">
        <button
          onClick={() => setCollapsed(false)}
          className="text-text-tertiary hover:text-text-secondary transition-colors"
          aria-label="Expand sidebar"
        >
          <svg
            className="w-4 h-4"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M10 4l-4 4 4 4" />
          </svg>
        </button>
        <div className="flex flex-col items-center gap-1.5 mt-2">
          {criticalCount > 0 && <StatusDot status="critical" pulse size={8} />}
          {warningCount > 0 && <StatusDot status="warning" size={8} />}
          <StatusDot status="info" size={6} />
        </div>
        <span
          className="text-xs text-text-tertiary font-terminal mt-auto"
          style={{ writingMode: "vertical-rl" }}
        >
          AGENT FEED
        </span>
      </aside>
    );
  }

  return (
    <aside data-tour="agent-feed" className="w-80 bg-surface-1 border-l border-border-default flex flex-col shrink-0 overflow-hidden">
      <div className="flex items-center justify-between h-8 px-3 border-b border-border-default shrink-0">
        <span className="text-xs text-text-secondary font-terminal uppercase tracking-wider">
          Agent Activity
        </span>
        <button
          onClick={() => setCollapsed(true)}
          className="text-text-tertiary hover:text-text-secondary transition-colors"
          aria-label="Collapse sidebar"
        >
          <svg
            className="w-3 h-3"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M4 2l4 4-4 4" />
          </svg>
        </button>
      </div>
      <div className="flex-1 overflow-hidden">{children}</div>
    </aside>
  );
}

export default Sidebar;
