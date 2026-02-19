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
  primaryKey,
} from "drizzle-orm/pg-core";

export const market = pgTable(
  "market",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    source: varchar("source", { length: 32 }).notNull(),
    sourceMarketId: varchar("source_market_id", { length: 256 }).notNull(),
    slug: varchar("slug", { length: 256 }).notNull(),
    titleRaw: text("title_raw").notNull(),
    headline: text("headline"),
    articleBody: text("article_body"),
    articleMetaDescription: varchar("article_meta_description", { length: 320 }),
    articleImageUrl: text("article_image_url"),
    articleImagePrompt: text("article_image_prompt"),
    category: varchar("category", { length: 128 }),
    tags: jsonb("tags").$type<string[]>().default([]),
    marketType: varchar("market_type", { length: 16 }).notNull(), // 'binary' | 'multi'
    outcomes: jsonb("outcomes").$type<string[]>().default([]),
    status: varchar("status", { length: 16 }).notNull().default("active"),
    resolvesAt: timestamp("resolves_at", { withTimezone: true }),
    sourceUrl: text("source_url").notNull(),
    imageUrl: text("image_url"),
    rulesPrimary: text("rules_primary"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("market_source_id_idx").on(t.source, t.sourceMarketId),
    index("market_status_idx").on(t.status),
    index("market_resolves_at_idx").on(t.resolvesAt),
    index("market_slug_idx").on(t.slug),
  ],
);

export const marketState = pgTable("market_state", {
  marketId: uuid("market_id")
    .primaryKey()
    .references(() => market.id, { onDelete: "cascade" }),
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

export const marketSnapshot = pgTable(
  "market_snapshot",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    marketId: uuid("market_id")
      .notNull()
      .references(() => market.id, { onDelete: "cascade" }),
    tsBucket: integer("ts_bucket").notNull(),
    p: doublePrecision("p").notNull(),
    pJson: jsonb("p_json").$type<Record<string, number>>(),
    volume24h: doublePrecision("volume_24h"),
    liquidity: doublePrecision("liquidity"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("snapshot_market_ts_idx").on(t.marketId, t.tsBucket),
    index("snapshot_market_id_idx").on(t.marketId),
  ],
);

export const llmArtifact = pgTable(
  "llm_artifact",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    marketId: uuid("market_id")
      .notNull()
      .references(() => market.id, { onDelete: "cascade" }),
    artifactType: varchar("artifact_type", { length: 32 }).notNull(),
    model: varchar("model", { length: 64 }).notNull(),
    inputHash: varchar("input_hash", { length: 128 }).notNull(),
    promptHash: varchar("prompt_hash", { length: 128 }).notNull(),
    input: jsonb("input"),
    output: jsonb("output"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("llm_artifact_market_idx").on(t.marketId),
    uniqueIndex("llm_artifact_cache_idx").on(
      t.marketId,
      t.artifactType,
      t.inputHash,
      t.promptHash,
    ),
  ],
);

export const feedItem = pgTable(
  "feed_item",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    feed: varchar("feed", { length: 16 }).notNull(),
    rank: integer("rank").notNull(),
    marketId: uuid("market_id")
      .notNull()
      .references(() => market.id, { onDelete: "cascade" }),
    score: doublePrecision("score").notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    uniqueIndex("feed_item_feed_rank_idx").on(t.feed, t.rank),
    index("feed_item_feed_computed_idx").on(t.feed, t.computedAt),
  ],
);
