const STORAGE_KEY = 'mandate-score-history';
const MAX_AGE_MS = 48 * 60 * 60 * 1000; // 48 hours

export interface ScoreSnapshot {
  ts: number;
  score: number;
  rateBalance: number;
  components: {
    resources: number;
    buildings: number;
    intelligence: number;
    chain: number;
  };
}

export function loadHistory(): ScoreSnapshot[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ScoreSnapshot[];
  } catch {
    return [];
  }
}

export function saveScore(snapshot: ScoreSnapshot): void {
  if (typeof window === 'undefined') return;
  try {
    const history = loadHistory();
    history.push(snapshot);
    // Prune entries older than 48h
    const cutoff = Date.now() - MAX_AGE_MS;
    const pruned = history.filter(s => s.ts >= cutoff);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pruned));
  } catch {
    // localStorage full or unavailable — silently fail
  }
}

export function getSessionStartSnapshot(): ScoreSnapshot | null {
  const history = loadHistory();
  if (history.length === 0) return null;
  return history[history.length - 1];
}

export function get24hDelta(currentScore: number): number | null {
  const history = loadHistory();
  if (history.length === 0) return null;

  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  // Find the oldest entry within the last 24h
  const oldest24h = history.find(s => s.ts >= cutoff);
  if (!oldest24h) return null;

  return currentScore - oldest24h.score;
}

export function getSparklineData(hoursBack = 24): number[] {
  const history = loadHistory();
  if (history.length < 2) return [];

  const cutoff = Date.now() - hoursBack * 60 * 60 * 1000;
  return history
    .filter(s => s.ts >= cutoff)
    .map(s => s.score);
}
