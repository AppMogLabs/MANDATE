"use client";

import { useState, useMemo } from "react";
import type { OrderBookSnapshot, ResourceType } from "@/mock/types";
import { RESOURCE_ORDER, RESOURCE_LABELS } from "@/lib/constants";
import { formatPrice, formatNumber } from "@/lib/format";

interface MarketDepthProps {
  snapshots: OrderBookSnapshot[];
}

/**
 * Sell-side market depth chart.
 *
 * MANDATE uses a sell-side order book: sellers list resources for RATE,
 * buyers match instantly (no limit buy orders). This chart shows
 * cumulative sell-side liquidity — the "wall" a buyer must eat through.
 *
 * Left = cheapest asks (best price for buyers), stacking right into deeper liquidity.
 */
export function MarketDepth({ snapshots }: MarketDepthProps) {
  const [selectedPair, setSelectedPair] = useState<`${ResourceType}/RATE`>(
    "COMPUTE/RATE"
  );

  const snapshot = snapshots.find((s) => s.pair === selectedPair);

  const { levels, maxCumulativeVol, priceMin, priceMax, bestAsk, totalVolume } = useMemo(() => {
    if (!snapshot || snapshot.asks.length === 0) {
      return { levels: [], maxCumulativeVol: 0, priceMin: 0, priceMax: 0, bestAsk: 0, totalVolume: 0 };
    }

    // Sort asks low→high (cheapest first)
    const sorted = [...snapshot.asks].sort((a, b) => a.price - b.price);
    let cumVol = 0;
    const pts = sorted.map((level) => {
      cumVol += level.volume;
      return { price: level.price, cumVolume: cumVol, volume: level.volume, orderCount: level.orderCount };
    });

    const total = pts[pts.length - 1].cumVolume;
    const best = pts[0].price;
    const pMin = best * 0.92;
    const pMax = pts[pts.length - 1].price * 1.08;

    return {
      levels: pts,
      maxCumulativeVol: total,
      priceMin: pMin,
      priceMax: pMax,
      bestAsk: best,
      totalVolume: total,
    };
  }, [snapshot]);

  if (!snapshot) return null;

  // SVG dimensions
  const W = 400;
  const H = 180;
  const PAD_T = 4;
  const PAD_B = 20;
  const chartH = H - PAD_T - PAD_B;

  const priceRange = priceMax - priceMin || 1;
  const toX = (price: number) => ((price - priceMin) / priceRange) * W;
  const toY = (vol: number) => maxCumulativeVol > 0
    ? PAD_T + chartH - (vol / maxCumulativeVol) * chartH
    : PAD_T + chartH;

  // Build step-area path for cumulative sell depth
  const buildDepthPath = () => {
    if (levels.length === 0) return "";
    // Start at best ask, volume = 0
    let d = `M ${toX(levels[0].price)} ${toY(0)}`;
    for (let i = 0; i < levels.length; i++) {
      // Step up to this level's cumulative volume
      d += ` L ${toX(levels[i].price)} ${toY(levels[i].cumVolume)}`;
      // Step right to next price (or to chart edge)
      const nextPrice = i < levels.length - 1 ? levels[i + 1].price : priceMax;
      d += ` L ${toX(nextPrice)} ${toY(levels[i].cumVolume)}`;
    }
    // Close back to baseline
    d += ` L ${toX(priceMax)} ${toY(0)} Z`;
    return d;
  };

  // Build line path (top edge only, for stroke)
  const buildLinePath = () => {
    if (levels.length === 0) return "";
    let d = `M ${toX(levels[0].price)} ${toY(0)}`;
    for (let i = 0; i < levels.length; i++) {
      d += ` L ${toX(levels[i].price)} ${toY(levels[i].cumVolume)}`;
      const nextPrice = i < levels.length - 1 ? levels[i + 1].price : priceMax;
      d += ` L ${toX(nextPrice)} ${toY(levels[i].cumVolume)}`;
    }
    return d;
  };

  const hasData = levels.length > 0;

  return (
    <div className="h-full flex flex-col font-dashboard">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-surface-1 border-b border-border-default shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-tertiary uppercase tracking-wider">Depth</span>
          <select
            value={selectedPair}
            onChange={(e) => setSelectedPair(e.target.value as `${ResourceType}/RATE`)}
            className="bg-surface-2 text-text-primary text-xs border border-border-default rounded px-1.5 py-0.5 outline-none focus:border-border-focus"
          >
            {RESOURCE_ORDER.map((r) => (
              <option key={r} value={`${r}/RATE`}>
                {RESOURCE_LABELS[r]}/RATE
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3 text-xs">
          {hasData ? (
            <>
              <span className="text-text-tertiary">
                Best <span className="text-status-success tabular-nums">{formatPrice(bestAsk)}</span>
              </span>
              <span className="text-text-tertiary">
                Vol <span className="text-text-primary tabular-nums">{formatNumber(totalVolume, 0)}</span>
              </span>
            </>
          ) : (
            <span className="text-text-tertiary">No listings</span>
          )}
        </div>
      </div>

      {/* Depth Chart */}
      <div className="flex-1 relative overflow-hidden px-2 py-1">
        {hasData ? (
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="w-full h-full"
          >
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => (
              <line
                key={i}
                x1={0}
                y1={toY(maxCumulativeVol * pct)}
                x2={W}
                y2={toY(maxCumulativeVol * pct)}
                stroke="rgba(255,255,255,0.05)"
                strokeWidth="0.5"
              />
            ))}

            {/* Best ask price marker */}
            <line
              x1={toX(bestAsk)}
              y1={PAD_T}
              x2={toX(bestAsk)}
              y2={PAD_T + chartH}
              stroke="rgba(34, 197, 94, 0.4)"
              strokeWidth="0.5"
              strokeDasharray="3,3"
            />

            {/* Gradient definition */}
            <defs>
              <linearGradient id="depthGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="rgba(34, 197, 94, 0.3)" />
                <stop offset="40%" stopColor="rgba(234, 179, 8, 0.2)" />
                <stop offset="100%" stopColor="rgba(239, 68, 68, 0.25)" />
              </linearGradient>
            </defs>

            {/* Depth area fill */}
            <path
              d={buildDepthPath()}
              fill="url(#depthGradient)"
            />

            {/* Depth line (top edge) */}
            <path
              d={buildLinePath()}
              fill="none"
              stroke="rgba(234, 179, 8, 0.8)"
              strokeWidth="1.5"
            />

            {/* Price axis labels */}
            {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
              const price = priceMin + priceRange * pct;
              return (
                <text
                  key={i}
                  x={toX(price)}
                  y={H - 4}
                  textAnchor="middle"
                  fill="rgba(255,255,255,0.4)"
                  fontSize="9"
                  fontFamily="monospace"
                >
                  {formatPrice(price)}
                </text>
              );
            })}
          </svg>
        ) : (
          <div className="h-full flex items-center justify-center text-text-tertiary text-xs">
            No sell listings on this market
          </div>
        )}

        {/* Volume labels */}
        {hasData && (
          <div className="absolute top-1 left-3 flex flex-col justify-between h-[calc(100%-1.5rem)] pointer-events-none">
            <span className="text-[9px] text-text-tertiary tabular-nums">{formatNumber(maxCumulativeVol, 0)}</span>
            <span className="text-[9px] text-text-tertiary tabular-nums">0</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-surface-1 border-t border-border-default shrink-0">
        <span className="flex items-center gap-1 text-[10px] text-text-tertiary">
          <span className="w-2 h-2 rounded-sm" style={{ background: 'rgba(234, 179, 8, 0.6)' }} /> Sell depth (cumulative)
        </span>
        <span className="text-[10px] text-text-tertiary">
          {levels.length} price level{levels.length !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
}
