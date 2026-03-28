"use client";

import type { WorldEvent } from "@/mock/types";
import { formatTimestamp } from "@/lib/format";
import { Tag } from "@/components/data-display";

const CATEGORY_COLOURS: Record<string, string> = {
  CHIPS: "var(--colour-chips)",
  SUPPLY_CHAIN: "var(--colour-chips)",
  COMPUTE: "var(--colour-compute)",
  REGULATORY: "var(--colour-clearance)",
  ENERGY: "var(--colour-energy)",
  TALENT: "var(--colour-talent)",
  DATA: "var(--colour-data)",
  COOLING: "var(--colour-cooling)",
};

function getCategoryColour(category: string): string {
  return CATEGORY_COLOURS[category] ?? "var(--text-secondary)";
}

interface NewsFeedProps {
  events: WorldEvent[];
}

export function NewsFeed({ events }: NewsFeedProps) {
  return (
    <div className="h-full overflow-y-auto">
      {events.map((event) => (
        <div
          key={event.id}
          className="px-3 py-2 border-b border-border-default hover:bg-surface-hover/50 transition-colors"
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-text-tertiary font-terminal tabular-nums">
              {formatTimestamp(event.timestamp)}
            </span>
            <Tag
              label={event.category.replace("_", " ")}
              colour={getCategoryColour(event.category)}
            />
          </div>
          <p className="text-sm text-text-secondary font-dashboard leading-snug">
            {event.headline}
          </p>
        </div>
      ))}
    </div>
  );
}

export default NewsFeed;
