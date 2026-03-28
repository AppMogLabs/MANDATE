"use client";

import { Sparkline } from "@/components/data-display/Sparkline";

interface PriceChartProps {
  data: number[];
  label?: string;
}

export function PriceChart({ data, label = "Price History" }: PriceChartProps) {
  return (
    <div className="h-full flex flex-col items-center justify-center p-4">
      <span className="text-xs text-text-tertiary font-dashboard mb-4 uppercase tracking-wider">
        {label}
      </span>
      <Sparkline data={data} width={400} height={200} />
      <span className="text-xs text-text-tertiary font-terminal mt-4">
        Chart library TBD — Lightweight Charts (TradingView) or custom canvas
      </span>
    </div>
  );
}

export default PriceChart;
