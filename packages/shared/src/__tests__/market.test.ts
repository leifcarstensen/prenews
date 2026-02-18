import { describe, it, expect } from "vitest";
import { computeTsBucket } from "../schemas/market.js";

describe("computeTsBucket", () => {
  it("rounds to 300s windows", () => {
    // 1704999900 is divisible by 300 (1704999900 / 300 = 5683333)
    const date = new Date(1704999900 * 1000);
    expect(computeTsBucket(date)).toBe(1704999900);
  });

  it("rounds down to nearest 300s boundary", () => {
    const date = new Date(1705000050 * 1000); // 150s past the 1704999900 boundary
    expect(computeTsBucket(date)).toBe(1704999900);
  });

  it("handles current time", () => {
    const bucket = computeTsBucket();
    expect(bucket % 300).toBe(0);
    expect(bucket).toBeLessThanOrEqual(Math.floor(Date.now() / 1000));
  });
});
