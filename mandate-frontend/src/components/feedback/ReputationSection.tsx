'use client';

interface ReputationSectionProps {
  score: number | null;
  isTopTwentyPercent: boolean | null;
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

export function ReputationSection({ score, isTopTwentyPercent }: ReputationSectionProps) {
  return (
    <div className="space-y-1.5">
      <div className="font-terminal text-[10px] text-text-tertiary uppercase tracking-wider">
        Reputation
      </div>

      <div className="font-terminal text-sm text-text-primary tabular-nums">
        {score !== null ? formatNumber(score) : '\u2014'}
      </div>

      {isTopTwentyPercent === true && (
        <div className="inline-block px-2 py-0.5 rounded-full text-[10px] font-terminal bg-status-success/10 text-status-success border border-status-success/20">
          Top 20% &mdash; 50% resources carry over
        </div>
      )}

      {isTopTwentyPercent === false && (
        <div className="inline-block px-2 py-0.5 rounded-full text-[10px] font-terminal bg-status-warning/10 text-status-warning border border-status-warning/20">
          Bottom 80% &mdash; resources reset at epoch end
        </div>
      )}

      {isTopTwentyPercent === null && (
        <div className="font-terminal text-[10px] text-text-tertiary">&mdash;</div>
      )}
    </div>
  );
}
