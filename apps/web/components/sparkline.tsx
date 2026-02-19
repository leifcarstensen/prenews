/**
 * Tiny inline SVG sparkline showing 7-day probability trend.
 * Pure server component — no client JS needed.
 */

interface SparklineProps {
  /** Array of probability values [0..1], oldest first */
  data: number[];
  width?: number;
  height?: number;
}

export function Sparkline({ data, width = 64, height = 24 }: SparklineProps) {
  if (data.length < 2) return null;

  const minP = Math.min(...data);
  const maxP = Math.max(...data);
  const range = maxP - minP || 0.01;
  const padding = range * 0.15;
  const yMin = Math.max(0, minP - padding);
  const yMax = Math.min(1, maxP + padding);
  const yRange = yMax - yMin;

  const toX = (i: number) => (i / (data.length - 1)) * width;
  const toY = (p: number) => height - ((p - yMin) / yRange) * height;

  const path = data
    .map((p, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(p).toFixed(1)}`)
    .join(" ");

  // Trend color: green if up over period, red if down, muted if flat
  const delta = data[data.length - 1]! - data[0]!;
  const color =
    delta > 0.005 ? "var(--color-positive, #22c55e)" :
    delta < -0.005 ? "var(--color-negative, #ef4444)" :
    "var(--color-text-muted, #888)";

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="shrink-0"
      aria-hidden="true"
    >
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
