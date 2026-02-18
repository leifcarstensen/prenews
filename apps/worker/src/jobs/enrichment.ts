import { db } from "../db/connection.js";
import { market, marketState, marketSnapshot, llmArtifact } from "../db/schema.js";
import { isNull, eq, gte } from "drizzle-orm";
import { computeDeltas } from "@prenews/shared";
import {
  generateArticle,
  validateArticle,
  fallbackArticle,
  hash,
  ARTICLE_PROMPT_HASH,
  type ArticleOutput,
} from "../llm/article.js";

interface EnrichmentResult {
  processed: number;
  llmCalls: number;
  cached: number;
  fallbacks: number;
  errors: number;
}

export async function enrichmentJob(limit: number = 100): Promise<EnrichmentResult> {
  const startTime = Date.now();
  let processed = 0;
  let llmCalls = 0;
  let cached = 0;
  let fallbacks = 0;
  let errors = 0;

  // Find markets missing headline or article body
  const markets = await db
    .select({
      id: market.id,
      titleRaw: market.titleRaw,
      outcomes: market.outcomes,
      resolvesAt: market.resolvesAt,
      source: market.source,
    })
    .from(market)
    .where(isNull(market.headline))
    .limit(limit);

  if (markets.length === 0) {
    console.log(JSON.stringify({ job: "enrichment", message: "no markets to enrich" }));
    return { processed: 0, llmCalls: 0, cached: 0, fallbacks: 0, errors: 0 };
  }

  // Batch-fetch current states for all markets
  const states = await db
    .select({
      marketId: marketState.marketId,
      p: marketState.p,
      volume24h: marketState.volume24h,
      liquidity: marketState.liquidity,
    })
    .from(marketState);

  const stateMap = new Map(states.map((s) => [s.marketId, s]));

  // Fetch recent snapshots for delta computation
  const snapshotCutoff = Math.floor(Date.now() / 1000) - 25 * 3600;
  const recentSnapshots = await db
    .select({
      marketId: marketSnapshot.marketId,
      tsBucket: marketSnapshot.tsBucket,
      p: marketSnapshot.p,
    })
    .from(marketSnapshot)
    .where(gte(marketSnapshot.tsBucket, snapshotCutoff));

  const snapshotsByMarket = new Map<string, Array<{ tsBucket: number; p: number }>>();
  for (const snap of recentSnapshots) {
    const list = snapshotsByMarket.get(snap.marketId) || [];
    list.push({ tsBucket: snap.tsBucket, p: snap.p });
    snapshotsByMarket.set(snap.marketId, list);
  }

  for (const m of markets) {
    try {
      const state = stateMap.get(m.id);
      const probability = state?.p ?? 0.5;
      const snapshots = snapshotsByMarket.get(m.id) || [];
      const deltas = computeDeltas(probability, snapshots);

      const inputStr = JSON.stringify({
        title: m.titleRaw,
        outcomes: m.outcomes,
        resolves_at: m.resolvesAt?.toISOString() ?? null,
        source: m.source,
        probability,
        volume_24h: state?.volume24h ?? null,
        liquidity: state?.liquidity ?? null,
        delta_24h: deltas.delta24h,
      });
      const inputHash = hash(inputStr);

      // Check cache
      const existing = await db
        .select()
        .from(llmArtifact)
        .where(eq(llmArtifact.marketId, m.id))
        .limit(1);

      const existingRow = existing[0];
      if (existingRow && existingRow.inputHash === inputHash && existingRow.promptHash === ARTICLE_PROMPT_HASH) {
        const output = existingRow.output as ArticleOutput;
        await applyArticle(m.id, output);
        cached++;
        processed++;
        continue;
      }

      // Generate article via Azure OpenAI
      let output: ArticleOutput;

      try {
        output = await generateArticle({
          titleRaw: m.titleRaw,
          outcomes: m.outcomes as string[],
          resolvesAt: m.resolvesAt?.toISOString() ?? null,
          source: m.source,
          probability,
          volume24h: state?.volume24h ?? null,
          liquidity: state?.liquidity ?? null,
          delta24h: deltas.delta24h,
        });

        llmCalls++;

        if (!validateArticle(output)) {
          console.warn(`Article validation failed for market ${m.id}, using fallback`);
          output = fallbackArticle(m.titleRaw, probability);
          fallbacks++;
        }
      } catch (llmErr) {
        console.warn(`Article generation failed for market ${m.id}, using fallback:`, llmErr);
        output = fallbackArticle(m.titleRaw, probability);
        fallbacks++;
      }

      // Store artifact
      await db.insert(llmArtifact).values({
        marketId: m.id,
        artifactType: "article",
        model: process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o-mini",
        inputHash,
        promptHash: ARTICLE_PROMPT_HASH,
        input: JSON.parse(inputStr),
        output,
      }).onConflictDoUpdate({
        target: [llmArtifact.marketId, llmArtifact.artifactType, llmArtifact.inputHash, llmArtifact.promptHash],
        set: { output, input: JSON.parse(inputStr) },
      });

      await applyArticle(m.id, output);
      processed++;
    } catch (err) {
      console.error(`Enrichment failed for market ${m.id}:`, err);
      errors++;
    }
  }

  const duration = Date.now() - startTime;
  console.log(JSON.stringify({
    job: "enrichment",
    processed,
    llmCalls,
    cached,
    fallbacks,
    errors,
    duration_ms: duration,
  }));

  return { processed, llmCalls, cached, fallbacks, errors };
}

async function applyArticle(marketId: string, output: ArticleOutput): Promise<void> {
  await db
    .update(market)
    .set({
      headline: output.headline,
      articleBody: output.body,
      articleMetaDescription: output.meta_description,
      articleImagePrompt: output.image_prompt,
      category: output.category,
      tags: output.tags,
      updatedAt: new Date(),
    })
    .where(eq(market.id, marketId));
}
