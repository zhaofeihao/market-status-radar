import type { ExchangeAdapter } from "./types.js";
import type { JsonHttpClient } from "../httpClient.js";
import type { ChainFundingStatus, ExchangePriceStatus, SearchInput } from "@status-monitor/shared";
import { createOkxAuthHeaders } from "../signing.js";
import { asArray, authRequiredChain, firstDataRecord, objectRecord, priceResult, statusResult, stringValue, supportedWhen, unavailablePrice } from "./utils.js";

function okxMarketSupported(payload: unknown, instId: string): boolean {
  const data = asArray(objectRecord(payload).data);
  return data.some((item) => {
    const row = objectRecord(item);
    const state = String(row.state ?? "live").toLowerCase();
    return row.instId === instId && state !== "suspend" && state !== "offline";
  });
}

async function okxPrice(client: JsonHttpClient, coin: string, spotId: string, swapId: string): Promise<ExchangePriceStatus> {
  const [spot, swap, index, mark] = await Promise.all([
    client.getJson(`https://www.okx.com/api/v5/market/ticker?instId=${spotId}`).catch(() => undefined),
    client.getJson(`https://www.okx.com/api/v5/market/ticker?instId=${swapId}`).catch(() => undefined),
    client.getJson(`https://www.okx.com/api/v5/market/index-tickers?instId=${coin}-USD`).catch(() => undefined),
    client.getJson(`https://www.okx.com/api/v5/public/mark-price?instType=SWAP&instId=${swapId}`).catch(() => undefined)
  ]);
  const price = priceResult({
    quote: "USDT/USD",
    spotLastPrice: stringValue(firstDataRecord(spot).last),
    contractLastPrice: stringValue(firstDataRecord(swap).last),
    indexPrice: stringValue(firstDataRecord(index).idxPx),
    markPrice: stringValue(firstDataRecord(mark).markPx)
  });

  return price.source === "public" ? price : unavailablePrice("USDT/USD", ["OKX public price endpoints are unavailable."]);
}

export function createOkxAdapter(client: JsonHttpClient): ExchangeAdapter {
  return {
    id: "okx",
    name: "OKX",
    async searchCoin(input) {
      const { coin } = input;
      const spotId = `${coin}-USDT`;
      const swapId = `${coin}-USDT-SWAP`;
      const fundingPath = `/api/v5/asset/currencies?ccy=${coin}`;
      let fundingWarning = "";
      const fundingRequest = okxCredentialsComplete(input)
        ? client.getJson(`https://www.okx.com${fundingPath}`, {
            headers: createOkxAuthHeaders({
              ...input.credentials!.okx!,
              method: "GET",
              requestPath: fundingPath,
              timestamp: new Date().toISOString()
            })
          }).catch(() => {
            fundingWarning = "OKX private funding request failed. Check API key, passphrase, permissions, and IP whitelist.";
            return { code: "requires_api_key" };
          })
        : client.getJson(`https://www.okx.com${fundingPath}`).catch(() => ({
            code: "requires_api_key"
          }));
      const [spot, swap, funding, price] = await Promise.all([
        client.getJson(`https://www.okx.com/api/v5/public/instruments?instType=SPOT&instId=${spotId}`),
        client.getJson(`https://www.okx.com/api/v5/public/instruments?instType=SWAP&instId=${swapId}`),
        fundingRequest,
        okxPrice(client, coin, spotId, swapId)
      ]);

      const fundingRecord = objectRecord(funding);
      const fundingCode = String(fundingRecord.code ?? "");
      const chains =
        fundingCode === "0"
          ? asArray(fundingRecord.data).map((item): ChainFundingStatus => {
              const row = objectRecord(item);
              return {
                chain: String(row.chain ?? row.ccy ?? "ALL").toUpperCase(),
                rawChain: String(row.chain ?? ""),
                deposit: String(row.canDep ?? "").toLowerCase() === "true" ? "enabled" : "disabled",
                withdraw: String(row.canWd ?? "").toLowerCase() === "true" ? "enabled" : "disabled",
                withdrawFee: row.minFee === undefined ? undefined : String(row.minFee),
                withdrawMin: row.minWd === undefined ? undefined : String(row.minWd)
              };
            })
          : [authRequiredChain()];

      return statusResult({
        exchange: { id: "okx", name: "OKX" },
        coin,
        spot: supportedWhen(okxMarketSupported(spot, spotId)),
        contract: supportedWhen(okxMarketSupported(swap, swapId)),
        price,
        chains,
        source: fundingCode === "0" ? (okxCredentialsComplete(input) ? "api_key" : "public") : "mixed",
        warnings: fundingCode === "0" ? [] : [fundingWarning || "OKX funding currency endpoint requires API credentials in this environment."]
      });
    }
  };
}

function okxCredentialsComplete(input: SearchInput) {
  return Boolean(input.credentials?.okx?.apiKey && input.credentials.okx.apiSecret && input.credentials.okx.passphrase);
}
