"use client";

import { useState, useMemo } from "react";

interface Snapshot {
  tsBucket: number;
  p: number;
}

type TimeRange = "24h" | "7d" | "30d" | "all";

const RANGE_CONFIG: Record<TimeRange, { label: string; seconds: number | null }> = {
  "24h": { label: "24h", seconds: 24 * 3600 },
  "7d": { label: "7d", seconds: 7 * 24 * 3600 },
  "30d": { label: "30d", seconds: 30 * 24 * 3600 },
  "all": { label: "All", seconds: null },
};

export function ProbabilityChart({ snapshots }: { snapshots: Snapshot[] }) {
  const [range, setRange] = useState<TimeRange>("7d");

  const filtered = useMemo(() => {
    const sorted = [...snapshots].sort((a, b) => a.tsBucket - b.tsBucket);
    const config = RANGE_CONFIG[range];
    if (!config.seconds) return sorted;

    const cutoff = Math.floor(Date.now() / 1000) - config.seconds;
    return sorted.filter((s) => s.tsBucket >= cutoff);
  }, [snapshots, range]);

  if (filtered.length < 2) {
    return (
      <div className="rounded-[10px] border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <TimeRangeButtons range={range} onChange={setRange} />
        </div>
        <div className="flex h-40 items-center justify-center text-sm text-text-muted">
          Not enough data for this time range
        </div>
      </div>
    );
  }

  const minP = Math.min(...filtered.map((s) => s.p));
  const maxP = Math.max(...filtered.map((s) => s.p));
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

  const tMin = filtered[0]!.tsBucket;
  const tMax = filtered[filtered.length - 1]!.tsBucket;
  const tRange = tMax - tMin || 1;

  const toX = (t: number) => marginLeft + ((t - tMin) / tRange) * plotWidth;
  const toY = (p: number) => marginTop + (1 - (p - yMin) / (yMax - yMin)) * plotHeight;

  const linePath = filtered
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
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Probability</span>
        <TimeRangeButtons range={range} onChange={setRange} />
      </div>
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
          cx={toX(filtered[filtered.length - 1]!.tsBucket)}
          cy={toY(filtered[filtered.length - 1]!.p)}
          r={3}
          fill="var(--color-accent)"
        />
      </svg>
    </div>
  );
}

function TimeRangeButtons({
  range,
  onChange,
}: {
  range: TimeRange;
  onChange: (r: TimeRange) => void;
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-md border border-border bg-bg p-0.5">
      {(Object.entries(RANGE_CONFIG) as [TimeRange, { label: string }][]).map(([key, { label }]) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
            range === key
              ? "bg-card text-text shadow-sm"
              : "text-text-muted hover:text-text"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
