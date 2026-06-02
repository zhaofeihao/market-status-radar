import type { ExchangeIdentity, TradfiMarketQuote } from "@status-monitor/shared";

export interface TradfiMarketInput {
  symbol: string;
}

export interface TradfiMarketAdapter extends ExchangeIdentity {
  searchMarket(input: TradfiMarketInput): Promise<TradfiMarketQuote>;
}
