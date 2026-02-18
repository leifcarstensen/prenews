import { describe, it, expect } from "vitest";
import {
  computeConfidence,
  computeUrgency,
  computeLikelyScore,
  computeMovedScore,
} from "../scoring/feeds.js";

describe("computeConfidence", () => {
  it("returns 0 at 50%", () => {
    expect(computeConfidence(0.5)).toBe(0);
  });

  it("returns 1 at 100%", () => {
    expect(computeConfidence(1.0)).toBe(1);
  });

  it("returns 1 at 0%", () => {
    expect(computeConfidence(0.0)).toBe(1);
  });

  it("returns 0.8 at 90%", () => {
    expect(computeConfidence(0.9)).toBeCloseTo(0.8, 5);
  });

  it("is symmetric", () => {
    expect(computeConfidence(0.3)).toBeCloseTo(computeConfidence(0.7), 5);
  });
});

describe("computeUrgency", () => {
  it("returns 1.0 for resolving within 1 day", () => {
    expect(computeUrgency(0.5)).toBe(1.0);
  });

  it("returns 0.8 for resolving within 7 days", () => {
    expect(computeUrgency(5)).toBe(0.8);
  });

  it("returns 0.5 for resolving within 30 days", () => {
    expect(computeUrgency(20)).toBe(0.5);
  });

  it("returns 0.3 for distant resolution", () => {
    expect(computeUrgency(60)).toBe(0.3);
  });

  it("returns 0.3 for null resolution date", () => {
    expect(computeUrgency(null)).toBe(0.3);
  });

  it("returns 0.1 for already resolved", () => {
    expect(computeUrgency(-1)).toBe(0.1);
  });
});

describe("computeLikelyScore", () => {
  it("scores higher for urgent + confident + trusted markets", () => {
    const high = computeLikelyScore({
      p: 0.95,
      daysUntilResolution: 1,
      trustTier: "high",
    });
    const low = computeLikelyScore({
      p: 0.55,
      daysUntilResolution: 60,
      trustTier: "low",
    });
    expect(high).toBeGreaterThan(low);
  });

  it("returns 0 for 50% probability (no confidence)", () => {
    const score = computeLikelyScore({
      p: 0.5,
      daysUntilResolution: 1,
      trustTier: "high",
    });
    expect(score).toBe(0);
  });
});

describe("computeMovedScore", () => {
  it("scores higher for large moves with high trust", () => {
    const big = computeMovedScore({
      absDelta: 0.15,
      trustTier: "high",
      daysUntilResolution: 5,
    });
    const small = computeMovedScore({
      absDelta: 0.02,
      trustTier: "low",
      daysUntilResolution: 60,
    });
    expect(big).toBeGreaterThan(small);
  });

  it("returns 0 for zero movement", () => {
    const score = computeMovedScore({
      absDelta: 0,
      trustTier: "high",
      daysUntilResolution: 1,
    });
    expect(score).toBe(0);
  });
});
