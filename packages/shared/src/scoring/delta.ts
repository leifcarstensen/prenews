export interface Snapshot {
  tsBucket: number;
  p: number;
}

/**
 * Find the snapshot closest to a target time within a tolerance window.
 * Returns null if no snapshot is within tolerance.
 */
export function findClosestSnapshot(
  snapshots: Snapshot[],
  targetEpoch: number,
  toleranceSec: number = 600, // 10 minutes default tolerance
): Snapshot | null {
  let best: Snapshot | null = null;
  let bestDist = Infinity;

  for (const snap of snapshots) {
    const dist = Math.abs(snap.tsBucket - targetEpoch);
    if (dist <= toleranceSec && dist < bestDist) {
      best = snap;
      bestDist = dist;
    }
  }

  return best;
}

/**
 * Compute probability delta between current and a historical snapshot.
 * Returns null if no suitable historical snapshot exists.
 */
export function computeDelta(
  currentP: number,
  snapshots: Snapshot[],
  hoursAgo: number,
  toleranceSec: number = 600,
): number | null {
  const targetEpoch = Math.floor(Date.now() / 1000) - hoursAgo * 3600;
  const historical = findClosestSnapshot(snapshots, targetEpoch, toleranceSec);

  if (historical == null) return null;
  return currentP - historical.p;
}

/**
 * Compute both 1h and 24h deltas.
 */
export function computeDeltas(
  currentP: number,
  snapshots: Snapshot[],
): { delta1h: number | null; delta24h: number | null } {
  return {
    delta1h: computeDelta(currentP, snapshots, 1),
    delta24h: computeDelta(currentP, snapshots, 24),
  };
}
