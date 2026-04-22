'use client';

import { useEffect } from 'react';
import { useMvpEvents, type MvpResource } from '@/hooks/useMvpEvents';

const RESOURCE_COLOUR: Record<MvpResource, string> = {
  COMPUTE: 'var(--color-compute)',
  CHIPS: 'var(--color-chips)',
  DATA: 'var(--color-data)',
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  const s = d.getSeconds().toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}

export default function EventsPage() {
  const { events, markRead } = useMvpEvents();

  useEffect(() => {
    markRead();
  }, [markRead]);

  return (
    <div className="pt-8">
      <div className="flex items-baseline justify-between">
        <span className="text-xs uppercase tracking-[0.15em] text-text-secondary">World Events</span>
        <span className="text-[11px] font-[family-name:var(--font-terminal)] text-text-tertiary">
          {events.length} FIRED
        </span>
      </div>

      <div className="mt-5 divide-y divide-border-default/60 font-[family-name:var(--font-terminal)]">
        {events.length === 0 && (
          <p className="text-xs text-text-tertiary py-8 text-center">
            Feed quiet. Next dispatch shortly.
          </p>
        )}
        {events.map((e) => {
          const up = e.priceImpactPercent >= 0;
          const colour = RESOURCE_COLOUR[e.affectedResource];
          return (
            <article key={e.id} className="py-3">
              <header className="flex items-center justify-between text-[10px] text-text-tertiary">
                <span>{formatTime(e.timestamp)}</span>
                <span
                  className="px-1.5 py-0.5 border rounded-sm"
                  style={{ color: colour, borderColor: colour }}
                >
                  {e.affectedResource}
                </span>
              </header>
              <p className="mt-1.5 text-sm text-moon-white leading-snug">
                {e.headline}
              </p>
              <div className="mt-1.5 flex items-center justify-between text-[11px]">
                <span className="text-text-tertiary">{e.description}</span>
                <span
                  style={{
                    color: up ? 'var(--color-status-success)' : 'var(--color-status-critical)',
                  }}
                >
                  {up ? '▲' : '▼'} {Math.abs(e.priceImpactPercent)}%
                </span>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
