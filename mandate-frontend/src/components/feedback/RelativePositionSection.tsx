'use client';

interface RelativePositionSectionProps {
  rank: number;
  totalAgents: number;
  gapAbove: number | null;
  gapBelow: number | null;
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

export function RelativePositionSection({
  rank,
  totalAgents,
  gapAbove,
  gapBelow,
}: RelativePositionSectionProps) {
  return (
    <div className="space-y-0.5">
      <div className="font-terminal text-[11px] text-text-primary tabular-nums">
        Rank: #{rank} of {formatNumber(totalAgents)} agents
      </div>

      {rank === 1 ? (
        <div className="font-terminal text-[10px] text-status-success tabular-nums">
          {gapBelow !== null
            ? `Leading by ${formatNumber(gapBelow)} points`
            : '\u2014'}
        </div>
      ) : (
        <div className="flex flex-col gap-0">
          <span className="font-terminal text-[10px] text-text-secondary tabular-nums">
            {gapAbove !== null
              ? `${formatNumber(gapAbove)} pts behind #${rank - 1}`
              : '\u2014'}
          </span>
          <span className="font-terminal text-[10px] text-text-secondary tabular-nums">
            {gapBelow !== null
              ? `${formatNumber(gapBelow)} pts ahead of #${rank + 1}`
              : '\u2014'}
          </span>
        </div>
      )}
    </div>
  );
}
