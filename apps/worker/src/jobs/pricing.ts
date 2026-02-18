import { db } from "../db/connection.js";
import { market, marketState, marketSnapshot } from "../db/schema.js";
import { PolymarketAdapter, KalshiAdapter } from "../adapters/index.js";
import { computeTsBucket, computeTrustTier } from "@prenews/shared";
import type { Source, MarketStateRaw } from "@prenews/shared";
import { eq, and, inArray } from "drizzle-orm";

interface PricingResult {
  source: Source;
  updated: number;
  snapshots: number;
  errors: number;
}

export async function pricingJob(): Promise<PricingResult[]> {
  const results: PricingResult[] = [];

  // Get all active markets grouped by source
  const activeMarkets = await db
    .select({ id: market.id, source: market.source, sourceMarketId: market.sourceMarketId })
    .from(market)
    .where(eq(market.status, "active"));

  const bySource = new Map<string, Array<{ id: string; sourceMarketId: string }>>();
  for (const m of activeMarkets) {
    const list = bySource.get(m.source) || [];
    list.push({ id: m.id, sourceMarketId: m.sourceMarketId });
    bySource.set(m.source, list);
  }

  // Process Polymarket
  const polyMarkets = bySource.get("polymarket") || [];
  if (polyMarkets.length > 0) {
    try {
      const result = await priceSource("polymarket", new PolymarketAdapter(), polyMarkets);
      results.push(result);
    } catch (err) {
      console.error("Polymarket pricing failed:", err);
      results.push({ source: "polymarket", updated: 0, snapshots: 0, errors: 1 });
    }
  }

  // Process Kalshi
  const kalshiMarkets = bySource.get("kalshi") || [];
  if (kalshiMarkets.length > 0) {
    try {
      const result = await priceSource("kalshi", new KalshiAdapter(), kalshiMarkets);
      results.push(result);
    } catch (err) {
      console.error("Kalshi pricing failed:", err);
      results.push({ source: "kalshi", updated: 0, snapshots: 0, errors: 1 });
    }
  }

  return results;
}

async function priceSource(
  source: Source,
  adapter: { getMarketStates(ids: string[]): Promise<MarketStateRaw[]> },
  markets: Array<{ id: string; sourceMarketId: string }>,
): Promise<PricingResult> {
  const startTime = Date.now();
  let updated = 0;
  let snapshots = 0;
  let errors = 0;

  const idMap = new Map(markets.map((m) => [m.sourceMarketId, m.id]));
  const sourceIds = markets.map((m) => m.sourceMarketId);

  // Batch in chunks of 50
  const BATCH_SIZE = 50;
  for (let i = 0; i < sourceIds.length; i += BATCH_SIZE) {
    const batch = sourceIds.slice(i, i + BATCH_SIZE);

    try {
      const states = await adapter.getMarketStates(batch);
      const tsBucket = computeTsBucket();

      for (const state of states) {
        const marketId = idMap.get(state.sourceMarketId);
        if (!marketId) continue;

        try {
          const trustTier = computeTrustTier({
            volume24h: state.volume24h ?? null,
            liquidity: state.liquidity ?? null,
            spread: state.spread ?? null,
          });

          // Upsert market_state
          await db
            .insert(marketState)
            .values({
              marketId,
              p: state.p,
              pJson: state.pJson ?? null,
              topOutcomeProb: state.topOutcomeProb ?? null,
              volumeTotal: state.volumeTotal ?? null,
              volume24h: state.volume24h ?? null,
              liquidity: state.liquidity ?? null,
              bestBid: state.bestBid ?? null,
              bestAsk: state.bestAsk ?? null,
              spread: state.spread ?? null,
              trustTier,
            })
            .onConflictDoUpdate({
              target: marketState.marketId,
              set: {
                p: state.p,
                pJson: state.pJson ?? null,
                topOutcomeProb: state.topOutcomeProb ?? null,
                volumeTotal: state.volumeTotal ?? null,
                volume24h: state.volume24h ?? null,
                liquidity: state.liquidity ?? null,
                bestBid: state.bestBid ?? null,
                bestAsk: state.bestAsk ?? null,
                spread: state.spread ?? null,
                trustTier,
                updatedAt: new Date(),
              },
            });
          updated++;

          // Insert snapshot (idempotent via unique constraint)
          await db
            .insert(marketSnapshot)
            .values({
              marketId,
              tsBucket,
              p: state.p,
              pJson: state.pJson ?? null,
              volume24h: state.volume24h ?? null,
              liquidity: state.liquidity ?? null,
            })
            .onConflictDoNothing();
          snapshots++;
        } catch (err) {
          console.warn(`Failed to update state for market ${marketId}:`, err);
          errors++;
        }
      }
    } catch (err) {
      console.warn(`Batch pricing failed for ${source}:`, err);
      errors += batch.length;
    }
  }

  const duration = Date.now() - startTime;
  console.log(JSON.stringify({
    job: "pricing",
    source,
    updated,
    snapshots,
    errors,
    duration_ms: duration,
  }));

  return { source, updated, snapshots, errors };
}
