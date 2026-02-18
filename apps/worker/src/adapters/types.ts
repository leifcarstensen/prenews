import type { MarketAdapter, Source, MarketRawPage, MarketStateRaw, OrderbookRaw } from "@prenews/shared";

export type { MarketAdapter, Source, MarketRawPage, MarketStateRaw, OrderbookRaw };

export interface AdapterConfig {
  apiUrl: string;
  apiKey?: string;
  apiSecret?: string;
}
