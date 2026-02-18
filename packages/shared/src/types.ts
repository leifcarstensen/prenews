export type Source = "polymarket" | "kalshi";

export type MarketStatus = "active" | "resolved" | "closed" | "unknown";

export type MarketType = "binary" | "multi";

export type TrustTier = "high" | "medium" | "low";

export type FeedType = "likely" | "moved";

export interface MarketRawPage {
  markets: unknown[];
  cursor?: string;
  hasMore: boolean;
}

export interface MarketStateRaw {
  sourceMarketId: string;
  p: number;
  pJson?: Record<string, number>;
  topOutcomeProb?: number;
  volumeTotal?: number;
  volume24h?: number;
  liquidity?: number;
  bestBid?: number;
  bestAsk?: number;
  spread?: number;
}

export interface OrderbookRaw {
  bids: Array<{ price: number; size: number }>;
  asks: Array<{ price: number; size: number }>;
}

export interface MarketAdapter {
  source: Source;
  listMarkets(cursor?: string): Promise<MarketRawPage>;
  getMarketStates(sourceMarketIds: string[]): Promise<MarketStateRaw[]>;
  getOrderbook?(sourceMarketId: string): Promise<OrderbookRaw>;
}
