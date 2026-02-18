export function DeltaBadge({ text }: { text: string | null }) {
  if (!text) return null;

  const isPositive = text.startsWith("+");
  const isNegative = text.startsWith("-");

  let colorClass = "text-text-muted bg-border-subtle";
  if (isPositive) colorClass = "text-up bg-up-bg";
  if (isNegative) colorClass = "text-down bg-down-bg";

  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium tabular-nums ${colorClass}`}
    >
      {text}
    </span>
  );
}
