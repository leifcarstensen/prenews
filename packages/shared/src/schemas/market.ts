import { z } from "zod";

export const sourceEnum = z.enum(["polymarket", "kalshi"]);
export const marketStatusEnum = z.enum(["active", "resolved", "closed", "unknown"]);
export const marketTypeEnum = z.enum(["binary", "multi"]);
export const trustTierEnum = z.enum(["high", "medium", "low"]);

export const marketUpsertSchema = z.object({
  source: sourceEnum,
  sourceMarketId: z.string().min(1),
  slug: z.string().min(1),
  titleRaw: z.string().min(1),
  headline: z.string().nullable().default(null),
  category: z.string().nullable().default(null),
  tags: z.array(z.string()).default([]),
  marketType: marketTypeEnum,
  outcomes: z.array(z.string()).default([]),
  status: marketStatusEnum,
  resolvesAt: z.date().nullable().default(null),
  sourceUrl: z.string().url(),
  imageUrl: z.string().url().nullable().default(null),
});

export type MarketUpsert = z.infer<typeof marketUpsertSchema>;

export const marketStateUpsertSchema = z.object({
  marketId: z.string().uuid(),
  p: z.number().min(0).max(1),
  pJson: z.record(z.string(), z.number()).nullable().default(null),
  topOutcomeProb: z.number().min(0).max(1).nullable().default(null),
  volume24h: z.number().nullable().default(null),
  liquidity: z.number().nullable().default(null),
  bestBid: z.number().nullable().default(null),
  bestAsk: z.number().nullable().default(null),
  spread: z.number().nullable().default(null),
  trustTier: trustTierEnum.default("low"),
});

export type MarketStateUpsert = z.infer<typeof marketStateUpsertSchema>;

export const marketSnapshotInsertSchema = z.object({
  marketId: z.string().uuid(),
  tsBucket: z.number().int(),
  p: z.number().min(0).max(1),
  pJson: z.record(z.string(), z.number()).nullable().default(null),
  volume24h: z.number().nullable().default(null),
  liquidity: z.number().nullable().default(null),
});

export type MarketSnapshotInsert = z.infer<typeof marketSnapshotInsertSchema>;

export const llmArtifactInsertSchema = z.object({
  marketId: z.string().uuid(),
  artifactType: z.enum(["headline", "category", "movement_note"]),
  model: z.string(),
  inputHash: z.string(),
  promptHash: z.string(),
  input: z.unknown(),
  output: z.unknown(),
});

export type LlmArtifactInsert = z.infer<typeof llmArtifactInsertSchema>;

/** Compute ts_bucket: epoch seconds rounded to 300s (5-min windows) */
export function computeTsBucket(date: Date = new Date()): number {
  const epoch = Math.floor(date.getTime() / 1000);
  return Math.floor(epoch / 300) * 300;
}
