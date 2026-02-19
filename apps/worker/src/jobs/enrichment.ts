import { db } from "../db/connection.js";
import { market, marketState, marketSnapshot, llmArtifact } from "../db/schema.js";
import { isNull, eq, gte, isNotNull, and, sql } from "drizzle-orm";
import { computeDeltas } from "@prenews/shared";
import {
  generateArticle,
  validateArticle,
  fallbackArticle,
  hash,
  ARTICLE_PROMPT_HASH,
  type ArticleOutput,
} from "../llm/article.js";

const RE_ENRICH_DELTA_THRESHOLD = 0.10; // 10 percentage points
const ENRICHMENT_DELAY_MS = 3_000; // 3 seconds between LLM calls to respect rate limits

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface EnrichmentResult {
  processed: number;
  llmCalls: number;
  cached: number;
  fallbacks: number;
  errors: number;
  reEnriched: number;
}

export async function enrichmentJob(limit: number = 50): Promise<EnrichmentResult> {
  const startTime = Date.now();
  let processed = 0;
  let llmCalls = 0;
  let cached = 0;
  let fallbacks = 0;
  let errors = 0;
  let reEnriched = 0;

  // Find markets missing headline (new markets)
  const newMarkets = await db
    .select({
      id: market.id,
      titleRaw: market.titleRaw,
      outcomes: market.outcomes,
      resolvesAt: market.resolvesAt,
      source: market.source,
      rulesPrimary: market.rulesPrimary,
    })
    .from(market)
    .where(isNull(market.headline))
    .limit(limit);

  // Find markets that already have articles but have moved >10pts in 24h
  // (candidates for re-enrichment)
  const reEnrichCandidates = await db
    .select({
      id: market.id,
      titleRaw: market.titleRaw,
      outcomes: market.outcomes,
      resolvesAt: market.resolvesAt,
      source: market.source,
      rulesPrimary: market.rulesPrimary,
    })
    .from(market)
    .where(
      and(
        isNotNull(market.headline),
        eq(market.status, "active"),
      ),
    )
    .limit(limit);

  // Batch-fetch current states for all markets
  const states = await db
    .select({
      marketId: marketState.marketId,
      p: marketState.p,
      volume24h: marketState.volume24h,
      liquidity: marketState.liquidity,
      trustTier: marketState.trustTier,
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

  // Filter re-enrich candidates: only those with >10pt delta
  const reEnrichMarkets = reEnrichCandidates.filter((m) => {
    const state = stateMap.get(m.id);
    if (!state) return false;
    const snapshots = snapshotsByMarket.get(m.id) || [];
    const deltas = computeDeltas(state.p, snapshots);
    return deltas.delta24h != null && Math.abs(deltas.delta24h) >= RE_ENRICH_DELTA_THRESHOLD;
  });

  if (reEnrichMarkets.length > 0) {
    console.log(JSON.stringify({
      job: "enrichment",
      message: `${reEnrichMarkets.length} markets qualify for re-enrichment (>10pt 24h delta)`,
    }));
  }

  // Combine: new markets first, then re-enrich candidates (capped at limit)
  const allMarkets = [...newMarkets, ...reEnrichMarkets].slice(0, limit);

  if (allMarkets.length === 0) {
    console.log(JSON.stringify({ job: "enrichment", message: "no markets to enrich" }));
    return { processed: 0, llmCalls: 0, cached: 0, fallbacks: 0, errors: 0, reEnriched: 0 };
  }

  const newMarketIds = new Set(newMarkets.map((m) => m.id));
  let llmCallCount = 0;

  for (const m of allMarkets) {
    try {
      const state = stateMap.get(m.id);
      const probability = state?.p ?? 0.5;
      const trustTier = state?.trustTier ?? "low";
      const snapshots = snapshotsByMarket.get(m.id) || [];
      const deltas = computeDeltas(probability, snapshots);
      const isReEnrich = !newMarketIds.has(m.id);

      const inputStr = JSON.stringify({
        title: m.titleRaw,
        outcomes: m.outcomes,
        resolves_at: m.resolvesAt?.toISOString() ?? null,
        source: m.source,
        probability,
        volume_24h: state?.volume24h ?? null,
        liquidity: state?.liquidity ?? null,
        delta_24h: deltas.delta24h,
        trust_tier: trustTier,
        rules_primary: m.rulesPrimary ?? null,
      });
      const inputHash = hash(inputStr);

      // Check cache (skip for re-enrichment — we always want fresh content)
      if (!isReEnrich) {
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
      }

      // Rate limit: wait between LLM calls to avoid 429s
      if (llmCallCount > 0) {
        await sleep(ENRICHMENT_DELAY_MS);
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
          trustTier,
          rulesPrimary: m.rulesPrimary ?? null,
        });

        llmCalls++;
        llmCallCount++;

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

      // Apply article to market first (most important step)
      await applyArticle(m.id, output);
      processed++;
      if (isReEnrich) reEnriched++;

      // Store artifact for caching (non-critical — don't let this block enrichment)
      try {
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
      } catch (cacheErr) {
        console.warn(`Failed to cache artifact for market ${m.id}:`, cacheErr);
        // Non-critical — the article is already applied to the market
      }
    } catch (err) {
      console.error(`Enrichment failed for market ${m.id}:`, err);
      errors++;

      // Even if everything else failed, try to at least apply a fallback headline
      try {
        const state = stateMap.get(m.id);
        const output = fallbackArticle(m.titleRaw, state?.p ?? 0.5);
        await applyArticle(m.id, output);
        fallbacks++;
        processed++;
      } catch {
        // truly failed
      }
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
    reEnriched,
    duration_ms: duration,
  }));

  return { processed, llmCalls, cached, fallbacks, errors, reEnriched };
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
