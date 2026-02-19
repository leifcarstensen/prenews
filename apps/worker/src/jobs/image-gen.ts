import { db } from "../db/connection.js";
import { market } from "../db/schema.js";
import { isNull, isNotNull, eq } from "drizzle-orm";
import { generateArticleImage } from "../llm/image.js";

interface ImageGenResult {
  processed: number;
  generated: number;
  skipped: number;
  errors: number;
}

const IMAGE_DELAY_MS = 60_000; // 1 minute between image API calls to avoid rate limits

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate images for markets that have an article (image_prompt) but no stored image URL.
 * Runs as a lower-priority job separate from enrichment so articles go live immediately.
 * Rate-limited: ~1 image per minute to stay within API limits.
 */
export async function imageGenJob(limit: number = 10): Promise<ImageGenResult> {
  const startTime = Date.now();
  let processed = 0;
  let generated = 0;
  let skipped = 0;
  let errors = 0;

  // Find markets with an image prompt but no stored image
  const markets = await db
    .select({
      id: market.id,
      articleImagePrompt: market.articleImagePrompt,
    })
    .from(market)
    .where(
      isNull(market.articleImageUrl),
    )
    .limit(limit);

  // Filter to only those with a prompt
  const candidates = markets.filter((m) => m.articleImagePrompt);

  if (candidates.length === 0) {
    console.log(JSON.stringify({ job: "image-gen", message: "no markets need images" }));
    return { processed: 0, generated: 0, skipped: 0, errors: 0 };
  }

  for (let i = 0; i < candidates.length; i++) {
    const m = candidates[i]!;

    // Rate limit: wait between API calls (skip delay for the first one)
    if (i > 0) {
      await sleep(IMAGE_DELAY_MS);
    }

    try {
      const imageUrl = await generateArticleImage({
        marketId: m.id,
        prompt: m.articleImagePrompt!,
      });

      if (imageUrl) {
        await db
          .update(market)
          .set({ articleImageUrl: imageUrl, updatedAt: new Date() })
          .where(eq(market.id, m.id));
        generated++;
      } else {
        skipped++;
      }

      processed++;
    } catch (err) {
      console.warn(`Image generation failed for market ${m.id}:`, err);
      errors++;
    }
  }

  const duration = Date.now() - startTime;
  console.log(JSON.stringify({
    job: "image-gen",
    processed,
    generated,
    skipped,
    errors,
    duration_ms: duration,
  }));

  return { processed, generated, skipped, errors };
}
