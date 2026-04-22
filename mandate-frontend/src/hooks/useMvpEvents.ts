'use client';

import { useCallback, useEffect, useState } from 'react';
import eventsData from '@/data/mvp-events.json';

export type MvpResource = 'COMPUTE' | 'CHIPS' | 'DATA';

export interface MvpEvent {
  readonly id: string;
  readonly headline: string;
  readonly affectedResource: MvpResource;
  readonly priceImpactPercent: number;
  readonly description: string;
  readonly timestamp: number;
}

interface RawEvent {
  id: string;
  headline: string;
  affectedResource: string;
  priceImpactPercent: number;
  description: string;
}

const STORAGE_KEY = 'mvp:events:firedAt';
const READ_KEY = 'mvp:events:lastRead';
const FIRE_INTERVAL_MS = 20 * 60 * 1000;
const CHECK_INTERVAL_MS = 5_000;

/**
 * Drip-fires seeded events from first boot. SSR-safe: returns an empty feed
 * on the server, then populates on client mount.
 */
export function useMvpEvents(): {
  events: readonly MvpEvent[];
  latest: MvpEvent | null;
  unreadCount: number;
  markRead: () => void;
} {
  const raw = eventsData as RawEvent[];
  const [fired, setFired] = useState<MvpEvent[]>([]);
  const [lastReadIndex, setLastReadIndex] = useState(0);

  useEffect(() => {
    let start: number;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      start = parseInt(stored, 10);
    } else {
      start = Date.now();
      window.localStorage.setItem(STORAGE_KEY, String(start));
    }

    const storedRead = window.localStorage.getItem(READ_KEY);
    if (storedRead) setLastReadIndex(parseInt(storedRead, 10));

    const compute = (): MvpEvent[] => {
      const elapsed = Date.now() - start;
      const count = Math.min(raw.length, Math.floor(elapsed / FIRE_INTERVAL_MS) + 1);
      return raw.slice(0, count).map((e, i) => ({
        id: e.id,
        headline: e.headline,
        affectedResource: e.affectedResource as MvpResource,
        priceImpactPercent: e.priceImpactPercent,
        description: e.description,
        timestamp: start + i * FIRE_INTERVAL_MS,
      }));
    };

    setFired(compute());
    const h = setInterval(() => setFired(compute()), CHECK_INTERVAL_MS);
    return () => clearInterval(h);
  }, [raw]);

  const events = [...fired].reverse();
  const unreadCount = Math.max(0, fired.length - lastReadIndex);

  const markRead = useCallback(() => {
    setLastReadIndex(fired.length);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(READ_KEY, String(fired.length));
    }
  }, [fired.length]);

  return {
    events,
    latest: events[0] ?? null,
    unreadCount,
    markRead,
  };
}
