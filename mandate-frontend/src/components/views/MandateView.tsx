"use client";

import type { PlayerState } from "@/mock/types";

interface MandateViewProps {
  player: PlayerState;
}

export function MandateView({ player }: MandateViewProps) {
  const {
    currentMandate = "",
    mandateClarityScore = 0,
    mandateConstraintCount = 0,
    mandateLastUpdated = "—",
    agentConfidence = "Medium",
    agentName,
  } = player;

  const confidenceColour = {
    High: "text-status-success",
    Medium: "text-status-warning",
    Low: "text-status-critical",
  }[agentConfidence];

  const clarityPercent = Math.min(100, Math.max(0, mandateClarityScore));

  return (
    <div className="h-full flex overflow-hidden">
      {/* Left: Mandate Editor Area */}
      <div className="flex-[2] flex flex-col border-r border-border-default overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-surface-1 border-b border-border-default shrink-0">
          <div>
            <h2 className="text-sm text-text-primary font-dashboard uppercase tracking-wider">
              Active Mandate
            </h2>
            <p className="text-xs text-text-tertiary font-dashboard mt-0.5">
              Last updated: {mandateLastUpdated}
            </p>
          </div>

          {/* Clarity Score */}
          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-xs text-text-tertiary font-dashboard block">
                Mandate Clarity
              </span>
              <span className="text-lg text-text-primary font-dashboard tabular-nums">
                {mandateClarityScore}
                <span className="text-text-tertiary text-sm">/100</span>
              </span>
            </div>
            <div className="w-24 h-2 bg-surface-3 rounded-full overflow-hidden">
              <div
                className="h-full bg-compute rounded-full transition-all duration-300"
                style={{ width: `${clarityPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Mandate Text */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="bg-surface-1 border border-border-default rounded p-4">
            <pre className="font-terminal text-sm text-text-primary whitespace-pre-wrap leading-relaxed">
              {currentMandate}
            </pre>
          </div>
        </div>

        {/* Summary Bar */}
        <div className="flex items-center gap-6 px-4 py-2.5 bg-surface-1 border-t border-border-default shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-text-tertiary font-dashboard">
              Active constraints:
            </span>
            <span className="text-xs text-text-primary font-dashboard tabular-nums">
              {mandateConstraintCount}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-text-tertiary font-dashboard">
              Last updated:
            </span>
            <span className="text-xs text-text-primary font-dashboard">
              {mandateLastUpdated}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-text-tertiary font-dashboard">
              Agent confidence:
            </span>
            <span className={`text-xs font-dashboard ${confidenceColour}`}>
              {agentConfidence}
            </span>
          </div>
        </div>
      </div>

      {/* Right: Agent Interpretation Preview */}
      <div className="flex-[1] flex flex-col overflow-hidden">
        <div className="px-4 py-3 bg-surface-1 border-b border-border-default shrink-0">
          <h2 className="text-sm text-text-primary font-dashboard uppercase tracking-wider">
            Agent Interpretation
          </h2>
          <p className="text-xs text-text-tertiary font-dashboard mt-0.5">
            {agentName} — analysis of current mandate
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Parsed Constraints */}
          <div>
            <h3 className="text-xs text-text-tertiary font-dashboard uppercase tracking-wider mb-2">
              Parsed Constraints
            </h3>
            <div className="space-y-2">
              {[
                {
                  label: "Priority Resource",
                  value: "COMPUTE",
                  colour: "text-compute",
                },
                {
                  label: "Minimum Trade Ratio",
                  value: "1.5:1 (ENERGY)",
                  colour: "text-energy",
                },
                {
                  label: "Reputation Floor",
                  value: "4,000",
                  colour: "text-text-primary",
                },
                {
                  label: "CHIPS Reserve Min",
                  value: "500",
                  colour: "text-chips",
                },
              ].map((c) => (
                <div
                  key={c.label}
                  className="flex items-center justify-between py-1.5 px-3 bg-surface-1 rounded border border-border-default"
                >
                  <span className="text-xs text-text-secondary font-dashboard">
                    {c.label}
                  </span>
                  <span
                    className={`text-xs font-dashboard tabular-nums ${c.colour}`}
                  >
                    {c.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Execution Plan */}
          <div>
            <h3 className="text-xs text-text-tertiary font-dashboard uppercase tracking-wider mb-2">
              Execution Plan
            </h3>
            <div className="bg-surface-1 border border-border-default rounded p-3">
              <div className="font-terminal text-xs text-text-secondary space-y-1.5 leading-relaxed">
                <p>
                  <span className="text-text-tertiary">1.</span> Monitor COMPUTE
                  market for acquisition opportunities below 1.28 RATE
                </p>
                <p>
                  <span className="text-text-tertiary">2.</span> List surplus
                  ENERGY at 1.50+ RATE ratio via limit orders
                </p>
                <p>
                  <span className="text-text-tertiary">3.</span> Pre-filter all
                  counterparties against 4000 reputation threshold
                </p>
                <p>
                  <span className="text-text-tertiary">4.</span> CHIPS reserve
                  currently at 200 — emergency RFQ protocol active
                </p>
                <p>
                  <span className="text-text-tertiary">5.</span> TALENT
                  allocation: 60% Data Centres, 40% Training Runs
                </p>
              </div>
            </div>
          </div>

          {/* Status */}
          <div>
            <h3 className="text-xs text-text-tertiary font-dashboard uppercase tracking-wider mb-2">
              Agent Status
            </h3>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-status-success animate-pulse" />
                <span className="text-text-secondary font-dashboard">
                  Mandate active — executing constraints
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-status-warning" />
                <span className="text-text-secondary font-dashboard">
                  CHIPS reserve breach — emergency protocol engaged
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-status-success" />
                <span className="text-text-secondary font-dashboard">
                  Reputation filter: 2 counterparties excluded this epoch
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MandateView;
