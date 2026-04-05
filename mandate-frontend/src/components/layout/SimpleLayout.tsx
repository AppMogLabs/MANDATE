"use client";

import type { ReactNode } from "react";

interface SimpleLayoutProps {
  readonly mapSlot: ReactNode;
  readonly sitrepSlot: ReactNode;
  readonly mandateSlot: ReactNode;
  readonly hintBar: ReactNode;
}

/**
 * SimpleLayout — Three-column single-screen layout for Simple Mode.
 * No tabs, no sidebar, no ticker. Just map + sitreps + mandate editor.
 */
export function SimpleLayout({ mapSlot, sitrepSlot, mandateSlot, hintBar }: SimpleLayoutProps) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div
        className="flex-1 grid overflow-hidden"
        style={{ gridTemplateColumns: "5fr 4fr 5fr" }}
      >
        <div className="overflow-hidden border-r border-border-default">
          {mapSlot}
        </div>
        <div className="overflow-hidden border-r border-border-default">
          {sitrepSlot}
        </div>
        <div className="overflow-hidden">
          {mandateSlot}
        </div>
      </div>
      {hintBar}
    </div>
  );
}
