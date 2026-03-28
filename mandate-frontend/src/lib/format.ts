export function formatNumber(n: number, decimals = 2): string {
  if (Math.abs(n) >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(decimals)}M`;
  }
  if (Math.abs(n) >= 1_000) {
    return `${(n / 1_000).toFixed(decimals)}K`;
  }
  return n.toFixed(decimals);
}

export function formatPrice(n: number): string {
  return n.toFixed(4);
}

export function formatPercent(n: number): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

export function formatBigint(n: string, decimals = 18): string {
  const str = n.padStart(decimals + 1, "0");
  const wholePart = str.slice(0, str.length - decimals) || "0";
  const fracPart = str.slice(str.length - decimals, str.length - decimals + 2);
  const whole = Number(wholePart).toLocaleString();
  return `${whole}.${fracPart}`;
}

export function formatTimestamp(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function formatCountdown(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${d.toString().padStart(2, "0")}:${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
