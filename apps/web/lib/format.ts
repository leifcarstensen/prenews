export function formatUsdCompact(value: number | null): string {
  if (value == null || !Number.isFinite(value) || value <= 0) {
    return "n/a";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}
