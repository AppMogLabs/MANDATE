"use client";

import type { WorldEvent } from "@/mock/types";
import { formatTimestamp } from "@/lib/format";

interface NewsTickerProps {
  events: WorldEvent[];
}

export function NewsTicker({ events }: NewsTickerProps) {
  const tickerContent = events
    .filter((e) => e.tier === "free")
    .map(
      (e) =>
        `${formatTimestamp(e.timestamp)} [${e.category}] ${e.headline}`
    )
    .join("   ·   ");

  return (
    <div className="h-8 bg-surface-0 border-t border-border-default overflow-hidden flex items-center">
      <div className="animate-ticker whitespace-nowrap font-dashboard text-xs text-text-secondary">
        <span className="inline-block pr-[100vw]">{tickerContent}</span>
        <span className="inline-block">{tickerContent}</span>
      </div>

      <style jsx>{`
        @keyframes ticker {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        .animate-ticker {
          animation: ticker 120s linear infinite;
        }
        .animate-ticker:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
}

export default NewsTicker;
