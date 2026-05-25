import request from "supertest";
import { describe, expect, it } from "vitest";
import type { ExchangeAdapter } from "../src/adapters/types.js";
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
});
