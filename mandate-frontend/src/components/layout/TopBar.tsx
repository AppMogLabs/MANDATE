"use client";

import { useState, useEffect } from "react";
import { ResourceBadge } from "@/components/data-display/ResourceBadge";
import { ResourceHealthIndicator } from "@/components/data-display/ResourceHealthIndicator";
import { Tooltip } from "@/components/tooltip";
import type { ResourceBalance, EpochState } from "@/mock/types";
import {
  RESOURCE_ORDER,
  RESOURCE_LABELS,
  RESOURCE_TW_COLOURS,
  RESOURCE_PRODUCERS,
  RESOURCE_CONSUMERS,
} from "@/lib/constants";
import { formatCountdown, formatNumber, formatPrice, formatPercent } from "@/lib/format";

interface TopBarProps {
  resources: ResourceBalance[];
  epoch: EpochState;
  playerName: string;
  playerRole: string;
  rateBalance: number;
  alertMessage?: string;
  onDismissAlert?: () => void;
  isSimpleMode?: boolean;
  onToggleMode?: () => void;
}

export function TopBar({
  resources,
  epoch,
  playerName,
  playerRole,
  rateBalance,
  alertMessage,
  onDismissAlert,
  isSimpleMode,
  onToggleMode,
}: TopBarProps) {
  const [timeRemaining, setTimeRemaining] = useState(epoch.timeRemaining);

  // Re-sync when live epoch data arrives or changes
  useEffect(() => {
    setTimeRemaining(epoch.timeRemaining);
  }, [epoch.timeRemaining]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Epoch duration: derive from timestamps (seconds) or fall back to 30 days
  const epochDuration = epoch.endTimestamp > epoch.startTimestamp
    ? epoch.endTimestamp - epoch.startTimestamp
    : 30 * 24 * 3600;
  const progress = epochDuration > 0 ? 1 - timeRemaining / epochDuration : 0;

  const orderedResources = RESOURCE_ORDER.map(
    (r) => resources.find((rb) => rb.resource === r)!
  ).filter(Boolean);

  return (
    <>
      <header className="h-12 bg-surface-1 border-b border-border-default flex items-center px-4 gap-4 shrink-0 z-50">
        {/* Epoch Timer */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-text-tertiary font-dashboard uppercase">
            Epoch {epoch.epochNumber}
          </span>
          <span className="text-sm text-moon-white font-dashboard tabular-nums tracking-wide">
            {formatCountdown(timeRemaining)}
          </span>
          {/* Progress bar */}
          <div className="w-16 h-1 bg-surface-3 rounded-full overflow-hidden">
            <div
              className="h-full bg-compute rounded-full transition-all duration-1000"
              style={{ width: `${Math.min(100, progress * 100)}%` }}
            />
          </div>
        </div>

        <div className="w-px h-6 bg-border-default" />

        {/* Resource Summary — simplified or full */}
        <div data-tour="resource-bar" className="flex items-center gap-3 overflow-x-auto flex-1">
          {isSimpleMode ? (
            <>
              <ResourceHealthIndicator resources={resources} rateBalance={rateBalance} />
              {/* RATE balance in simple mode */}
              <div className="flex items-center gap-1.5 shrink-0 ml-2 pl-2 border-l border-border-default">
                <span className="text-xs text-text-tertiary">RATE</span>
                <span className="text-sm text-moon-white tabular-nums font-dashboard">
                  {rateBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
              </div>
            </>
          ) : (<>
          {orderedResources.map((rb) => {
            const net = rb.production - rb.consumption;
            const producers = RESOURCE_PRODUCERS[rb.resource];
            const consumers = RESOURCE_CONSUMERS[rb.resource];

            return (
              <Tooltip
                key={rb.resource}
                trigger={
                  <ResourceBadge
                    resource={rb.resource}
                    balance={rb.priceInRate}
                    change={rb.change1h}
                    sparkline={rb.sparkline}
                    compact
                  />
                }
                content={
                  <div className="space-y-2 min-w-[220px]">
                    <div className={`text-sm font-medium ${RESOURCE_TW_COLOURS[rb.resource]}`}>
                      {rb.resource} ({RESOURCE_LABELS[rb.resource]})
                    </div>
                    <div className="border-t border-border-default pt-1.5 space-y-1 font-dashboard text-xs">
                      <div className="flex justify-between">
                        <span className="text-text-tertiary">Balance</span>
                        <span className="text-text-primary tabular-nums">{formatNumber(parseFloat(rb.balance) / 1e18)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-tertiary">Price</span>
                        <span className="text-text-primary tabular-nums">{formatPrice(rb.priceInRate)} RATE</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-tertiary">1h Change</span>
                        <span className={`tabular-nums ${rb.change1h >= 0 ? "text-status-success" : "text-status-critical"}`}>
                          {formatPercent(rb.change1h)}
                        </span>
                      </div>
                    </div>
                    <div className="border-t border-border-default pt-1.5 space-y-1 font-dashboard text-xs">
                      <div className="flex justify-between">
                        <span className="text-text-tertiary">Production</span>
                        <span className="text-text-primary tabular-nums">{formatNumber(rb.production)} / hr</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-tertiary">Consumption</span>
                        <span className="text-text-primary tabular-nums">{formatNumber(rb.consumption)} / hr</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-tertiary">Net Flow</span>
                        <span className={`tabular-nums ${net >= 0 ? "text-status-success" : "text-status-critical"}`}>
                          {net >= 0 ? "+" : ""}{formatNumber(net)} / hr
                        </span>
                      </div>
                    </div>
                    <div className="border-t border-border-default pt-1.5 space-y-1 font-dashboard text-xs">
                      <div>
                        <span className="text-text-tertiary">Produced by: </span>
                        {producers.map((p, i) => (
                          <span key={p}>
                            <Tooltip
                              trigger={
                                <span className="text-text-primary underline decoration-dotted cursor-help">
                                  {p}
                                </span>
                              }
                              content={
                                <div className="text-xs font-dashboard">
                                  <div className="text-text-primary font-medium">{p}</div>
                                  <div className="text-text-secondary mt-1">
                                    Building type that produces {rb.resource}
                                  </div>
                                </div>
                              }
                            />
                            {i < producers.length - 1 ? ", " : ""}
                          </span>
                        ))}
                      </div>
                      <div>
                        <span className="text-text-tertiary">Consumed by: </span>
                        {consumers.map((c, i) => (
                          <span key={c}>
                            <Tooltip
                              trigger={
                                <span className="text-text-primary underline decoration-dotted cursor-help">
                                  {c}
                                </span>
                              }
                              content={
                                <div className="text-xs font-dashboard">
                                  <div className="text-text-primary font-medium">{c}</div>
                                  <div className="text-text-secondary mt-1">
                                    Consumes {rb.resource} during operation
                                  </div>
                                </div>
                              }
                            />
                            {i < consumers.length - 1 ? ", " : ""}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                }
              />
            );
          })}
          {/* RATE balance (advanced mode) */}
          <div className="flex items-center gap-1.5 shrink-0 ml-2 pl-2 border-l border-border-default">
            <span className="text-xs text-text-tertiary">RATE</span>
            <span className="text-sm text-moon-white tabular-nums font-dashboard">
              {rateBalance.toLocaleString(undefined, {
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
          </>)
}
        </div>

        <div className="w-px h-6 bg-border-default" />

        {/* Player Info + Mode Toggle */}
        <div className="flex items-center gap-3 shrink-0">
          {onToggleMode && (
            <div className="flex items-center bg-surface-2 rounded overflow-hidden text-[10px] font-dashboard">
              <button
                onClick={isSimpleMode ? undefined : onToggleMode}
                className={`px-2 py-1 transition-colors ${isSimpleMode ? "bg-[#7CD8D5] text-night-sky font-medium" : "text-text-tertiary hover:text-text-secondary"}`}
              >
                Simple
              </button>
              <button
                onClick={isSimpleMode ? onToggleMode : undefined}
                className={`px-2 py-1 transition-colors ${!isSimpleMode ? "bg-[#7CD8D5] text-night-sky font-medium" : "text-text-tertiary hover:text-text-secondary"}`}
              >
                Advanced
              </button>
            </div>
          )}
          <span className="text-sm text-text-primary font-dashboard">
            {playerName}
          </span>
        </div>
      </header>

      {/* Critical Alert Banner */}
      {alertMessage && (
        <div
          className="h-8 bg-status-critical/15 border-b border-status-critical/30 flex items-center px-4 cursor-pointer z-50"
          onClick={onDismissAlert}
          role="alert"
        >
          <div className="w-2 h-2 rounded-full bg-status-critical animate-pulse mr-2" />
          <span className="text-sm text-moon-white font-dashboard truncate">
            {alertMessage}
          </span>
          <span className="text-xs text-text-tertiary ml-auto shrink-0">
            Click to dismiss
          </span>
        </div>
      )}
    </>
  );
}

export default TopBar;
