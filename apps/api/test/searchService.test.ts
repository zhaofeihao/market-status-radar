import { describe, expect, it } from "vitest";
import type { ExchangeCoinStatus, SearchInput } from "@status-monitor/shared";
import type { ExchangeAdapter } from "../src/adapters/types.js";
import { searchCoinAcrossExchanges } from "../src/services/searchService.js";

function status(exchangeId: string, coin: string): ExchangeCoinStatus {
  return {
    exchange: { id: exchangeId, name: exchangeId.toUpperCase() },
    coin,
    spot: "supported",
    contract: "unsupported",
    chains: [],
    source: "public",
    warnings: [],
    updatedAt: "2026-05-25T00:00:00.000Z"
  };
}

function adapter(id: string, searchCoin: (input: SearchInput) => Promise<ExchangeCoinStatus>): ExchangeAdapter {
  return {
    id,
    name: id.toUpperCase(),
    searchCoin
  };
}

describe("searchCoinAcrossExchanges", () => {
  it("normalizes the coin and returns one result per successful adapter", async () => {
    const result = await searchCoinAcrossExchanges(" sol ", [
      adapter("binance", async ({ coin }) => status("binance", coin)),
      adapter("okx", async ({ coin }) => status("okx", coin))
    ]);

    expect(result.coin).toBe("SOL");
    expect(result.results).toHaveLength(2);
    expect(result.results.map((item) => item.exchange.id)).toEqual(["binance", "okx"]);
    expect(result.results.every((item) => item.coin === "SOL")).toBe(true);
  });

  it("keeps partial results when one adapter fails", async () => {
    const result = await searchCoinAcrossExchanges("SOL", [
      adapter("bybit", async ({ coin }) => status("bybit", coin)),
      adapter("gate", async () => {
        throw new Error("rate limited");
      })
    ]);

    expect(result.results).toHaveLength(2);
    expect(result.results[0]?.spot).toBe("supported");
    expect(result.results[1]).toMatchObject({
      exchange: { id: "gate", name: "GATE" },
      coin: "SOL",
      spot: "error",
      contract: "error",
      source: "unavailable",
      warnings: ["rate limited"]
    });
  });
});
