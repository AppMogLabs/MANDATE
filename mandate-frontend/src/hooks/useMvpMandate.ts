'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'mvp:mandate';
const DEFAULT = 'Accumulate CHIPS when prices fall below recent average. Hold COMPUTE. Sell DATA opportunistically.';

export const MVP_MANDATE_MAX = 500;

export function useMvpMandate(): {
  mandate: string;
  savedAt: number | null;
  save: (text: string) => void;
} {
  const [mandate, setMandate] = useState(DEFAULT);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as { text: string; savedAt: number };
      setMandate(parsed.text);
      setSavedAt(parsed.savedAt);
    } catch {
      /* ignore */
    }
  }, []);

  const save = (text: string) => {
    const clipped = text.slice(0, MVP_MANDATE_MAX);
    const now = Date.now();
    setMandate(clipped);
    setSavedAt(now);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ text: clipped, savedAt: now }));
    }
  };

  return { mandate, savedAt, save };
}
