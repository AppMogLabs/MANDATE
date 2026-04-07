'use client';

const RESOURCES: Array<{ key: string; label: string; abbr: string; dotClass: string }> = [
  { key: 'COMPUTE', label: 'COMPUTE', abbr: 'CMP', dotClass: 'bg-compute' },
  { key: 'ENERGY', label: 'ENERGY', abbr: 'NRG', dotClass: 'bg-energy' },
  { key: 'CHIPS', label: 'CHIPS', abbr: 'CHP', dotClass: 'bg-chips' },
  { key: 'COOLING', label: 'COOLING', abbr: 'CLG', dotClass: 'bg-cooling' },
  { key: 'TALENT', label: 'TALENT', abbr: 'TLT', dotClass: 'bg-talent' },
  { key: 'DATA', label: 'DATA', abbr: 'DTA', dotClass: 'bg-data' },
  { key: 'CLEARANCE', label: 'CLEARANCE', abbr: 'CLR', dotClass: 'bg-clearance' },
];

interface ResourceSummaryBarProps {
  balances: Record<string, number>;
}

function formatBalance(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  if (n >= 1) return n.toFixed(0);
  if (n > 0) return n.toFixed(2);
  return '0';
}

export function ResourceSummaryBar({ balances }: ResourceSummaryBarProps) {
  return (
    <div className="space-y-1.5">
      <div className="font-terminal text-[10px] text-text-tertiary uppercase tracking-wider">
        Your Resources
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        {RESOURCES.map(({ key, abbr, dotClass }) => {
          const value = balances[key] ?? 0;
          const isZero = value === 0;

          return (
            <div key={key} className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${dotClass} ${
                  isZero ? 'animate-pulse' : ''
                }`}
              />
              <span
                className={`font-terminal text-[11px] ${
                  isZero ? 'text-status-critical' : 'text-text-secondary'
                }`}
              >
                {abbr}
              </span>
              <span
                className={`font-terminal text-[11px] tabular-nums ml-auto ${
                  isZero ? 'text-status-critical' : 'text-text-primary'
                }`}
              >
                {formatBalance(value)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Zero-resource warning */}
      {(() => {
        const zeroResources = RESOURCES.filter(r => (balances[r.key] ?? 0) === 0);
        if (zeroResources.length === 0) return null;
        return (
          <div className="text-[10px] font-terminal text-status-warning mt-1">
            {zeroResources.length === 1
              ? `${zeroResources[0].abbr} at zero`
              : `${zeroResources.length} resources at zero`}
          </div>
        );
      })()}
    </div>
  );
}
