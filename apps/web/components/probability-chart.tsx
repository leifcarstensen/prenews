"use client";

interface Snapshot {
  tsBucket: number;
  p: number;
}

export function ProbabilityChart({ snapshots }: { snapshots: Snapshot[] }) {
  if (snapshots.length < 2) {
    return (
      <div className="flex h-48 items-center justify-center rounded-[10px] border border-border bg-card text-sm text-text-muted">
        Not enough data for chart
      </div>
    );
  }

  const sorted = [...snapshots].sort((a, b) => a.tsBucket - b.tsBucket);
  const minP = Math.min(...sorted.map((s) => s.p));
  const maxP = Math.max(...sorted.map((s) => s.p));
  const padding = Math.max((maxP - minP) * 0.1, 0.02);
  const yMin = Math.max(0, minP - padding);
  const yMax = Math.min(1, maxP + padding);

  const width = 600;
  const height = 200;
  const marginLeft = 40;
  const marginRight = 10;
  const marginTop = 10;
  const marginBottom = 24;
  const plotWidth = width - marginLeft - marginRight;
  const plotHeight = height - marginTop - marginBottom;

  const tMin = sorted[0]!.tsBucket;
  const tMax = sorted[sorted.length - 1]!.tsBucket;
  const tRange = tMax - tMin || 1;

  const toX = (t: number) => marginLeft + ((t - tMin) / tRange) * plotWidth;
  const toY = (p: number) => marginTop + (1 - (p - yMin) / (yMax - yMin)) * plotHeight;

  const linePath = sorted
    .map((s, i) => `${i === 0 ? "M" : "L"} ${toX(s.tsBucket).toFixed(1)} ${toY(s.p).toFixed(1)}`)
    .join(" ");

  const areaPath =
    linePath +
    ` L ${toX(tMax).toFixed(1)} ${(marginTop + plotHeight).toFixed(1)}` +
    ` L ${toX(tMin).toFixed(1)} ${(marginTop + plotHeight).toFixed(1)} Z`;

  // Y-axis labels
  const yTicks = 5;
  const yLabels = Array.from({ length: yTicks }, (_, i) => {
    const p = yMin + ((yMax - yMin) * i) / (yTicks - 1);
    return { p, y: toY(p) };
  });

  return (
    <div className="rounded-[10px] border border-border bg-card p-4">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img" aria-label="Probability chart">
        {/* Grid lines */}
        {yLabels.map(({ p, y }) => (
          <g key={p}>
            <line
              x1={marginLeft}
              y1={y}
              x2={width - marginRight}
              y2={y}
              stroke="var(--color-border-subtle)"
              strokeWidth={1}
            />
            <text
              x={marginLeft - 6}
              y={y + 3}
              textAnchor="end"
              fill="var(--color-text-muted)"
              fontSize={10}
              fontFamily="system-ui"
            >
              {Math.round(p * 100)}%
            </text>
          </g>
        ))}

        {/* Area fill */}
        <path d={areaPath} fill="var(--color-accent)" opacity={0.08} />

        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Current point */}
        <circle
          cx={toX(sorted[sorted.length - 1]!.tsBucket)}
          cy={toY(sorted[sorted.length - 1]!.p)}
          r={3}
          fill="var(--color-accent)"
        />
      </svg>
    </div>
  );
}
