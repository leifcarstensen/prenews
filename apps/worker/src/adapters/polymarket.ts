import type { MarketAdapter, MarketRawPage, MarketStateRaw, AdapterConfig } from "./types.js";
import { type MarketUpsert, type MarketStateUpsert, type MarketSnapshotInsert, computeTsBucket, slugify, clampProb } from "@prenews/shared";

const DEFAULT_API_URL = "https://gamma-api.polymarket.com";

export class PolymarketAdapter implements MarketAdapter {
  source = "polymarket" as const;
  private apiUrl: string;

  constructor(config?: Partial<AdapterConfig>) {
    this.apiUrl = config?.apiUrl || process.env.POLYMARKET_API_URL || DEFAULT_API_URL;
  }

  async listMarkets(cursor?: string): Promise<MarketRawPage> {
    const params = new URLSearchParams({
      limit: "100",
      active: "true",
      closed: "false",
      order: "volumeNum",
      ascending: "false",
    });
    if (cursor) params.set("offset", cursor);

    const url = `${this.apiUrl}/markets?${params}`;
    const res = await fetch(url, {
      headers: { "Accept": "application/json" },
    });

    if (!res.ok) {
      throw new Error(`Polymarket API error: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as unknown[];

    return {
      markets: data,
      cursor: data.length === 100 ? String(Number(cursor || "0") + 100) : undefined,
      hasMore: data.length === 100,
    };
  }

  async getMarketStates(sourceMarketIds: string[]): Promise<MarketStateRaw[]> {
    // Polymarket: fetch individual market data for state
    const results: MarketStateRaw[] = [];

    for (const id of sourceMarketIds) {
      try {
        const res = await fetch(`${this.apiUrl}/markets/${id}`, {
          headers: { "Accept": "application/json" },
        });

        if (!res.ok) {
          console.warn(`Polymarket state fetch failed for ${id}: ${res.status}`);
          continue;
        }

        const data = (await res.json()) as Record<string, unknown>;
        const state = this.parseMarketState(id, data);
        if (state) results.push(state);
      } catch (err) {
        console.warn(`Polymarket state fetch error for ${id}:`, err);
      }
    }

    return results;
  }

  private parseMarketState(sourceMarketId: string, data: Record<string, unknown>): MarketStateRaw | null {
    try {
      // Polymarket uses outcomePrices as JSON string array
      const outcomePrices = typeof data.outcomePrices === "string"
        ? JSON.parse(data.outcomePrices) as number[]
        : null;

      const p = outcomePrices ? clampProb(Number(outcomePrices[0])) : 0.5;
      const volumeTotal = typeof data.volumeNum === "number"
        ? data.volumeNum
        : typeof data.volume === "string"
          ? Number.parseFloat(data.volume)
          : null;
      const volume24h = typeof data.volume24hr === "number" ? data.volume24hr : null;
      const liquidity = typeof data.liquidityNum === "number"
        ? data.liquidityNum
        : typeof data.liquidity === "string"
          ? Number.parseFloat(data.liquidity)
          : null;

      return {
        sourceMarketId,
        p,
        volumeTotal: volumeTotal ?? undefined as unknown as number,
        volume24h: volume24h ?? undefined as unknown as number,
        liquidity: liquidity ?? undefined as unknown as number,
      };
    } catch {
      console.warn(`Failed to parse Polymarket state for ${sourceMarketId}`);
      return null;
    }
  }
}

export function normalizePolymarketMarket(raw: Record<string, unknown>): MarketUpsert | null {
  try {
    const id = String(raw.id ?? raw.condition_id ?? "");
    if (!id) return null;

    const question = String(raw.question ?? raw.title ?? "");
    if (!question) return null;

    const outcomes = Array.isArray(raw.outcomes)
      ? (raw.outcomes as string[])
      : typeof raw.outcomes === "string"
        ? JSON.parse(raw.outcomes) as string[]
        : ["Yes", "No"];

    const isBinary = outcomes.length === 2;
    const endDate = raw.end_date_iso ?? raw.endDate;
    const resolvesAt = endDate ? new Date(String(endDate)) : null;

    const slug = String(raw.slug ?? "") || slugify(question);
    const imageUrl = typeof raw.image === "string" ? raw.image : null;

    return {
      source: "polymarket",
      sourceMarketId: id,
      slug,
      titleRaw: question,
      headline: null,
      category: null,
      tags: [],
      marketType: isBinary ? "binary" : "multi",
      outcomes,
      status: raw.active === false || raw.closed === true ? "closed" : "active",
      resolvesAt,
      sourceUrl: `https://polymarket.com/event/${slug}`,
      imageUrl,
    };
  } catch (err) {
    console.warn("Failed to normalize Polymarket market:", err);
    return null;
  }
}
