'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'mvp:epoch:startedAt';
const EPOCH_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Client-side epoch timer for MVP. Seven days from first boot, stored in
 * localStorage. On-chain epoch contract will replace this in a later
 * iteration (see MvpEpoch.sol plan).
 *
 * SSR-safe: initial render returns zeros so server HTML matches first client
 * paint. Real values populate on mount.
 */
export function useMvpEpoch(): {
  startedAt: number;
  endsAt: number;
  remainingMs: number;
  isOver: boolean;
  hydrated: boolean;
} {
  const [startedAt, setStartedAt] = useState<number>(0);
  const [now, setNow] = useState<number>(0);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let start: number;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      start = parseInt(stored, 10);
    } else {
      start = Date.now();
      window.localStorage.setItem(STORAGE_KEY, String(start));
    }
    setStartedAt(start);
    setNow(Date.now());
    setHydrated(true);

    const h = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(h);
  }, []);

  const endsAt = startedAt ? startedAt + EPOCH_MS : 0;
  const remainingMs = hydrated ? Math.max(0, endsAt - now) : 0;

  return {
    startedAt,
    endsAt,
    remainingMs,
    isOver: hydrated && remainingMs <= 0,
    hydrated,
  };
}

export function formatRemaining(ms: number): string {
  if (ms <= 0) return '—';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
