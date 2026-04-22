'use client';

import { useMemo } from 'react';
import { useOrderBook } from '@/hooks/chain/useOrderBook';
import { useMvpEvents, type MvpResource } from '@/hooks/useMvpEvents';

const BASE_PRICE: Record<MvpResource, number> = {
  COMPUTE: 1.2,
  CHIPS: 2.1,
  DATA: 1.8,
};

export interface ResourcePrice {
  readonly resource: MvpResource;
  readonly price: number;
  readonly basePrice: number;
  readonly deltaPercent: number;
  readonly isLive: boolean;
  readonly history: readonly number[];
}

const RES: MvpResource[] = ['COMPUTE', 'CHIPS', 'DATA'];
const HIST_POINTS = 24;

/**
 * Combines OrderBook live prices with cumulative event impact modifiers to
 * produce the displayed price per resource. When OrderBook has no recent
 * trade for a resource, falls back to BASE_PRICE * event modifier.
 *
 * Also derives a 24-point sparkline history for each resource by walking the
 * fired-event timeline and applying impacts cumulatively.
 */
export function useMvpMarket(): {
  prices: Record<MvpResource, ResourcePrice>;
  isLive: boolean;
} {
  const { snapshots, isLive } = useOrderBook();
  const { events } = useMvpEvents();

  return useMemo(() => {
    const modifier: Record<MvpResource, number> = { COMPUTE: 1, CHIPS: 1, DATA: 1 };
    for (const e of [...events].reverse()) {
      if (!(e.affectedResource in modifier)) continue;
      modifier[e.affectedResource] *= 1 + e.priceImpactPercent / 100;
    }

    const liveFromBook = (r: MvpResource): number | null => {
      const snap = snapshots.find((s) => s.pair === `${r}/RATE`);
      if (!snap) return null;
      if (snap.lastTradePrice > 0) return snap.lastTradePrice;
      const ask = snap.asks?.[0]?.price;
      const bid = snap.bids?.[0]?.price;
      if (ask && bid) return (ask + bid) / 2;
      return ask ?? bid ?? null;
    };

    const prices: Record<MvpResource, ResourcePrice> = {} as never;

    for (const resource of RES) {
      const book = liveFromBook(resource);
      const base = BASE_PRICE[resource];
      const price = book ?? base * modifier[resource];
      const deltaPercent = ((price - base) / base) * 100;

      // Build sparkline history by replaying event impacts in chronological
      // order, spaced evenly across HIST_POINTS.
      const chron = [...events].reverse();
      const mod: number[] = [];
      let running = 1;
      for (const e of chron) {
        if (e.affectedResource === resource) {
          running *= 1 + e.priceImpactPercent / 100;
        }
        mod.push(running);
      }
      const padded = mod.length >= HIST_POINTS ? mod.slice(-HIST_POINTS) : [
        ...Array(HIST_POINTS - mod.length).fill(1),
        ...mod,
      ];
      const history = padded.map((m) => base * m);

      prices[resource] = {
        resource,
        price,
        basePrice: base,
        deltaPercent,
        isLive: book !== null,
        history,
      };
    }

    return { prices, isLive };
  }, [snapshots, isLive, events]);
}
