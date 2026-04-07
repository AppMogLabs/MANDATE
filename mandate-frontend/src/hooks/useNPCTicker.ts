'use client';

import { useEffect, useRef, useState } from 'react';

const NPC_TICK_INTERVAL = 45_000; // 45 seconds
const INITIAL_DELAY = 5_000; // 5 seconds before first tick

/**
 * Triggers NPC tick on a regular interval.
 * Only active when enabled (game is loaded and player is registered).
 */
export function useNPCTicker(enabled: boolean): { tickCount: number } {
  const [tickCount, setTickCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const secret = process.env.NEXT_PUBLIC_NPC_ENGINE_SECRET;
    if (!secret) {
      return;
    }

    const fireNPCTick = async (): Promise<void> => {
      try {
        await fetch('/api/npc-tick', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${secret}`,
          },
        });
        setTickCount((prev) => prev + 1);
      } catch {
        // Silently handle fetch errors
      }
    };

    // First tick fires after a 5-second delay
    timeoutRef.current = setTimeout(() => {
      fireNPCTick();
      // Then continue on interval
      intervalRef.current = setInterval(fireNPCTick, NPC_TICK_INTERVAL);
    }, INITIAL_DELAY);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled]);

  return { tickCount };
}
