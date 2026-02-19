import { db } from "../db/connection.js";
import { market } from "../db/schema.js";
import { PolymarketAdapter, normalizePolymarketMarket, KalshiAdapter, normalizeKalshiMarket } from "../adapters/index.js";
import { CircuitBreaker } from "../adapters/retry.js";
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

  // Kalshi — with event_ticker grouping
  try {
    const result = await discoverKalshi();
    results.push(result);
  } catch (err) {
    console.error("Kalshi discovery failed:", err);
    results.push({ source: "kalshi", fetched: 0, upserted: 0, errors: 1 });
  }

  return results;
}

/**
 * Kalshi-specific discovery that groups markets by event_ticker.
 * For multi-market events, only the most liquid market is stored,
 * using the event-level question as the title for cleaner articles.
 */
async function discoverKalshi(): Promise<DiscoveryResult> {
  const adapter = new KalshiAdapter();
  const MAX_MARKETS_PER_RUN = 1500;
  const startTime = Date.now();
  let fetched = 0;
  let upserted = 0;
  let errors = 0;
  let cursor: string | undefined;
  const breaker = new CircuitBreaker();

  // Collect all raw markets first, then group by event_ticker
  const rawMarkets: Array<{ raw: Record<string, unknown>; normalized: MarketUpsert }> = [];

  do {
    if (breaker.shouldAbort()) {
      console.warn(`[discovery] Kalshi circuit breaker tripped: ${JSON.stringify(breaker.stats)}`);
      break;
    }

    const page = await adapter.listMarkets(cursor);
    fetched += page.markets.length;

    for (const raw of page.markets) {
      const r = raw as Record<string, unknown>;
      const normalized = normalizeKalshiMarket(r);
      if (!normalized) {
        errors++;
        breaker.recordFailure();
        continue;
      }
      rawMarkets.push({ raw: r, normalized });
      breaker.recordSuccess();
    }

    cursor = page.cursor;
    if (fetched >= MAX_MARKETS_PER_RUN) break;
  } while (cursor);

  // Group by event_ticker — for each event, pick the market with highest volume
  const eventGroups = new Map<string, { raw: Record<string, unknown>; normalized: MarketUpsert }[]>();
  for (const entry of rawMarkets) {
    const eventTicker = String(entry.raw.event_ticker ?? entry.normalized.sourceMarketId);
    const group = eventGroups.get(eventTicker) || [];
    group.push(entry);
    eventGroups.set(eventTicker, group);
  }

  for (const [eventTicker, group] of eventGroups) {
    try {
      // For single-market events, just upsert directly
      // For multi-market events, pick the one with highest volume
      let best = group[0]!;
      if (group.length > 1) {
        best = group.reduce((a, b) => {
          const volA = typeof a.raw.volume === "number" ? a.raw.volume : 0;
          const volB = typeof b.raw.volume === "number" ? b.raw.volume : 0;
          return volA >= volB ? a : b;
        });
      }

      await db
        .insert(market)
        .values(best.normalized)
        .onConflictDoUpdate({
          target: [market.source, market.sourceMarketId],
          set: {
            titleRaw: best.normalized.titleRaw,
            status: best.normalized.status,
            resolvesAt: best.normalized.resolvesAt,
            outcomes: best.normalized.outcomes,
            imageUrl: best.normalized.imageUrl,
            category: best.normalized.category,
            rulesPrimary: best.normalized.rulesPrimary ?? null,
            updatedAt: new Date(),
          },
        });

      upserted++;
    } catch (err) {
      console.warn(`Failed to upsert Kalshi market for event ${eventTicker}:`, err);
      errors++;
    }
  }

  const duration = Date.now() - startTime;
  console.log(JSON.stringify({
    job: "discovery",
    source: "kalshi",
    fetched,
    events: eventGroups.size,
    upserted,
    errors,
    duration_ms: duration,
  }));

  return { source: "kalshi", fetched, upserted, errors };
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
  const breaker = new CircuitBreaker();

  do {
    if (breaker.shouldAbort()) {
      console.warn(`[discovery] ${source} circuit breaker tripped: ${JSON.stringify(breaker.stats)}`);
      break;
    }

    const page = await adapter.listMarkets(cursor);
    fetched += page.markets.length;

    for (const raw of page.markets) {
      try {
        const normalized = normalize(raw as Record<string, unknown>);
        if (!normalized) {
          errors++;
          breaker.recordFailure();
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
              category: normalized.category,
              rulesPrimary: normalized.rulesPrimary ?? null,
              updatedAt: new Date(),
            },
          });

        upserted++;
        breaker.recordSuccess();
      } catch (err) {
        console.warn(`Failed to upsert market from ${source}:`, err);
        errors++;
        breaker.recordFailure();
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
