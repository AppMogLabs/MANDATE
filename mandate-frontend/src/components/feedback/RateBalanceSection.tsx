'use client';

interface RateBalanceSectionProps {
  balance: number;
  delta24h: number | null;
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

export function RateBalanceSection({ balance, delta24h }: RateBalanceSectionProps) {
  return (
    <div className="space-y-0.5">
      <div className="font-terminal text-[10px] text-text-tertiary uppercase tracking-wider">
        Rate
      </div>

      <div className="flex items-baseline gap-2">
        <span className="font-terminal text-sm text-text-primary tabular-nums">
          {formatNumber(balance)} RATE
        </span>
      </div>

      {delta24h !== null ? (
        <span
          className={`font-terminal text-[10px] tabular-nums ${
            delta24h >= 0 ? 'text-status-success' : 'text-status-critical'
          }`}
        >
          {delta24h >= 0 ? '+' : ''}
          {formatNumber(delta24h)} today
        </span>
      ) : (
        <span className="font-terminal text-[10px] text-text-tertiary">&mdash;</span>
      )}
    </div>
  );
}
