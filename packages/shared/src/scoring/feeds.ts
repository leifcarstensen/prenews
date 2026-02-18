import type { TrustTier } from "../types.js";

export interface LikelyScoreInput {
  /** Probability of "yes" outcome (0-1) */
  p: number;
  /** Days until resolution, null if unknown */
  daysUntilResolution: number | null;
  /** Trust tier */
  trustTier: TrustTier;
}

export interface MovedScoreInput {
  /** Absolute delta (use max of |delta1h|, |delta24h|) */
  absDelta: number;
  /** Trust tier */
  trustTier: TrustTier;
  /** Days until resolution, null if unknown */
  daysUntilResolution: number | null;
}

const TRUST_MULTIPLIERS: Record<TrustTier, number> = {
  high: 1.0,
  medium: 0.7,
  low: 0.3,
};

/**
 * Confidence: how far from 50% the probability is.
 * p=0.95 -> high confidence, p=0.5 -> low confidence
 */
export function computeConfidence(p: number): number {
  return Math.abs(p - 0.5) * 2; // 0 at 50%, 1 at 0% or 100%
}

/**
 * Urgency: how soon the market resolves.
 * Closer resolution = higher urgency.
 */
export function computeUrgency(daysUntilResolution: number | null): number {
  if (daysUntilResolution == null) return 0.3; // unknown: low urgency
  if (daysUntilResolution <= 0) return 0.1; // already resolved: very low
  if (daysUntilResolution <= 1) return 1.0;
  if (daysUntilResolution <= 7) return 0.8;
  if (daysUntilResolution <= 30) return 0.5;
  return 0.3;
}

/**
 * Likely feed score: urgency * confidence * trust
 */
export function computeLikelyScore(input: LikelyScoreInput): number {
  const confidence = computeConfidence(input.p);
  const urgency = computeUrgency(input.daysUntilResolution);
  const trust = TRUST_MULTIPLIERS[input.trustTier];
  return urgency * confidence * trust;
}

/**
 * Moved feed score: movement * trust * (0.5 + 0.5 * urgency)
 */
export function computeMovedScore(input: MovedScoreInput): number {
  const urgency = computeUrgency(input.daysUntilResolution);
  const trust = TRUST_MULTIPLIERS[input.trustTier];
  return input.absDelta * trust * (0.5 + 0.5 * urgency);
}
