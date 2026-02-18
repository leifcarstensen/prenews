/**
 * Generate a URL-safe slug from a title string.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

/**
 * Compute mid price from best bid and best ask.
 */
export function computeMidPrice(bestBid: number, bestAsk: number): number {
  return (bestBid + bestAsk) / 2;
}

/**
 * Compute spread from best bid and best ask.
 */
export function computeSpread(bestBid: number, bestAsk: number): number {
  return bestAsk - bestBid;
}

/**
 * Clamp a probability to [0, 1] range.
 */
export function clampProb(p: number): number {
  return Math.max(0, Math.min(1, p));
}

/**
 * Format probability as a display string (e.g., "73%").
 */
export function formatProbability(p: number): string {
  return `${Math.round(p * 100)}%`;
}

/**
 * Format delta as a display string (e.g., "+12 pts", "-5 pts").
 */
export function formatDelta(delta: number | null): string | null {
  if (delta == null) return null;
  const pts = Math.round(delta * 100);
  const sign = pts >= 0 ? "+" : "";
  return `${sign}${pts} pts`;
}

/**
 * Format "resolves in" as a human-readable string.
 */
export function formatResolvesIn(resolvesAt: Date | null): string {
  if (resolvesAt == null) return "Unknown";

  const now = new Date();
  const diffMs = resolvesAt.getTime() - now.getTime();

  if (diffMs <= 0) return "Resolved";

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor(diffMs / (1000 * 60 * 60));

  if (days > 30) return `${Math.floor(days / 30)} months`;
  if (days > 1) return `${days} days`;
  if (days === 1) return "1 day";
  if (hours > 1) return `${hours} hours`;
  return "< 1 hour";
}

/**
 * Generate a movement note using templates (no LLM needed).
 */
export function generateMovementNote(params: {
  delta24h: number | null;
  delta1h: number | null;
  p: number;
  resolvesAt: Date | null;
}): string {
  const parts: string[] = [];

  if (params.delta24h != null) {
    const pts = Math.round(params.delta24h * 100);
    const sign = pts >= 0 ? "+" : "";
    parts.push(`repriced ${sign}${pts} pts in 24h`);
  } else if (params.delta1h != null) {
    const pts = Math.round(params.delta1h * 100);
    const sign = pts >= 0 ? "+" : "";
    parts.push(`repriced ${sign}${pts} pts in 1h`);
  }

  parts.push(`now ${formatProbability(params.p)}`);

  if (params.resolvesAt != null) {
    parts.push(`resolves in ${formatResolvesIn(params.resolvesAt)}`);
  }

  return parts.join("; ") + ".";
}
