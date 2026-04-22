import { Sparkline } from './Sparkline';
import type { MvpResource } from '@/hooks/useMvpEvents';
import type { ResourcePrice } from '@/hooks/useMvpMarket';

const RESOURCE_COLOUR: Record<MvpResource, string> = {
  COMPUTE: 'var(--color-compute)',
  CHIPS: 'var(--color-chips)',
  DATA: 'var(--color-data)',
};

interface ResourceRowProps {
  readonly price: ResourcePrice;
  readonly balance: number;
}

export function ResourceRow({ price, balance }: ResourceRowProps) {
  const colour = RESOURCE_COLOUR[price.resource];
  const rateValue = balance * price.price;
  const up = price.deltaPercent >= 0;

  return (
    <div className="flex items-center justify-between py-3 border-b border-border-default/60 last:border-b-0">
      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: colour }} />
          <span className="text-sm tracking-wide" style={{ color: colour }}>
            {price.resource}
          </span>
        </div>
        <span className="text-xs text-text-secondary font-[family-name:var(--font-terminal)] mt-0.5">
          {balance.toFixed(2)} held
        </span>
      </div>

      <div className="flex-1 flex justify-center">
        <Sparkline points={price.history} stroke={colour} />
      </div>

      <div className="flex flex-col items-end">
        <span className="text-sm font-[family-name:var(--font-terminal)]">
          {price.price.toFixed(3)} <span className="text-text-secondary text-xs">RATE</span>
        </span>
        <span
          className="text-[11px] font-[family-name:var(--font-terminal)] mt-0.5"
          style={{ color: up ? 'var(--color-status-success)' : 'var(--color-status-critical)' }}
        >
          {up ? '▲' : '▼'} {Math.abs(price.deltaPercent).toFixed(2)}%
        </span>
        <span className="text-[10px] text-text-tertiary mt-0.5">
          ≈ {rateValue.toFixed(2)} RATE
        </span>
      </div>
    </div>
  );
}
