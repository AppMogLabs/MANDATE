"use client";

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  colour?: string;
}

function Sparkline({
  data,
  width = 60,
  height = 20,
  colour,
}: SparklineProps) {
  if (data.length < 2) {
    return <svg width={width} height={height} />;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const padding = 1;
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;

  const points = data
    .map((v, i) => {
      const x = padding + (i / (data.length - 1)) * innerW;
      const y = padding + innerH - ((v - min) / range) * innerH;
      return `${x},${y}`;
    })
    .join(" ");

  const trend = data[data.length - 1] - data[0];
  const resolvedColour =
    colour ??
    (trend > 0
      ? "var(--status-success)"
      : trend < 0
        ? "var(--status-critical)"
        : "var(--text-secondary)");

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="inline-block align-middle"
    >
      <polyline
        points={points}
        fill="none"
        stroke={resolvedColour}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export { Sparkline };
export type { SparklineProps };
