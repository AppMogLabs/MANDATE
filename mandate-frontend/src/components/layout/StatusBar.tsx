"use client";

import { StatusDot } from "@/components/data-display/StatusDot";

type ChainConnectionStatus = "live" | "mock" | "offline";

interface StatusBarProps {
  buildingCount: number;
  activeBuildings: number;
  systemStatus: "online" | "degraded" | "offline";
  chainStatus?: ChainConnectionStatus;
  blockHeight?: number;
}

export function StatusBar({
  buildingCount,
  activeBuildings,
  systemStatus,
  chainStatus = "mock",
}: StatusBarProps) {
  const statusColour = {
    online: "success" as const,
    degraded: "warning" as const,
    offline: "critical" as const,
  };

  return (
    <footer className="h-8 bg-surface-1 border-t border-border-default flex items-center px-4 gap-4 shrink-0 z-50">
      {/* Building Production Heartbeat */}
      <div className="flex items-center gap-2">
        <StatusDot status="success" size={6} pulse />
        <span className="text-xs text-text-tertiary font-dashboard">
          Buildings: {activeBuildings}/{buildingCount} active
        </span>
      </div>

      {/* Chain Connection */}
      <div className="flex items-center gap-2">
        <StatusDot
          status={chainStatus === "live" ? "success" : chainStatus === "mock" ? "warning" : "critical"}
          size={6}
          pulse={chainStatus === "live"}
        />
        <span className="text-xs text-text-tertiary font-dashboard">
          {chainStatus === "live" ? "Live · MegaETH Testnet" : chainStatus === "mock" ? "Mock Data" : "Offline"}
        </span>
      </div>

      <div className="flex-1" />

      {/* System Status */}
      <div className="flex items-center gap-2">
        <StatusDot status={statusColour[systemStatus]} size={6} />
        <span className="text-xs text-text-tertiary font-dashboard capitalize">
          System {systemStatus}
        </span>
      </div>
    </footer>
  );
}

export default StatusBar;
