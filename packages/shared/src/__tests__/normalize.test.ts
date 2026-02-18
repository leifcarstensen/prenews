import { describe, it, expect } from "vitest";
import {
  slugify,
  computeMidPrice,
  computeSpread,
  clampProb,
  formatProbability,
  formatDelta,
  formatResolvesIn,
  generateMovementNote,
} from "../utils/normalize.js";

describe("slugify", () => {
  it("converts spaces to hyphens", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("removes special characters", () => {
    expect(slugify("What's the Price?")).toBe("whats-the-price");
  });

  it("collapses multiple hyphens", () => {
    expect(slugify("a -- b --- c")).toBe("a-b-c");
  });

  it("truncates to 120 chars", () => {
    const long = "a".repeat(200);
    expect(slugify(long).length).toBeLessThanOrEqual(120);
  });
});

describe("computeMidPrice", () => {
  it("computes midpoint", () => {
    expect(computeMidPrice(0.45, 0.55)).toBe(0.5);
  });
});

describe("computeSpread", () => {
  it("computes spread", () => {
    expect(computeSpread(0.45, 0.55)).toBeCloseTo(0.1, 5);
  });
});

describe("clampProb", () => {
  it("clamps to 0", () => {
    expect(clampProb(-0.1)).toBe(0);
  });

  it("clamps to 1", () => {
    expect(clampProb(1.5)).toBe(1);
  });

  it("passes through valid values", () => {
    expect(clampProb(0.75)).toBe(0.75);
  });
});

describe("formatProbability", () => {
  it("formats as percentage", () => {
    expect(formatProbability(0.73)).toBe("73%");
  });

  it("rounds to nearest integer", () => {
    expect(formatProbability(0.736)).toBe("74%");
  });
});

describe("formatDelta", () => {
  it("formats positive delta", () => {
    expect(formatDelta(0.12)).toBe("+12 pts");
  });

  it("formats negative delta", () => {
    expect(formatDelta(-0.05)).toBe("-5 pts");
  });

  it("returns null for null", () => {
    expect(formatDelta(null)).toBeNull();
  });
});

describe("formatResolvesIn", () => {
  it("returns 'Resolved' for past dates", () => {
    expect(formatResolvesIn(new Date("2020-01-01"))).toBe("Resolved");
  });

  it("returns 'Unknown' for null", () => {
    expect(formatResolvesIn(null)).toBe("Unknown");
  });
});

describe("generateMovementNote", () => {
  it("generates note with 24h delta", () => {
    const note = generateMovementNote({
      delta24h: 0.12,
      delta1h: 0.03,
      p: 0.71,
      resolvesAt: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
    });
    expect(note).toContain("+12 pts in 24h");
    expect(note).toContain("now 71%");
    expect(note).toContain("resolves in");
  });

  it("falls back to 1h delta when 24h is null", () => {
    const note = generateMovementNote({
      delta24h: null,
      delta1h: -0.05,
      p: 0.60,
      resolvesAt: null,
    });
    expect(note).toContain("-5 pts in 1h");
    expect(note).toContain("now 60%");
  });
});
