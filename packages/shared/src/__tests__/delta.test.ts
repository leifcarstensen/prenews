import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { findClosestSnapshot, computeDelta, computeDeltas } from "../scoring/delta.js";

describe("findClosestSnapshot", () => {
  const snapshots = [
    { tsBucket: 1000, p: 0.5 },
    { tsBucket: 1300, p: 0.55 },
    { tsBucket: 1600, p: 0.6 },
    { tsBucket: 1900, p: 0.65 },
  ];

  it("finds the closest snapshot within tolerance", () => {
    const result = findClosestSnapshot(snapshots, 1280, 600);
    expect(result).toEqual({ tsBucket: 1300, p: 0.55 });
  });

  it("returns null when no snapshot within tolerance", () => {
    const result = findClosestSnapshot(snapshots, 5000, 600);
    expect(result).toBeNull();
  });

  it("returns the exact match if present", () => {
    const result = findClosestSnapshot(snapshots, 1600, 600);
    expect(result).toEqual({ tsBucket: 1600, p: 0.6 });
  });

  it("returns null for empty snapshots", () => {
    const result = findClosestSnapshot([], 1000, 600);
    expect(result).toBeNull();
  });
});

describe("computeDelta", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("computes delta from snapshots", () => {
    const nowEpoch = Math.floor(Date.now() / 1000);
    const snapshots = [
      { tsBucket: nowEpoch - 3600, p: 0.5 }, // 1 hour ago
      { tsBucket: nowEpoch - 300, p: 0.55 }, // 5 min ago
    ];

    const delta = computeDelta(0.6, snapshots, 1);
    expect(delta).toBeCloseTo(0.1, 5); // 0.6 - 0.5
  });

  it("returns null when no snapshot for the period", () => {
    const delta = computeDelta(0.6, [], 1);
    expect(delta).toBeNull();
  });
});

describe("computeDeltas", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("computes both 1h and 24h deltas", () => {
    const nowEpoch = Math.floor(Date.now() / 1000);
    const snapshots = [
      { tsBucket: nowEpoch - 3600, p: 0.5 }, // 1 hour ago
      { tsBucket: nowEpoch - 86400, p: 0.4 }, // 24 hours ago
    ];

    const result = computeDeltas(0.6, snapshots);
    expect(result.delta1h).toBeCloseTo(0.1, 5);
    expect(result.delta24h).toBeCloseTo(0.2, 5);
  });

  it("returns nulls for sparse snapshots", () => {
    const result = computeDeltas(0.6, []);
    expect(result.delta1h).toBeNull();
    expect(result.delta24h).toBeNull();
  });
});
