'use client';

interface EpochProgressSectionProps {
  epochNumber: number;
  timeRemainingSeconds: number;
  epochDurationSeconds: number;
}

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return '0m';

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);

  return parts.join(' ');
}

export function EpochProgressSection({
  epochNumber,
  timeRemainingSeconds,
  epochDurationSeconds,
}: EpochProgressSectionProps) {
  const progress = epochDurationSeconds > 0
    ? 1 - timeRemainingSeconds / epochDurationSeconds
    : 0;
  const pct = Math.max(0, Math.min(progress * 100, 100));

  const remainingRatio = epochDurationSeconds > 0
    ? timeRemainingSeconds / epochDurationSeconds
    : 1;

  const barColour = remainingRatio < 0.1
    ? 'bg-status-critical'
    : remainingRatio < 0.25
      ? 'bg-status-warning'
      : 'bg-status-success';

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <span className="font-dashboard text-[11px] text-text-secondary uppercase tracking-wide">
          Epoch {epochNumber}
        </span>
        <span className="font-terminal text-[11px] text-text-primary tabular-nums">
          {formatCountdown(timeRemainingSeconds)}
        </span>
      </div>

      <div className="h-1.5 bg-surface-2 rounded-sm overflow-hidden">
        <div
          className={`h-full rounded-sm transition-all duration-500 ${barColour}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
