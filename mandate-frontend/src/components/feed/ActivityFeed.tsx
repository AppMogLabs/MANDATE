"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import type { AgentFeedEntry } from "@/mock/types";
import { FeedEntry } from "./FeedEntry";

interface ActivityFeedProps {
  entries: AgentFeedEntry[];
}

interface BatchedEntry {
  entries: AgentFeedEntry[];
  summary?: string;
}

function batchEntries(entries: AgentFeedEntry[]): BatchedEntry[] {
  const batched: BatchedEntry[] = [];
  let current: AgentFeedEntry[] = [];

  for (const entry of entries) {
    if (
      current.length > 0 &&
      current[0].agentName === entry.agentName &&
      entry.timestamp - current[current.length - 1].timestamp < 5000
    ) {
      current.push(entry);
    } else {
      if (current.length > 0) {
        batched.push(
          current.length > 2
            ? {
                entries: current,
                summary: `${current[0].agentName} completed ${current.length} actions`,
              }
            : { entries: current }
        );
      }
      current = [entry];
    }
  }

  if (current.length > 0) {
    batched.push(
      current.length > 2
        ? {
            entries: current,
            summary: `${current[0].agentName} completed ${current.length} actions`,
          }
        : { entries: current }
    );
  }

  return batched;
}

export function ActivityFeed({ entries }: ActivityFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const [expandedBatch, setExpandedBatch] = useState<number | null>(null);

  // Reverse so newest entries appear at top
  const batched = batchEntries(entries).reverse();

  // Auto-scroll to top unless paused
  useEffect(() => {
    if (!paused && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [entries.length, paused]);

  const handleMouseEnter = useCallback(() => setPaused(true), []);
  const handleMouseLeave = useCallback(() => setPaused(false), []);

  return (
    <div
      ref={scrollRef}
      className="h-full overflow-y-auto"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {paused && (
        <div className="sticky top-0 z-10 bg-surface-2/90 text-center py-0.5">
          <span className="text-xs text-text-tertiary font-terminal">
            PAUSED
          </span>
        </div>
      )}

      {batched.map((batch, i) =>
        batch.summary ? (
          <div key={i}>
            <div
              className="px-3 py-1.5 text-xs font-terminal text-text-tertiary cursor-pointer hover:bg-surface-hover/50 border-l border-text-tertiary"
              onClick={() =>
                setExpandedBatch(expandedBatch === i ? null : i)
              }
            >
              {batch.summary}{" "}
              <span className="text-text-tertiary">
                {expandedBatch === i ? "▾" : "▸"}
              </span>
            </div>
            {expandedBatch === i &&
              batch.entries.map((entry) => (
                <FeedEntry key={entry.id} entry={entry} />
              ))}
          </div>
        ) : (
          batch.entries.map((entry) => (
            <FeedEntry key={entry.id} entry={entry} />
          ))
        )
      )}
    </div>
  );
}

export default ActivityFeed;
