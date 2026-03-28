"use client";

import { useState } from "react";
import type { OrderBookSnapshot, ResourceType } from "@/mock/types";
import { RESOURCE_ORDER, RESOURCE_LABELS } from "@/lib/constants";
import { formatPrice, formatNumber, formatPercent } from "@/lib/format";

interface OrderBookProps {
  snapshots: OrderBookSnapshot[];
}

export function OrderBook({ snapshots }: OrderBookProps) {
  const [selectedPair, setSelectedPair] = useState<`${ResourceType}/RATE`>(
    "COMPUTE/RATE"
  );

  const snapshot = snapshots.find((s) => s.pair === selectedPair);

  if (!snapshot) return null;

  const maxVolume = Math.max(
    ...snapshot.bids.map((b) => b.volume),
    ...snapshot.asks.map((a) => a.volume)
  );

  const spread = snapshot.asks.length > 0 && snapshot.bids.length > 0
    ? snapshot.asks[0].price - snapshot.bids[0].price
    : 0;

  return (
    <div className="h-full flex flex-col font-dashboard">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-surface-1 border-b border-border-default shrink-0">
        {/* Pair selector */}
        <select
          value={selectedPair}
          onChange={(e) =>
            setSelectedPair(e.target.value as `${ResourceType}/RATE`)
          }
          className="bg-surface-2 text-text-primary text-sm border border-border-default rounded px-2 py-1 outline-none focus:border-border-focus"
        >
          {RESOURCE_ORDER.map((r) => (
            <option key={r} value={`${r}/RATE`}>
              {RESOURCE_LABELS[r]}/RATE
            </option>
          ))}
        </select>

        {/* Last trade */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-sm text-text-primary tabular-nums">
              {formatPrice(snapshot.lastTradePrice)}
            </div>
            <div
              className={`text-xs tabular-nums ${
                snapshot.change24h >= 0
                  ? "text-status-success"
                  : "text-status-critical"
              }`}
            >
              {formatPercent(snapshot.change24h)}
            </div>
          </div>
        </div>
      </div>

      {/* DOM Ladder */}
      <div className="flex-1 overflow-y-auto">
        {/* Asks (reversed — highest at top) */}
        <div className="flex flex-col-reverse">
          {snapshot.asks.map((level, i) => (
            <div
              key={`ask-${i}`}
              className="flex items-center h-7 px-3 relative"
            >
              {/* Volume bar */}
              <div
                className="absolute inset-y-0 right-0 bg-status-critical/10"
                style={{
                  width: `${(level.volume / maxVolume) * 100}%`,
                }}
              />
              <span className="text-xs text-status-critical tabular-nums z-10 w-20 text-right">
                {formatPrice(level.price)}
              </span>
              <span className="text-xs text-text-secondary tabular-nums z-10 flex-1 text-right">
                {formatNumber(level.volume, 0)}
              </span>
              <span className="text-xs text-text-tertiary tabular-nums z-10 w-8 text-right">
                {level.orderCount}
              </span>
            </div>
          ))}
        </div>

        {/* Spread */}
        <div className="flex items-center h-7 px-3 bg-surface-1 border-y border-border-default">
          <span className="text-xs text-text-tertiary">Spread</span>
          <span className="text-xs text-text-secondary tabular-nums ml-auto">
            {formatPrice(spread)}
          </span>
        </div>

        {/* Bids */}
        <div>
          {snapshot.bids.map((level, i) => (
            <div
              key={`bid-${i}`}
              className="flex items-center h-7 px-3 relative"
            >
              {/* Volume bar */}
              <div
                className="absolute inset-y-0 right-0 bg-status-success/10"
                style={{
                  width: `${(level.volume / maxVolume) * 100}%`,
                }}
              />
              <span className="text-xs text-status-success tabular-nums z-10 w-20 text-right">
                {formatPrice(level.price)}
              </span>
              <span className="text-xs text-text-secondary tabular-nums z-10 flex-1 text-right">
                {formatNumber(level.volume, 0)}
              </span>
              <span className="text-xs text-text-tertiary tabular-nums z-10 w-8 text-right">
                {level.orderCount}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Column headers at bottom */}
      <div className="flex items-center h-6 px-3 bg-surface-1 border-t border-border-default text-xs text-text-tertiary shrink-0">
        <span className="w-20 text-right">Price</span>
        <span className="flex-1 text-right">Volume</span>
        <span className="w-8 text-right">#</span>
      </div>
    </div>
  );
}

export default OrderBook;
