"use client";

type DotStatus = "critical" | "warning" | "info" | "success";

interface StatusDotProps {
  status: DotStatus;
  pulse?: boolean;
  size?: number;
}

const STATUS_BG: Record<DotStatus, string> = {
  critical: "bg-status-critical",
  warning: "bg-status-warning",
  info: "bg-status-info",
  success: "bg-status-success",
};

function StatusDot({ status, pulse = false, size = 8 }: StatusDotProps) {
  const bgClass = STATUS_BG[status];

  return (
    <span
      className="relative inline-flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
    >
      {pulse && (
        <span
          className={`absolute inset-0 rounded-full ${bgClass} opacity-75 animate-ping`}
        />
      )}
      <span
        className={`relative rounded-full ${bgClass}`}
        style={{ width: size, height: size }}
      />
    </span>
  );
}

export { StatusDot };
export type { StatusDotProps, DotStatus };
