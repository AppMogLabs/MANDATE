'use client';

interface AGIScoreSectionProps {
  total: number;
  resources: number;
  buildings: number;
  intelligence: number;
  chain: number;
  delta24h: number | null;
  sparkline: number[];
}

const BAR_MAX = 2500;

const BARS: Array<{ label: string; key: keyof Pick<AGIScoreSectionProps, 'resources' | 'buildings' | 'intelligence' | 'chain'>; colour: string }> = [
  { label: 'RESOURCES', key: 'resources', colour: 'var(--colour-compute)' },
  { label: 'BUILDINGS', key: 'buildings', colour: 'var(--colour-energy)' },
  { label: 'INTEL', key: 'intelligence', colour: 'var(--colour-data)' },
  { label: 'CHAIN', key: 'chain', colour: 'var(--colour-clearance)' },
];

function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

function buildSparklinePath(data: number[], width: number, height: number): string {
  if (data.length < 2) return '';
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);

  return data
    .map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

export function AGIScoreSection({
  total,
  resources,
  buildings,
  intelligence,
  chain,
  delta24h,
  sparkline,
}: AGIScoreSectionProps) {
  const scores = { resources, buildings, intelligence, chain };

  return (
    <div className="space-y-2">
      <div className="font-terminal text-[10px] text-text-tertiary uppercase tracking-wider">
        AGI Progress Score
      </div>

      <div className="flex items-baseline gap-2">
        <span className="font-terminal text-2xl text-text-primary tabular-nums">
          {formatNumber(total)}
        </span>
        {delta24h !== null ? (
          <span
            className={`font-terminal text-xs tabular-nums ${
              delta24h >= 0 ? 'text-status-success' : 'text-status-critical'
            }`}
          >
            {delta24h >= 0 ? '\u25B2' : '\u25BC'} {formatNumber(Math.abs(delta24h))}
          </span>
        ) : (
          <span className="font-terminal text-xs text-text-tertiary">&mdash;</span>
        )}
      </div>

      {sparkline.length >= 2 && (
        <svg
          width={120}
          height={32}
          viewBox="0 0 120 32"
          className="block"
          aria-label="Score sparkline"
        >
          <polyline
            points={buildSparklinePath(sparkline, 120, 32)
              .replace(/[ML]/g, '')
              .trim()
              .replace(/\s+/g, ' ')
            }
            fill="none"
            stroke="#ECE8E8"
            strokeWidth={1.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
      )}

      <div className="space-y-1.5">
        {BARS.map(({ label, key, colour }) => {
          const value = scores[key];
          const pct = Math.min((value / BAR_MAX) * 100, 100);

          return (
            <div key={key} className="flex items-center gap-2">
              <span className="font-terminal text-[10px] text-text-tertiary w-[72px] shrink-0">
                {label}
              </span>
              <div className="flex-1 h-1.5 bg-surface-2 rounded-sm overflow-hidden">
                <div
                  className="h-full rounded-sm transition-all duration-300"
                  style={{ width: `${pct}%`, backgroundColor: colour }}
                />
              </div>
              <span className="font-terminal text-[10px] text-text-secondary tabular-nums w-[36px] text-right">
                {formatNumber(value)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
