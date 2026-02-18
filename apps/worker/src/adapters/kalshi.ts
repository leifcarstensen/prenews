import type { MarketAdapter, MarketRawPage, MarketStateRaw, AdapterConfig } from "./types.js";
import { type MarketUpsert, slugify, clampProb } from "@prenews/shared";

const DEFAULT_API_URL = "https://api.elections.kalshi.com/trade-api/v2";

export class KalshiAdapter implements MarketAdapter {
  source = "kalshi" as const;
  private apiUrl: string;
  private apiKey?: string;

  constructor(config?: Partial<AdapterConfig>) {
    this.apiUrl = config?.apiUrl || process.env.KALSHI_API_URL || DEFAULT_API_URL;
    this.apiKey = config?.apiKey || process.env.KALSHI_API_KEY;
  }

  private get headers(): Record<string, string> {
    const h: Record<string, string> = { "Accept": "application/json" };
    if (this.apiKey) {
      h["Authorization"] = `Bearer ${this.apiKey}`;
    }
    return h;
  }

  async listMarkets(cursor?: string): Promise<MarketRawPage> {
    const params = new URLSearchParams({
      limit: "100",
      status: "open",
    });
    if (cursor) params.set("cursor", cursor);

    const url = `${this.apiUrl}/markets?${params}`;
    const res = await fetch(url, { headers: this.headers });

    if (!res.ok) {
      throw new Error(`Kalshi API error: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as { markets: unknown[]; cursor?: string };

    return {
      markets: data.markets ?? [],
      cursor: data.cursor || undefined,
      hasMore: !!data.cursor,
    };
  }

  async getMarketStates(sourceMarketIds: string[]): Promise<MarketStateRaw[]> {
    const results: MarketStateRaw[] = [];

    for (const ticker of sourceMarketIds) {
      try {
        const res = await fetch(`${this.apiUrl}/markets/${ticker}`, {
          headers: this.headers,
        });

        if (!res.ok) {
          console.warn(`Kalshi state fetch failed for ${ticker}: ${res.status}`);
          continue;
        }

        const data = (await res.json()) as { market: Record<string, unknown> };
        const state = this.parseMarketState(ticker, data.market);
        if (state) results.push(state);
      } catch (err) {
        console.warn(`Kalshi state fetch error for ${ticker}:`, err);
      }
    }

    return results;
  }

  private parseMarketState(ticker: string, data: Record<string, unknown>): MarketStateRaw | null {
    try {
      // Kalshi: yes_ask / yes_bid represent contract prices (in cents)
      const yesBid = typeof data.yes_bid === "number" ? data.yes_bid / 100 : null;
      const yesAsk = typeof data.yes_ask === "number" ? data.yes_ask / 100 : null;
      const lastPrice = typeof data.last_price === "number" ? data.last_price / 100 : null;

      let p: number;
      if (yesBid != null && yesAsk != null) {
        p = clampProb((yesBid + yesAsk) / 2);
      } else if (lastPrice != null) {
        p = clampProb(lastPrice);
      } else {
        p = 0.5;
      }

      const spread = yesBid != null && yesAsk != null ? yesAsk - yesBid : undefined;
      const volumeTotal = typeof data.volume === "number" ? data.volume : undefined;
      const volume24h = typeof data.volume_24h === "number" ? data.volume_24h : undefined;
      const liquidity = typeof data.open_interest === "number" ? data.open_interest : undefined;

      return {
        sourceMarketId: ticker,
        p,
        bestBid: yesBid ?? undefined,
        bestAsk: yesAsk ?? undefined,
        spread: spread ?? undefined,
        volumeTotal: volumeTotal as number,
        volume24h: volume24h as number,
        liquidity: liquidity as number,
      };
    } catch {
      console.warn(`Failed to parse Kalshi state for ${ticker}`);
      return null;
    }
  }
}

export function normalizeKalshiMarket(raw: Record<string, unknown>): MarketUpsert | null {
  try {
    const ticker = String(raw.ticker ?? "");
    if (!ticker) return null;

    const title = String(raw.title ?? raw.subtitle ?? "");
    if (!title) return null;

    const isBinary = raw.market_type !== "multiple_choice";
    const closeTime = raw.close_time ?? raw.expiration_time;
    const resolvesAt = closeTime ? new Date(String(closeTime)) : null;

    const slug = slugify(title);
    const eventTicker = String(raw.event_ticker ?? ticker);

    return {
      source: "kalshi",
      sourceMarketId: ticker,
      slug,
      titleRaw: title,
      headline: null,
      category: typeof raw.category === "string" ? raw.category : null,
      tags: [],
      marketType: isBinary ? "binary" : "multi",
      outcomes: isBinary ? ["Yes", "No"] : [],
      status: raw.status === "open" ? "active" : raw.status === "closed" ? "closed" : "active",
      resolvesAt,
      sourceUrl: `https://kalshi.com/markets/${eventTicker}`,
      imageUrl: null,
    };
  } catch (err) {
    console.warn("Failed to normalize Kalshi market:", err);
    return null;
  }
}
