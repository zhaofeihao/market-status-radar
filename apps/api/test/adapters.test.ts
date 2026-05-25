import { describe, expect, it } from "vitest";
import { HttpError, type JsonHttpClient } from "../src/httpClient.js";
import { createBinanceAdapter } from "../src/adapters/binance.js";
import { createBitgetAdapter } from "../src/adapters/bitget.js";
import { createBybitAdapter } from "../src/adapters/bybit.js";
import { createGateAdapter } from "../src/adapters/gate.js";
import { createHtxAdapter } from "../src/adapters/htx.js";
import { createKrakenAdapter } from "../src/adapters/kraken.js";
import { createOkxAdapter } from "../src/adapters/okx.js";

function fakeClient(resolver: (url: string, headers?: Record<string, string>) => unknown): JsonHttpClient {
  return {
    async getJson(url, options) {
      return resolver(url, options?.headers);
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

  it("maps Binance signed wallet funding data when credentials are provided", async () => {
    const seenHeaders: Array<Record<string, string> | undefined> = [];
    const adapter = createBinanceAdapter(
      fakeClient((url, headers) => {
        seenHeaders.push(headers);
        if (url.includes("/api/v3/exchangeInfo")) {
          return { symbols: [{ symbol: "SOLUSDT", status: "TRADING" }] };
        }
        if (url.includes("/fapi/v1/exchangeInfo")) {
          return { symbols: [{ symbol: "SOLUSDT", status: "TRADING" }] };
        }
        expect(url).toContain("/sapi/v1/capital/config/getall?");
        expect(url).toContain("signature=");
        return [
          {
            coin: "SOL",
            networkList: [
              {
                network: "SOL",
                depositEnable: true,
                withdrawEnable: false,
                withdrawFee: "0.006",
                withdrawMin: "0.1"
              }
            ]
          }
        ];
      })
    );

    const result = await adapter.searchCoin({
      coin: "SOL",
      credentials: { binance: { apiKey: "binance-key", apiSecret: "binance-secret" } }
    });

    expect(seenHeaders).toContainEqual({ "X-MBX-APIKEY": "binance-key" });
    expect(result.source).toBe("api_key");
    expect(result.chains).toEqual([
      { chain: "SOL", rawChain: "SOL", deposit: "enabled", withdraw: "disabled", withdrawFee: "0.006", withdrawMin: "0.1" }
    ]);
  });

  it("does not fail Binance funding status when the spot symbol endpoint rejects an unsupported coin", async () => {
    const adapter = createBinanceAdapter(
      fakeClient((url) => {
        if (url.includes("/api/v3/exchangeInfo")) {
          throw new HttpError("HTTP 400 for invalid symbol", 400);
        }
        if (url.includes("/fapi/v1/exchangeInfo")) {
          return { symbols: [] };
        }
        return [
          {
            coin: "ESPORTS",
            networkList: [{ network: "BSC", depositEnable: true, withdrawEnable: true }]
          }
        ];
      })
    );

    const result = await adapter.searchCoin({
      coin: "ESPORTS",
      credentials: { binance: { apiKey: "binance-key", apiSecret: "binance-secret" } }
    });

    expect(result.spot).toBe("unsupported");
    expect(result.contract).toBe("unsupported");
    expect(result.source).toBe("api_key");
    expect(result.chains).toEqual([{ chain: "BSC", rawChain: "BSC", deposit: "enabled", withdraw: "enabled" }]);
  });

  it("keeps Binance market status when signed funding returns an authentication error", async () => {
    const adapter = createBinanceAdapter(
      fakeClient((url) => {
        if (url.includes("/api/v3/exchangeInfo")) {
          return { symbols: [{ symbol: "SOLUSDT", status: "TRADING" }] };
        }
        if (url.includes("/fapi/v1/exchangeInfo")) {
          return { symbols: [{ symbol: "SOLUSDT", status: "TRADING" }] };
        }
        throw new HttpError("HTTP 401 for Binance wallet", 401);
      })
    );

    const result = await adapter.searchCoin({
      coin: "SOL",
      credentials: { binance: { apiKey: "binance-key", apiSecret: "binance-secret" } }
    });

    expect(result.spot).toBe("supported");
    expect(result.contract).toBe("supported");
    expect(result.chains).toEqual([{ chain: "ALL", deposit: "requires_api_key", withdraw: "requires_api_key" }]);
    expect(result.warnings).toContain("Binance private funding request failed. Check API key permissions, timestamp, and IP whitelist.");
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

  it("maps OKX signed funding data when credentials are provided", async () => {
    const adapter = createOkxAdapter(
      fakeClient((url, headers) => {
        if (url.includes("instType=SPOT")) {
          return { code: "0", data: [{ instId: "SOL-USDT", state: "live" }] };
        }
        if (url.includes("instType=SWAP")) {
          return { code: "0", data: [{ instId: "SOL-USDT-SWAP", state: "live" }] };
        }
        expect(headers?.["OK-ACCESS-KEY"]).toBe("okx-key");
        return {
          code: "0",
          data: [{ ccy: "SOL", chain: "SOL-Solana", canDep: true, canWd: false, minFee: "0.01", minWd: "0.2" }]
        };
      })
    );

    const result = await adapter.searchCoin({
      coin: "SOL",
      credentials: { okx: { apiKey: "okx-key", apiSecret: "okx-secret", passphrase: "okx-pass" } }
    });

    expect(result.source).toBe("api_key");
    expect(result.chains).toEqual([
      { chain: "SOL-SOLANA", rawChain: "SOL-Solana", deposit: "enabled", withdraw: "disabled", withdrawFee: "0.01", withdrawMin: "0.2" }
    ]);
  });

  it("keeps OKX market status when signed funding returns an authentication error", async () => {
    const adapter = createOkxAdapter(
      fakeClient((url) => {
        if (url.includes("instType=SPOT")) {
          return { code: "0", data: [{ instId: "ESPORTS-USDT", state: "live" }] };
        }
        if (url.includes("instType=SWAP")) {
          return { code: "0", data: [] };
        }
        throw new HttpError("HTTP 401 for OKX funding", 401);
      })
    );

    const result = await adapter.searchCoin({
      coin: "ESPORTS",
      credentials: { okx: { apiKey: "okx-key", apiSecret: "okx-secret", passphrase: "okx-pass" } }
    });

    expect(result.spot).toBe("supported");
    expect(result.contract).toBe("unsupported");
    expect(result.chains).toEqual([{ chain: "ALL", deposit: "requires_api_key", withdraw: "requires_api_key" }]);
    expect(result.warnings).toContain("OKX private funding request failed. Check API key, passphrase, permissions, and IP whitelist.");
  });

  it("maps Bybit signed coin info when credentials are provided", async () => {
    const adapter = createBybitAdapter(
      fakeClient((url, headers) => {
        if (url.includes("category=spot")) {
          return { retCode: 0, result: { list: [{ symbol: "SOLUSDT", status: "Trading" }] } };
        }
        if (url.includes("category=linear")) {
          return { retCode: 0, result: { list: [{ symbol: "SOLUSDT", status: "Trading" }] } };
        }
        expect(headers?.["X-BAPI-API-KEY"]).toBe("bybit-key");
        return {
          retCode: 0,
          result: {
            rows: [
              {
                coin: "SOL",
                chains: [
                  {
                    chain: "SOL",
                    chainDeposit: "1",
                    chainWithdraw: "0",
                    withdrawFee: "0.01",
                    withdrawMin: "0.2"
                  }
                ]
              }
            ]
          }
        };
      })
    );

    const result = await adapter.searchCoin({
      coin: "SOL",
      credentials: { bybit: { apiKey: "bybit-key", apiSecret: "bybit-secret" } }
    });

    expect(result.source).toBe("api_key");
    expect(result.chains).toEqual([
      { chain: "SOL", rawChain: "SOL", deposit: "enabled", withdraw: "disabled", withdrawFee: "0.01", withdrawMin: "0.2" }
    ]);
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
