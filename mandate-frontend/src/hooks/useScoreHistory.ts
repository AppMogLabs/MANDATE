'use client';

import { useEffect, useRef, useState } from 'react';
import { saveScore, get24hDelta, getSparklineData, getSessionStartSnapshot, type ScoreSnapshot } from '@/lib/score-history';
import type { AGIScoreResult } from '@/lib/scoring';

interface ScoreHistoryOutput {
  delta24h: number | null;
  sessionDelta: number | null;
  sparkline: number[];
}

export function useScoreHistory(
  score: AGIScoreResult | null,
  rateBalance: number,
): ScoreHistoryOutput {
  const [delta24h, setDelta24h] = useState<number | null>(null);
  const [sessionDelta, setSessionDelta] = useState<number | null>(null);
  const [sparkline, setSparkline] = useState<number[]>([]);
  const sessionStartRef = useRef<ScoreSnapshot | null>(null);

  // Capture session start on mount
  useEffect(() => {
    sessionStartRef.current = getSessionStartSnapshot();
  }, []);

  // Save score periodically and update deltas
  useEffect(() => {
    if (!score) return;

    const snapshot: ScoreSnapshot = {
      ts: Date.now(),
      score: score.total,
      rateBalance,
      components: {
        resources: score.resources,
        buildings: score.buildings,
        intelligence: score.intelligence,
        chain: score.chain,
      },
    };

    saveScore(snapshot);
    setDelta24h(get24hDelta(score.total));
    setSparkline(getSparklineData(24));

    if (sessionStartRef.current) {
      setSessionDelta(score.total - sessionStartRef.current.score);
    }
  }, [score, rateBalance]);

  return { delta24h, sessionDelta, sparkline };
}
