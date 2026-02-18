import { db } from "../db/connection.js";
import { market, marketState, marketSnapshot, feedItem } from "../db/schema.js";
import {
  computeLikelyScore,
  computeMovedScore,
  computeDeltas,
  type TrustTier,
  type FeedType,
} from "@prenews/shared";
import { eq, and, sql, gte, desc } from "drizzle-orm";

const FEED_SIZE = 200;

interface FeedBuildResult {
  likely: number;
  moved: number;
}

export async function feedBuildJob(): Promise<FeedBuildResult> {
  const startTime = Date.now();
  const now = new Date();

  // Fetch all active markets with their current state
  const marketsWithState = await db
    .select({
      id: market.id,
      status: market.status,
      resolvesAt: market.resolvesAt,
      headline: market.headline,
      marketId: marketState.marketId,
      p: marketState.p,
      volume24h: marketState.volume24h,
      liquidity: marketState.liquidity,
      spread: marketState.spread,
      trustTier: marketState.trustTier,
    })
    .from(market)
    .innerJoin(marketState, eq(market.id, marketState.marketId))
    .where(eq(market.status, "active"));

  // Get recent snapshots for delta computation (last 25 hours)
  const snapshotCutoff = Math.floor(Date.now() / 1000) - 25 * 3600;
  const recentSnapshots = await db
    .select({
      marketId: marketSnapshot.marketId,
      tsBucket: marketSnapshot.tsBucket,
      p: marketSnapshot.p,
    })
    .from(marketSnapshot)
    .where(gte(marketSnapshot.tsBucket, snapshotCutoff));

  // Group snapshots by market
  const snapshotsByMarket = new Map<string, Array<{ tsBucket: number; p: number }>>();
  for (const snap of recentSnapshots) {
    const list = snapshotsByMarket.get(snap.marketId) || [];
    list.push({ tsBucket: snap.tsBucket, p: snap.p });
    snapshotsByMarket.set(snap.marketId, list);
  }

  // Compute scores
  interface ScoredMarket {
    marketId: string;
    likelyScore: number;
    movedScore: number;
    delta1h: number | null;
    delta24h: number | null;
    trustTier: TrustTier;
  }

  const scored: ScoredMarket[] = [];

  for (const m of marketsWithState) {
    const snapshots = snapshotsByMarket.get(m.id) || [];
    const deltas = computeDeltas(m.p, snapshots);

    const daysUntilResolution = m.resolvesAt
      ? (m.resolvesAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      : null;

    const trustTier = (m.trustTier as TrustTier) || "low";

    const likelyScore = computeLikelyScore({
      p: m.p,
      daysUntilResolution,
      trustTier,
    });

    const absDelta = Math.max(
      Math.abs(deltas.delta1h ?? 0),
      Math.abs(deltas.delta24h ?? 0),
    );

    const movedScore = (deltas.delta1h != null || deltas.delta24h != null)
      ? computeMovedScore({ absDelta, trustTier, daysUntilResolution })
      : 0;

    scored.push({
      marketId: m.id,
      likelyScore,
      movedScore,
      delta1h: deltas.delta1h,
      delta24h: deltas.delta24h,
      trustTier,
    });
  }

  // Build likely feed: sort by likelyScore desc, exclude low trust
  const likelyItems = scored
    .filter((m) => m.trustTier !== "low")
    .sort((a, b) => b.likelyScore - a.likelyScore)
    .slice(0, FEED_SIZE);

  // Build moved feed: sort by movedScore desc, exclude low trust, exclude zero movement
  const movedItems = scored
    .filter((m) => m.trustTier !== "low" && m.movedScore > 0)
    .sort((a, b) => b.movedScore - a.movedScore)
    .slice(0, FEED_SIZE);

  // Write feeds in transactions
  const likelyCount = await writeFeed("likely", likelyItems, now);
  const movedCount = await writeFeed("moved", movedItems, now);

  const duration = Date.now() - startTime;
  console.log(JSON.stringify({
    job: "feed-build",
    likely: likelyCount,
    moved: movedCount,
    duration_ms: duration,
  }));

  return { likely: likelyCount, moved: movedCount };
}

async function writeFeed(
  feed: FeedType,
  items: Array<{ marketId: string; likelyScore: number; movedScore: number }>,
  computedAt: Date,
): Promise<number> {
  // Delete + insert in transaction
  await db.transaction(async (tx) => {
    await tx.delete(feedItem).where(eq(feedItem.feed, feed));

    if (items.length > 0) {
      const rows = items.map((item, idx) => ({
        feed,
        rank: idx + 1,
        marketId: item.marketId,
        score: feed === "likely" ? item.likelyScore : item.movedScore,
        computedAt,
      }));

      await tx.insert(feedItem).values(rows);
    }
  });

  return items.length;
}
