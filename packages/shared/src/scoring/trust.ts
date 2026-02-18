import type { TrustTier } from "../types.js";

export interface TrustConfig {
  w1: number; // volume weight
  w2: number; // liquidity weight
  w3: number; // spread penalty weight
  thresholds: {
    high: number;
    medium: number;
  };
}

const DEFAULT_TRUST_CONFIG: TrustConfig = {
  w1: 1.0,
  w2: 0.8,
  w3: 2.0,
  thresholds: {
    high: 15.0,
    medium: 6.0,
  },
};

export interface TrustInput {
  volume24h: number | null;
  liquidity: number | null;
  spread: number | null;
}

export function computeTrustScore(
  input: TrustInput,
  config: TrustConfig = DEFAULT_TRUST_CONFIG,
): number {
  const volume = input.volume24h ?? 0;
  const liquidity = input.liquidity ?? 0;
  const spreadPenalty = input.spread != null ? input.spread : 0.5; // default penalty for unknown spread

  return (
    config.w1 * Math.log1p(volume) +
    config.w2 * Math.log1p(liquidity) -
    config.w3 * spreadPenalty
  );
}

export function computeTrustTier(
  input: TrustInput,
  config: TrustConfig = DEFAULT_TRUST_CONFIG,
): TrustTier {
  // If volume and liquidity are both missing, degrade to low
  if (input.volume24h == null && input.liquidity == null) {
    return "low";
  }

  const score = computeTrustScore(input, config);

  if (score >= config.thresholds.high) return "high";
  if (score >= config.thresholds.medium) return "medium";
  return "low";
}
