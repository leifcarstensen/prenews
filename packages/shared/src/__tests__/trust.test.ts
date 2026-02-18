import { describe, it, expect } from "vitest";
import { computeTrustScore, computeTrustTier } from "../scoring/trust.js";

describe("computeTrustScore", () => {
  it("returns positive score for high volume and liquidity", () => {
    const score = computeTrustScore({
      volume24h: 500000,
      liquidity: 200000,
      spread: 0.02,
    });
    expect(score).toBeGreaterThan(0);
  });

  it("returns lower score for thin markets", () => {
    const thick = computeTrustScore({
      volume24h: 500000,
      liquidity: 200000,
      spread: 0.02,
    });
    const thin = computeTrustScore({
      volume24h: 100,
      liquidity: 50,
      spread: 0.15,
    });
    expect(thick).toBeGreaterThan(thin);
  });

  it("penalizes wide spreads", () => {
    const narrow = computeTrustScore({
      volume24h: 10000,
      liquidity: 5000,
      spread: 0.01,
    });
    const wide = computeTrustScore({
      volume24h: 10000,
      liquidity: 5000,
      spread: 0.20,
    });
    expect(narrow).toBeGreaterThan(wide);
  });

  it("uses default spread penalty when spread is null", () => {
    const score = computeTrustScore({
      volume24h: 10000,
      liquidity: 5000,
      spread: null,
    });
    expect(score).toBeGreaterThan(0);
  });
});

describe("computeTrustTier", () => {
  it("returns 'high' for well-traded markets", () => {
    const tier = computeTrustTier({
      volume24h: 500000,
      liquidity: 200000,
      spread: 0.01,
    });
    expect(tier).toBe("high");
  });

  it("returns 'low' when volume and liquidity are both null", () => {
    const tier = computeTrustTier({
      volume24h: null,
      liquidity: null,
      spread: 0.02,
    });
    expect(tier).toBe("low");
  });

  it("returns 'medium' for moderate markets", () => {
    const tier = computeTrustTier({
      volume24h: 5000,
      liquidity: 2000,
      spread: 0.05,
    });
    expect(tier).toBe("medium");
  });

  it("returns 'low' for very thin markets", () => {
    const tier = computeTrustTier({
      volume24h: 10,
      liquidity: 5,
      spread: 0.30,
    });
    expect(tier).toBe("low");
  });
});
