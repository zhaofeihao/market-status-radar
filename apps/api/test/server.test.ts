import request from "supertest";
import { describe, expect, it } from "vitest";
import type { ExchangeAdapter } from "../src/adapters/types.js";
import type { TradfiMarketAdapter } from "../src/tradfi/types.js";
import { createServer } from "../src/server.js";

const adapters: ExchangeAdapter[] = [
  {
    id: "bybit",
    name: "Bybit",
    async searchCoin({ coin, credentials }) {
      return {
        exchange: { id: "bybit", name: "Bybit" },
        coin,
        spot: "supported",
        contract: "supported",
        chains: credentials?.bybit?.apiKey
          ? [{ chain: "SOL", deposit: "enabled", withdraw: "enabled" }]
          : [{ chain: "SOL", deposit: "enabled", withdraw: "enabled" }],
        source: credentials?.bybit?.apiKey ? "api_key" : "public",
        warnings: [],
        updatedAt: "2026-05-25T00:00:00.000Z"
      };
    }
  }
];

const tradfiAdapters: TradfiMarketAdapter[] = [
  {
    id: "bybit",
    name: "Bybit",
    async searchMarket({ symbol }) {
      return {
        exchange: { id: "bybit", name: "Bybit" },
        querySymbol: symbol,
        contractSymbol: `${symbol}USDT`,
        status: "supported",
        quoteAsset: "USDT",
        lastPrice: "436.24",
        markPrice: "436.24",
        indexPrice: "435.86",
        fundingRate: "0",
        nextFundingTime: "2026-06-01T08:00:00.000Z",
        volume24hBase: "415.6900",
        volume24hQuote: "181857.9585",
        openInterest: "4070.88",
        openInterestUsd: "1775880.69",
        source: "public",
        warnings: [],
        updatedAt: "2026-06-01T00:00:00.000Z"
      };
    }
  }
];

describe("createServer", () => {
  it("returns health status", async () => {
    await request(createServer({ adapters })).get("/api/health").expect(200, { ok: true });
  });

  it("lists configured exchanges", async () => {
    const response = await request(createServer({ adapters })).get("/api/exchanges").expect(200);

    expect(response.body).toEqual([{ id: "bybit", name: "Bybit" }]);
  });

  it("rejects a search without a coin", async () => {
    const response = await request(createServer({ adapters })).get("/api/search").expect(400);

    expect(response.body).toEqual({ error: "coin query parameter is required" });
  });

  it("returns normalized search results", async () => {
    const response = await request(createServer({ adapters })).get("/api/search?coin= sol ").expect(200);

    expect(response.body).toMatchObject({
      coin: "SOL",
      results: [
        {
          exchange: { id: "bybit", name: "Bybit" },
          coin: "SOL",
          spot: "supported",
          contract: "supported",
          chains: [{ chain: "SOL", deposit: "enabled", withdraw: "enabled" }],
          source: "public"
        }
      ]
    });
    expect(response.body.updatedAt).toEqual(expect.any(String));
  });

  it("accepts credential-aware searches without returning secret values", async () => {
    const response = await request(createServer({ adapters }))
      .post("/api/search")
      .send({
        coin: " sol ",
        credentials: {
          bybit: {
            apiKey: "bybit-key",
            apiSecret: "bybit-secret"
          }
        }
      })
      .expect(200);

    expect(response.body).toMatchObject({
      coin: "SOL",
      results: [
        {
          exchange: { id: "bybit", name: "Bybit" },
          source: "api_key",
          chains: [{ chain: "SOL", deposit: "enabled", withdraw: "enabled" }]
        }
      ]
    });
    expect(JSON.stringify(response.body)).not.toContain("bybit-secret");
  });

  it("rejects a tradfi search without a symbol", async () => {
    const response = await request(createServer({ adapters, tradfiAdapters })).get("/api/tradfi/search").expect(400);

    expect(response.body).toEqual({ error: "symbol query parameter is required" });
  });

  it("returns tradfi perpetual market results", async () => {
    const response = await request(createServer({ adapters, tradfiAdapters })).get("/api/tradfi/search?symbol= tsla ").expect(200);

    expect(response.body).toMatchObject({
      symbol: "TSLA",
      results: [
        {
          exchange: { id: "bybit", name: "Bybit" },
          querySymbol: "TSLA",
          contractSymbol: "TSLAUSDT",
          status: "supported",
          fundingRate: "0",
          openInterestUsd: "1775880.69"
        }
      ]
    });
  });
});
