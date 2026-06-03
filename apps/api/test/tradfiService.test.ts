import { describe, expect, it } from "vitest";
import type { TradfiMarketAdapter } from "../src/tradfi/types.js";
import { searchTradfiAcrossExchanges } from "../src/tradfi/searchService.js";

function adapter(id: string, quote: Partial<Awaited<ReturnType<TradfiMarketAdapter["searchMarket"]>>>): TradfiMarketAdapter {
  return {
    id,
    name: id.toUpperCase(),
    async searchMarket({ symbol }) {
      return {
        exchange: { id, name: id.toUpperCase() },
        querySymbol: symbol,
        contractSymbol: `${symbol}USDT`,
        status: "supported",
        quoteAsset: "USDT",
        source: "public",
        warnings: [],
        updatedAt: "2026-06-01T00:00:00.000Z",
        ...quote
      };
    }
  };
}

describe("searchTradfiAcrossExchanges", () => {
  it("normalizes stock tickers and returns cross-exchange spread summary", async () => {
    const result = await searchTradfiAcrossExchanges(" tsla ", [
      adapter("binance", { markPrice: "436.00", fundingRate: "0", openInterestUsd: "1200000" }),
      adapter("okx", { markPrice: "438.18", indexPrice: "436.00", fundingRate: "0.0001", openInterestUsd: "900000" })
    ]);

    expect(result.symbol).toBe("TSLA");
    expect(result.results.map((row) => row.exchange.id)).toEqual(["binance", "okx"]);
    expect(result.spread).toMatchObject({
      sourceField: "markPrice",
      lowExchange: "binance",
      highExchange: "okx",
      lowPrice: "436.00",
      highPrice: "438.18",
      absolute: "2.18",
      percent: "0.5000",
      lowFundingRate: "0",
      highFundingRate: "0.0001",
      fundingRateDiff: "0.0001"
    });
    expect(result.results[1]?.premium).toBe("0.005");
  });

  it("keeps partial market rows when one exchange fails", async () => {
    const result = await searchTradfiAcrossExchanges("NVDA", [
      adapter("bybit", { markPrice: "189.40" }),
      {
        id: "gate",
        name: "Gate.io",
        async searchMarket() {
          throw new Error("rate limited");
        }
      }
    ]);

    expect(result.results).toHaveLength(2);
    expect(result.results[1]).toMatchObject({
      exchange: { id: "gate", name: "Gate.io" },
      querySymbol: "NVDA",
      status: "error",
      source: "unavailable",
      warnings: ["rate limited"]
    });
  });
});
