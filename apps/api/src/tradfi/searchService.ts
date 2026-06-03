import {
  createTradfiErrorQuote,
  normalizeTradfiSymbol,
  type TradfiMarketQuote,
  type TradfiSearchResponse,
  type TradfiSpreadSummary
} from "@status-monitor/shared";
import type { TradfiMarketAdapter } from "./types.js";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "exchange request failed";
}

function numericPrice(row: TradfiMarketQuote, field: "markPrice" | "lastPrice") {
  const value = Number(row[field]);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function fixedPrice(value: number) {
  return value.toFixed(8).replace(/\.?0+$/u, "");
}

function fixedRate(value: number) {
  return value.toFixed(12).replace(/\.?0+$/u, "");
}

function premiumFromRow(row: TradfiMarketQuote): string | undefined {
  const perp = Number(row.markPrice ?? row.lastPrice);
  const index = Number(row.indexPrice);
  if (!Number.isFinite(perp) || !Number.isFinite(index) || index <= 0) {
    return undefined;
  }
  return fixedRate((perp - index) / index);
}

function fundingRateDiff(low: TradfiMarketQuote, high: TradfiMarketQuote) {
  const lowFunding = Number(low.fundingRate);
  const highFunding = Number(high.fundingRate);
  if (!Number.isFinite(lowFunding) || !Number.isFinite(highFunding)) {
    return {};
  }
  return {
    lowFundingRate: low.fundingRate,
    highFundingRate: high.fundingRate,
    fundingRateDiff: fixedRate(highFunding - lowFunding)
  };
}

function spreadFromRows(rows: TradfiMarketQuote[]): TradfiSpreadSummary | undefined {
  for (const sourceField of ["markPrice", "lastPrice"] as const) {
    const priced = rows
      .map((row) => ({ row, price: numericPrice(row, sourceField) }))
      .filter((item): item is { row: TradfiMarketQuote; price: number } => item.price !== undefined);

    if (priced.length < 2) {
      continue;
    }

    const low = priced.reduce((best, item) => (item.price < best.price ? item : best), priced[0]!);
    const high = priced.reduce((best, item) => (item.price > best.price ? item : best), priced[0]!);
    const absolute = high.price - low.price;

    return {
      sourceField,
      lowExchange: low.row.exchange.id,
      highExchange: high.row.exchange.id,
      lowPrice: low.row[sourceField] ?? fixedPrice(low.price),
      highPrice: high.row[sourceField] ?? fixedPrice(high.price),
      absolute: fixedPrice(absolute),
      percent: ((absolute / low.price) * 100).toFixed(4),
      ...fundingRateDiff(low.row, high.row)
    };
  }

  return undefined;
}

export async function searchTradfiAcrossExchanges(symbolInput: string, adapters: TradfiMarketAdapter[]): Promise<TradfiSearchResponse> {
  const symbol = normalizeTradfiSymbol(symbolInput);
  const settled = await Promise.all(
    adapters.map(async (adapter) => {
      try {
        return await adapter.searchMarket({ symbol });
      } catch (error) {
        return createTradfiErrorQuote({ id: adapter.id, name: adapter.name }, symbol, errorMessage(error));
      }
    })
  );

  return {
    symbol,
    results: settled.map((row) => ({ ...row, premium: row.premium ?? premiumFromRow(row) })),
    spread: spreadFromRows(settled),
    updatedAt: new Date().toISOString()
  };
}
