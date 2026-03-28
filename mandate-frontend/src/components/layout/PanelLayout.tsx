"use client";

import { type ReactNode } from "react";
import type { PanelConfig } from "@/hooks/usePanelLayout";

interface PanelLayoutProps {
  panels: PanelConfig[];
  renderPanel: (config: PanelConfig) => ReactNode;
  className?: string;
}

export function PanelLayout({
  panels,
  renderPanel,
  className = "",
}: PanelLayoutProps) {
  // Compute grid dimensions from panels
  const maxRow = Math.max(...panels.map((p) => p.row + p.rowSpan));
  const maxCol = Math.max(...panels.map((p) => p.col + p.colSpan));

  return (
    <div
      className={`grid gap-0 flex-1 overflow-hidden ${className}`}
      style={{
        gridTemplateRows: `repeat(${maxRow}, 1fr)`,
        gridTemplateColumns: `repeat(${maxCol}, 1fr)`,
      }}
    >
      {panels.map((config) => (
        <div
          key={config.id}
          className="overflow-hidden border border-border-default"
          style={{
            gridRow: `${config.row + 1} / span ${config.rowSpan}`,
            gridColumn: `${config.col + 1} / span ${config.colSpan}`,
          }}
        >
          {renderPanel(config)}
        </div>
      ))}
    </div>
  );
}

export default PanelLayout;
