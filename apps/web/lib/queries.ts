import { db } from "./db";
import { eq, and, desc, asc, gte, lte, ilike, ne, sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  doublePrecision,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { inferNewsCategory, type NewsCategory } from "./categories";

// Re-declare tables for the web app (avoids importing from worker)
const market = pgTable("market", {
  id: uuid("id").defaultRandom().primaryKey(),
  source: varchar("source", { length: 32 }).notNull(),
  sourceMarketId: varchar("source_market_id", { length: 256 }).notNull(),
  slug: varchar("slug", { length: 256 }).notNull(),
  titleRaw: text("title_raw").notNull(),
  headline: text("headline"),
  articleBody: text("article_body"),
  articleMetaDescription: varchar("article_meta_description", { length: 320 }),
  articleImageUrl: text("article_image_url"),
  category: varchar("category", { length: 128 }),
  tags: jsonb("tags").$type<string[]>().default([]),
  marketType: varchar("market_type", { length: 16 }).notNull(),
  outcomes: jsonb("outcomes").$type<string[]>().default([]),
  status: varchar("status", { length: 16 }).notNull().default("active"),
  resolvesAt: timestamp("resolves_at", { withTimezone: true }),
  sourceUrl: text("source_url").notNull(),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

const marketState = pgTable("market_state", {
  marketId: uuid("market_id").primaryKey(),
  p: doublePrecision("p").notNull(),
  pJson: jsonb("p_json").$type<Record<string, number>>(),
  topOutcomeProb: doublePrecision("top_outcome_prob"),
  volumeTotal: doublePrecision("volume_total"),
  volume24h: doublePrecision("volume_24h"),
  liquidity: doublePrecision("liquidity"),
  bestBid: doublePrecision("best_bid"),
  bestAsk: doublePrecision("best_ask"),
  spread: doublePrecision("spread"),
  trustTier: varchar("trust_tier", { length: 16 }).notNull().default("low"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

const marketSnapshot = pgTable("market_snapshot", {
  id: uuid("id").defaultRandom().primaryKey(),
  marketId: uuid("market_id").notNull(),
  tsBucket: integer("ts_bucket").notNull(),
  p: doublePrecision("p").notNull(),
  pJson: jsonb("p_json").$type<Record<string, number>>(),
  volume24h: doublePrecision("volume_24h"),
  liquidity: doublePrecision("liquidity"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

const feedItem = pgTable("feed_item", {
  id: uuid("id").defaultRandom().primaryKey(),
  feed: varchar("feed", { length: 16 }).notNull(),
  rank: integer("rank").notNull(),
  marketId: uuid("market_id").notNull(),
  score: doublePrecision("score").notNull(),
  computedAt: timestamp("computed_at", { withTimezone: true }).notNull(),
});

export interface MarketWithState {
  id: string;
  source: string;
  slug: string;
  titleRaw: string;
  headline: string | null;
  articleBody: string | null;
  articleMetaDescription: string | null;
  articleImageUrl: string | null;
  category: string | null;
  tags: string[];
  marketType: string;
  outcomes: string[];
  resolvesAt: Date | null;
  sourceUrl: string;
  imageUrl: string | null;
  p: number;
  pJson: Record<string, number> | null;
  volumeTotal: number | null;
  volume24h: number | null;
  liquidity: number | null;
  spread: number | null;
  trustTier: string;
  stateUpdatedAt: Date;
  rank: number;
  score: number;
  normalizedCategory?: NewsCategory;
}

export async function getFeedItems(
  feed: "likely" | "moved",
  limit: number = 50,
  category?: string,
): Promise<MarketWithState[]> {
  let query = db
    .select({
      id: market.id,
      source: market.source,
      slug: market.slug,
      titleRaw: market.titleRaw,
      headline: market.headline,
      articleBody: market.articleBody,
      articleMetaDescription: market.articleMetaDescription,
      articleImageUrl: market.articleImageUrl,
      category: market.category,
      tags: market.tags,
      marketType: market.marketType,
      outcomes: market.outcomes,
      resolvesAt: market.resolvesAt,
      sourceUrl: market.sourceUrl,
      imageUrl: market.imageUrl,
      p: marketState.p,
      pJson: marketState.pJson,
      volumeTotal: marketState.volumeTotal,
      volume24h: marketState.volume24h,
      liquidity: marketState.liquidity,
      spread: marketState.spread,
      trustTier: marketState.trustTier,
      stateUpdatedAt: marketState.updatedAt,
      rank: feedItem.rank,
      score: feedItem.score,
    })
    .from(feedItem)
    .innerJoin(market, eq(feedItem.marketId, market.id))
    .innerJoin(marketState, eq(market.id, marketState.marketId))
    .where(
      category
        ? and(eq(feedItem.feed, feed), eq(market.category, category))
        : eq(feedItem.feed, feed),
    )
    .orderBy(asc(feedItem.rank))
    .limit(limit);

  return (await query) as MarketWithState[];
}

interface VolumeFeedOptions {
  limit?: number;
  category?: NewsCategory;
  maxDaysToResolve?: number;
}

export async function getTopMarketsByVolume(
  options: VolumeFeedOptions = {},
): Promise<MarketWithState[]> {
  const limit = options.limit ?? 20;
  const maxDaysToResolve = options.maxDaysToResolve ?? 365;
  const fetchSize = options.category ? Math.max(limit * 30, 300) : limit;
  const maxResolution = new Date(Date.now() + maxDaysToResolve * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      id: market.id,
      source: market.source,
      slug: market.slug,
      titleRaw: market.titleRaw,
      headline: market.headline,
      articleBody: market.articleBody,
      articleMetaDescription: market.articleMetaDescription,
      articleImageUrl: market.articleImageUrl,
      category: market.category,
      tags: market.tags,
      marketType: market.marketType,
      outcomes: market.outcomes,
      resolvesAt: market.resolvesAt,
      sourceUrl: market.sourceUrl,
      imageUrl: market.imageUrl,
      p: marketState.p,
      pJson: marketState.pJson,
      volumeTotal: marketState.volumeTotal,
      volume24h: marketState.volume24h,
      liquidity: marketState.liquidity,
      spread: marketState.spread,
      trustTier: marketState.trustTier,
      stateUpdatedAt: marketState.updatedAt,
    })
    .from(market)
    .innerJoin(marketState, eq(market.id, marketState.marketId))
    .where(
      and(
        eq(market.status, "active"),
        lte(market.resolvesAt, maxResolution),
      ),
    )
    .orderBy(
      desc(marketState.volumeTotal),
      desc(marketState.volume24h),
      desc(marketState.liquidity),
      desc(marketState.p),
    )
    .limit(fetchSize);

  const withCategory = rows.map((row) => {
    const normalizedCategory = inferNewsCategory({
      category: row.category,
      titleRaw: row.titleRaw,
      slug: row.slug,
      tags: row.tags,
    });

    return {
      ...row,
      normalizedCategory,
    };
  });

  const filtered = options.category
    ? withCategory.filter((row) => row.normalizedCategory === options.category)
    : withCategory;

  return filtered
    .slice(0, limit)
    .map((row, idx) => ({
      ...row,
      rank: idx + 1,
      score: row.volumeTotal ?? row.volume24h ?? 0,
    })) as MarketWithState[];
}

export interface MarketDetail extends MarketWithState {
  snapshots: Array<{ tsBucket: number; p: number }>;
}

export async function getMarketBySlug(slug: string): Promise<MarketDetail | null> {
  const rows = await db
    .select({
      id: market.id,
      source: market.source,
      slug: market.slug,
      titleRaw: market.titleRaw,
      headline: market.headline,
      articleBody: market.articleBody,
      articleMetaDescription: market.articleMetaDescription,
      articleImageUrl: market.articleImageUrl,
      category: market.category,
      tags: market.tags,
      marketType: market.marketType,
      outcomes: market.outcomes,
      resolvesAt: market.resolvesAt,
      sourceUrl: market.sourceUrl,
      imageUrl: market.imageUrl,
      p: marketState.p,
      pJson: marketState.pJson,
      volumeTotal: marketState.volumeTotal,
      volume24h: marketState.volume24h,
      liquidity: marketState.liquidity,
      spread: marketState.spread,
      trustTier: marketState.trustTier,
      stateUpdatedAt: marketState.updatedAt,
    })
    .from(market)
    .innerJoin(marketState, eq(market.id, marketState.marketId))
    .where(eq(market.slug, slug))
    .limit(1);

  if (rows.length === 0) return null;

  const m = rows[0]!;

  // Fetch snapshots (last 7 days, downsampled)
  const sevenDaysAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 3600;
  const snapshots = await db
    .select({
      tsBucket: marketSnapshot.tsBucket,
      p: marketSnapshot.p,
    })
    .from(marketSnapshot)
    .where(
      and(
        eq(marketSnapshot.marketId, m.id),
        gte(marketSnapshot.tsBucket, sevenDaysAgo),
      ),
    )
    .orderBy(asc(marketSnapshot.tsBucket))
    .limit(500);

  return {
    ...m,
    rank: 0,
    score: 0,
    snapshots,
  } as MarketDetail;
}

export async function searchMarkets(
  query: string,
  limit: number = 20,
): Promise<MarketWithState[]> {
  const rows = await db
    .select({
      id: market.id,
      source: market.source,
      slug: market.slug,
      titleRaw: market.titleRaw,
      headline: market.headline,
      articleBody: market.articleBody,
      articleMetaDescription: market.articleMetaDescription,
      articleImageUrl: market.articleImageUrl,
      category: market.category,
      tags: market.tags,
      marketType: market.marketType,
      outcomes: market.outcomes,
      resolvesAt: market.resolvesAt,
      sourceUrl: market.sourceUrl,
      imageUrl: market.imageUrl,
      p: marketState.p,
      pJson: marketState.pJson,
      volumeTotal: marketState.volumeTotal,
      volume24h: marketState.volume24h,
      liquidity: marketState.liquidity,
      spread: marketState.spread,
      trustTier: marketState.trustTier,
      stateUpdatedAt: marketState.updatedAt,
    })
    .from(market)
    .innerJoin(marketState, eq(market.id, marketState.marketId))
    .where(
      sql`to_tsvector('english', ${market.titleRaw} || ' ' || COALESCE(${market.headline}, '')) @@ plainto_tsquery('english', ${query})`
    )
    .orderBy(desc(marketState.volumeTotal))
    .limit(limit);

  return rows.map((r, i) => ({ ...r, rank: i + 1, score: 0 })) as MarketWithState[];
}

/**
 * Fetch 7-day sparkline data for a batch of market IDs.
 * Returns a map from marketId to an array of probability values (oldest first).
 * Downsampled to ~24 points (one per ~7 hours) for tiny sparklines.
 */
export async function getSparklineData(
  marketIds: string[],
): Promise<Map<string, number[]>> {
  if (marketIds.length === 0) return new Map();

  const sevenDaysAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 3600;

  const rows = await db
    .select({
      marketId: marketSnapshot.marketId,
      tsBucket: marketSnapshot.tsBucket,
      p: marketSnapshot.p,
    })
    .from(marketSnapshot)
    .where(
      and(
        sql`${marketSnapshot.marketId} = ANY(${marketIds}::uuid[])`,
        gte(marketSnapshot.tsBucket, sevenDaysAgo),
      ),
    )
    .orderBy(asc(marketSnapshot.tsBucket));

  // Group by marketId
  const grouped = new Map<string, { tsBucket: number; p: number }[]>();
  for (const row of rows) {
    const existing = grouped.get(row.marketId) || [];
    existing.push({ tsBucket: row.tsBucket, p: row.p });
    grouped.set(row.marketId, existing);
  }

  // Downsample to ~24 points per market
  const result = new Map<string, number[]>();
  for (const [marketId, snapshots] of grouped) {
    if (snapshots.length <= 24) {
      result.set(marketId, snapshots.map((s) => s.p));
    } else {
      const step = snapshots.length / 24;
      const sampled: number[] = [];
      for (let i = 0; i < 24; i++) {
        sampled.push(snapshots[Math.floor(i * step)]!.p);
      }
      // Always include the latest point
      sampled.push(snapshots[snapshots.length - 1]!.p);
      result.set(marketId, sampled);
    }
  }

  return result;
}

export async function getRelatedMarkets(
  excludeMarketId: string,
  category: string | null,
  limit: number = 3,
): Promise<MarketWithState[]> {
  if (!category) return [];

  const rows = await db
    .select({
      id: market.id,
      source: market.source,
      slug: market.slug,
      titleRaw: market.titleRaw,
      headline: market.headline,
      articleBody: market.articleBody,
      articleMetaDescription: market.articleMetaDescription,
      articleImageUrl: market.articleImageUrl,
      category: market.category,
      tags: market.tags,
      marketType: market.marketType,
      outcomes: market.outcomes,
      resolvesAt: market.resolvesAt,
      sourceUrl: market.sourceUrl,
      imageUrl: market.imageUrl,
      p: marketState.p,
      pJson: marketState.pJson,
      volumeTotal: marketState.volumeTotal,
      volume24h: marketState.volume24h,
      liquidity: marketState.liquidity,
      spread: marketState.spread,
      trustTier: marketState.trustTier,
      stateUpdatedAt: marketState.updatedAt,
    })
    .from(market)
    .innerJoin(marketState, eq(market.id, marketState.marketId))
    .where(
      and(
        eq(market.category, category),
        eq(market.status, "active"),
        ne(market.id, excludeMarketId),
      ),
    )
    .orderBy(desc(marketState.volumeTotal))
    .limit(limit);

  return rows.map((r, i) => ({ ...r, rank: i + 1, score: 0 })) as MarketWithState[];
}
