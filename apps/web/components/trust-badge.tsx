const TIER_STYLES: Record<string, string> = {
  high: "bg-trust-high/10 text-trust-high",
  medium: "bg-trust-medium/10 text-trust-medium",
  low: "bg-trust-low/10 text-trust-low",
};

export function TrustBadge({ tier }: { tier: string }) {
  const style = TIER_STYLES[tier] ?? TIER_STYLES.low;
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${style}`}
    >
      {tier}
    </span>
  );
}
