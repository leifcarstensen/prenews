import { z } from "zod";

export const feedTypeEnum = z.enum(["likely", "moved"]);

export const feedItemInsertSchema = z.object({
  feed: feedTypeEnum,
  rank: z.number().int().min(1),
  marketId: z.string().uuid(),
  score: z.number(),
  computedAt: z.date(),
});

export type FeedItemInsert = z.infer<typeof feedItemInsertSchema>;

export const feedQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  horizonDays: z.coerce.number().int().min(1).max(90).optional(),
  window: z.enum(["1h", "24h", "7d"]).optional(),
  category: z.string().optional(),
});

export type FeedQuery = z.infer<typeof feedQuerySchema>;
