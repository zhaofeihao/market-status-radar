import { describe, expect, it } from "vitest";
import type { JsonHttpClient } from "../src/httpClient.js";
import { createBinanceAdapter } from "../src/adapters/binance.js";
import { createBitgetAdapter } from "../src/adapters/bitget.js";
import { createGateAdapter } from "../src/adapters/gate.js";
import { createHtxAdapter } from "../src/adapters/htx.js";
import { createKrakenAdapter } from "../src/adapters/kraken.js";
import { createOkxAdapter } from "../src/adapters/okx.js";

function fakeClient(resolver: (url: string) => unknown): JsonHttpClient {
  return {
    async getJson(url) {
      return resolver(url);
    }
  };
}

describe("exchange adapters", () => {
  it("maps Bitget public market and chain data", async () => {
    const adapter = createBitgetAdapter(
      fakeClient((url) => {
        if (url.includes("/spot/public/symbols")) {
          return { code: "00000", data: [{ symbol: "SOLUSDT", status: "online" }] };
        }
        if (url.includes("/mix/market/contracts")) {
          return { code: "00000", data: [{ symbol: "SOLUSDT", symbolStatus: "normal" }] };
        }
        return {
          code: "00000",
          data: [
            {
              coin: "SOL",
              chains: [
                {
                  chain: "SOL",
                  rechargeable: "true",
                  withdrawable: "false",
                  withdrawFee: "0.006",
                  minWithdrawAmount: "0.1"
                }
              ]
            }
          ]
        };
      })
    );

    const result = await adapter.searchCoin({ coin: "SOL" });

    expect(result).toMatchObject({
      exchange: { id: "bitget", name: "Bitget" },
      spot: "supported",
      contract: "supported",
      source: "public",
      chains: [
        {
          chain: "SOL",
          deposit: "enabled",
          withdraw: "disabled",
          withdrawFee: "0.006",
          withdrawMin: "0.1"
        }
      ]
    });
  });

  it("maps Gate.io chain disabled flags", async () => {
    const adapter = createGateAdapter(
      fakeClient((url) => {
        if (url.includes("/currency_pairs/")) {
          return { trade_status: "tradable" };
        }
        if (url.includes("/futures/usdt/contracts/")) {
          return { in_delisting: false };
        }
        if (url.includes("/wallet/currency_chains")) {
          return [{ chain: "SOL", is_deposit_disabled: 1, is_withdraw_disabled: 0 }];
        }
        return { chains: [] };
      })
    );

    const result = await adapter.searchCoin({ coin: "SOL" });

    expect(result.chains).toEqual([{ chain: "SOL", rawChain: "SOL", deposit: "disabled", withdraw: "enabled" }]);
  });

  it("marks Binance funding data as requiring API key", async () => {
    const adapter = createBinanceAdapter(
      fakeClient((url) => {
        if (url.includes("/api/v3/exchangeInfo")) {
          return { symbols: [{ symbol: "SOLUSDT", status: "TRADING" }] };
        }
        return { symbols: [{ symbol: "SOLUSDT", status: "TRADING" }] };
      })
    );

    const result = await adapter.searchCoin({ coin: "SOL" });

    expect(result.spot).toBe("supported");
    expect(result.contract).toBe("supported");
    expect(result.chains).toEqual([{ chain: "ALL", deposit: "requires_api_key", withdraw: "requires_api_key" }]);
    expect(result.warnings).toContain("Binance deposit and withdrawal status requires signed wallet API access.");
  });

  it("marks OKX funding data as requiring API key when the asset endpoint rejects anonymous access", async () => {
    const adapter = createOkxAdapter(
      fakeClient((url) => {
        if (url.includes("instType=SPOT")) {
          return { code: "0", data: [{ instId: "SOL-USDT", state: "live" }] };
        }
        if (url.includes("instType=SWAP")) {
          return { code: "0", data: [{ instId: "SOL-USDT-SWAP", state: "live" }] };
        }
        return { code: "50103", msg: "Request header OK-ACCESS-KEY can not be empty." };
      })
    );

    const result = await adapter.searchCoin({ coin: "SOL" });

    expect(result.chains).toEqual([{ chain: "ALL", deposit: "requires_api_key", withdraw: "requires_api_key" }]);
    expect(result.source).toBe("mixed");
  });

  it("keeps OKX market statuses when the funding endpoint returns HTTP 401", async () => {
    const adapter = createOkxAdapter(
      fakeClient((url) => {
        if (url.includes("instType=SPOT")) {
          return { code: "0", data: [{ instId: "SOL-USDT", state: "live" }] };
        }
        if (url.includes("instType=SWAP")) {
          return { code: "0", data: [{ instId: "SOL-USDT-SWAP", state: "live" }] };
        }
        throw new Error("HTTP 401 for OKX funding");
      })
    );

    const result = await adapter.searchCoin({ coin: "SOL" });

    expect(result.spot).toBe("supported");
    expect(result.contract).toBe("supported");
    expect(result.chains).toEqual([{ chain: "ALL", deposit: "requires_api_key", withdraw: "requires_api_key" }]);
    expect(result.warnings).toContain("OKX funding currency endpoint requires API credentials in this environment.");
  });

  it("maps HTX reference currency chain statuses", async () => {
    const adapter = createHtxAdapter(
      fakeClient((url) => {
        if (url.includes("/v1/common/symbols")) {
          return { status: "ok", data: [{ "base-currency": "sol", "quote-currency": "usdt", state: "online" }] };
        }
        if (url.includes("/linear-swap-api")) {
          return { status: "ok", data: [{ contract_code: "SOL-USDT", contract_status: 1 }] };
        }
        return {
          code: 200,
          data: [
            {
              currency: "sol",
              chains: [{ chain: "sol", depositStatus: "allowed", withdrawStatus: "prohibited", withdrawFee: "0.01" }]
            }
          ]
        };
      })
    );

    const result = await adapter.searchCoin({ coin: "SOL" });

    expect(result.chains).toEqual([
      { chain: "SOL", rawChain: "sol", deposit: "enabled", withdraw: "disabled", withdrawFee: "0.01" }
    ]);
  });

  it("uses Kraken public asset status and leaves funding methods unknown", async () => {
    const adapter = createKrakenAdapter(
      fakeClient((url) => {
        if (url.includes("/AssetPairs")) {
          return { error: [], result: { SOLUSD: { wsname: "SOL/USD", status: "online" } } };
        }
        if (url.includes("derivatives")) {
          return { result: "success", instruments: [{ symbol: "PF_SOLUSD", tradeable: true }] };
        }
        return { error: [], result: { SOL: { altname: "SOL", status: "enabled" } } };
      })
    );

    const result = await adapter.searchCoin({ coin: "SOL" });

    expect(result.spot).toBe("supported");
    expect(result.contract).toBe("supported");
    expect(result.chains).toEqual([{ chain: "ALL", deposit: "unknown", withdraw: "unknown" }]);
  });
});
