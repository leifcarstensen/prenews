import { db } from "../db/connection.js";
import { market } from "../db/schema.js";
import { PolymarketAdapter, normalizePolymarketMarket, KalshiAdapter, normalizeKalshiMarket } from "../adapters/index.js";
import type { MarketUpsert, Source } from "@prenews/shared";
import { eq, and } from "drizzle-orm";

interface DiscoveryResult {
  source: Source;
  fetched: number;
  upserted: number;
  errors: number;
}

export async function discoveryJob(): Promise<DiscoveryResult[]> {
  const results: DiscoveryResult[] = [];

  // Polymarket
  try {
    const result = await discoverSource(
      "polymarket",
      new PolymarketAdapter(),
      normalizePolymarketMarket,
    );
    results.push(result);
  } catch (err) {
    console.error("Polymarket discovery failed:", err);
    results.push({ source: "polymarket", fetched: 0, upserted: 0, errors: 1 });
  }

  // Kalshi
  try {
    const result = await discoverSource(
      "kalshi",
      new KalshiAdapter(),
      normalizeKalshiMarket,
    );
    results.push(result);
  } catch (err) {
    console.error("Kalshi discovery failed:", err);
    results.push({ source: "kalshi", fetched: 0, upserted: 0, errors: 1 });
  }

  return results;
}

async function discoverSource(
  source: Source,
  adapter: { listMarkets(cursor?: string): Promise<{ markets: unknown[]; cursor?: string; hasMore: boolean }> },
  normalize: (raw: Record<string, unknown>) => MarketUpsert | null,
): Promise<DiscoveryResult> {
  const MAX_MARKETS_PER_RUN = 1500;
  const startTime = Date.now();
  let fetched = 0;
  let upserted = 0;
  let errors = 0;
  let cursor: string | undefined;

  do {
    const page = await adapter.listMarkets(cursor);
    fetched += page.markets.length;

    for (const raw of page.markets) {
      try {
        const normalized = normalize(raw as Record<string, unknown>);
        if (!normalized) {
          errors++;
          continue;
        }

        await db
          .insert(market)
          .values(normalized)
          .onConflictDoUpdate({
            target: [market.source, market.sourceMarketId],
            set: {
              titleRaw: normalized.titleRaw,
              status: normalized.status,
              resolvesAt: normalized.resolvesAt,
              outcomes: normalized.outcomes,
              imageUrl: normalized.imageUrl,
              updatedAt: new Date(),
            },
          });

        upserted++;
      } catch (err) {
        console.warn(`Failed to upsert market from ${source}:`, err);
        errors++;
      }
    }

    cursor = page.cursor;

    // Safety: cap the run while still covering a broad top-volume set.
    if (fetched >= MAX_MARKETS_PER_RUN) break;
  } while (cursor);

  const duration = Date.now() - startTime;
  console.log(JSON.stringify({
    job: "discovery",
    source,
    fetched,
    upserted,
    errors,
    duration_ms: duration,
  }));

  return { source, fetched, upserted, errors };
}
