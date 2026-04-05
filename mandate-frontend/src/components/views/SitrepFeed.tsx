"use client";

import { useState, useRef, useEffect } from "react";
import type { Sitrep, AlertSeverity } from "@/agent/types";

interface SitrepFeedProps {
  readonly sitreps: readonly Sitrep[];
  readonly agentStatus: string;
  readonly tickNumber: number;
}

const SEVERITY_STYLES: Record<AlertSeverity, { bg: string; border: string; text: string }> = {
  critical: { bg: "bg-status-critical/10", border: "border-status-critical/30", text: "text-status-critical" },
  warning: { bg: "bg-status-warning/10", border: "border-status-warning/30", text: "text-status-warning" },
  info: { bg: "bg-status-info/10", border: "border-status-info/20", text: "text-status-info" },
};

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

/**
 * SitrepFeed — The centrepiece of the dashboard (Tier 2).
 * Shows agent sitreps with expandable details, alerts, and mandate effectiveness.
 */
export function SitrepFeed({ sitreps, agentStatus, tickNumber }: SitrepFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [isHovered, setIsHovered] = useState(false);

  // Auto-scroll to latest sitrep
  useEffect(() => {
    if (!isHovered && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [sitreps.length, isHovered]);

  const toggleExpanded = (tickNum: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(tickNum)) {
        next.delete(tickNum);
      } else {
        next.add(tickNum);
      }
      return next;
    });
  };

  // Show most recent sitreps first (reversed for display)
  const displaySitreps = [...sitreps].reverse();

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-surface-1 border-b border-border-default shrink-0">
        <div className="flex items-center gap-2">
          <div
            className={[
              "w-2 h-2 rounded-full",
              agentStatus === "running" ? "bg-status-success animate-pulse" : "bg-text-tertiary",
            ].join(" ")}
          />
          <span className="text-xs font-dashboard text-text-secondary">
            Agent {agentStatus === "running" ? "Active" : agentStatus}
          </span>
        </div>
        <span className="text-xs font-dashboard text-text-tertiary">
          Tick #{tickNumber}
        </span>
      </div>

      {/* Sitrep List */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {displaySitreps.length === 0 ? (
          <div className="flex items-center justify-center h-full text-text-tertiary text-sm font-dashboard">
            {agentStatus === "idle"
              ? "Deploy a mandate to activate your agent."
              : "Waiting for first sitrep..."}
          </div>
        ) : (
          <div className="divide-y divide-border-default">
            {displaySitreps.map((sitrep) => (
              <SitrepEntry
                key={sitrep.tickNumber}
                sitrep={sitrep}
                expanded={expandedIds.has(sitrep.tickNumber)}
                onToggle={() => toggleExpanded(sitrep.tickNumber)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Hover pause indicator */}
      {isHovered && sitreps.length > 0 && (
        <div className="px-3 py-0.5 bg-surface-2 border-t border-border-default text-center">
          <span className="text-[10px] text-text-tertiary font-dashboard">PAUSED — hover to read</span>
        </div>
      )}
    </div>
  );
}

// ── Individual Sitrep Entry ───────────────────────────────────────────────────

function SitrepEntry({
  sitrep,
  expanded,
  onToggle,
}: {
  sitrep: Sitrep;
  expanded: boolean;
  onToggle: () => void;
}) {
  const hasAlerts = sitrep.alerts.length > 0;
  const hasRejections = sitrep.mandateEffectiveness.actionsRejected > 0;
  const confidenceColor = sitrep.confidence === "high"
    ? "text-status-success"
    : sitrep.confidence === "low"
      ? "text-status-warning"
      : "text-text-secondary";

  return (
    <div className="px-3 py-2 hover:bg-surface-hover/30 transition-colors">
      {/* Summary line */}
      <button
        onClick={onToggle}
        className="w-full text-left flex items-start gap-2"
      >
        <span className="text-[10px] text-text-tertiary font-dashboard shrink-0 mt-0.5 tabular-nums">
          {formatRelativeTime(sitrep.timestamp)}
        </span>
        <span className="text-xs text-text-primary font-terminal leading-relaxed flex-1">
          {sitrep.summary}
        </span>
        <span className="text-[10px] text-text-tertiary shrink-0 mt-0.5">
          {expanded ? "▼" : "▶"}
        </span>
      </button>

      {/* Alerts (always visible) */}
      {hasAlerts && (
        <div className="mt-1.5 space-y-1">
          {sitrep.alerts.map((alert, i) => {
            const style = SEVERITY_STYLES[alert.severity];
            return (
              <div
                key={i}
                className={`px-2 py-1 rounded text-[11px] font-dashboard border ${style.bg} ${style.border} ${style.text}`}
              >
                {alert.message}
                {alert.suggestedAction && (
                  <span className="text-text-tertiary ml-1">
                    — {alert.suggestedAction}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Expanded detail */}
      {expanded && (
        <div className="mt-2 space-y-2 text-xs font-dashboard">
          {/* Market conditions */}
          {sitrep.marketConditions && (
            <div className="text-text-secondary">
              <span className="text-text-tertiary">Market: </span>
              {sitrep.marketConditions}
            </div>
          )}

          {/* Mandate effectiveness */}
          <div className="flex items-center gap-3">
            <span className="text-text-tertiary">
              Actions: {sitrep.mandateEffectiveness.actionsApproved}/{sitrep.mandateEffectiveness.actionsAttempted} approved
            </span>
            {hasRejections && (
              <span className="text-status-warning">
                {sitrep.mandateEffectiveness.actionsRejected} rejected
              </span>
            )}
            <span className={`ml-auto ${confidenceColor}`}>
              Confidence: {sitrep.confidence}
            </span>
          </div>

          {/* Rejection reasons */}
          {hasRejections && sitrep.mandateEffectiveness.rejectionReasons.length > 0 && (
            <div className="text-[11px] text-status-warning/80 bg-status-warning/5 rounded px-2 py-1">
              {sitrep.mandateEffectiveness.rejectionReasons.map((r, i) => (
                <div key={i}>Guard: {r}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default SitrepFeed;
