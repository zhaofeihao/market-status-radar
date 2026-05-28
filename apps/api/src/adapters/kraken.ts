import type { ExchangeAdapter } from "./types.js";
import type { JsonHttpClient } from "../httpClient.js";
import type { ExchangePriceStatus } from "@status-monitor/shared";
import { asArray, objectRecord, priceResult, statusResult, stringValue, supportedWhen, unavailablePrice, unknownFundingChain } from "./utils.js";

function krakenSpotLast(payload: unknown): string | undefined {
  const ticker = Object.values(objectRecord(objectRecord(payload).result))[0];
  return stringValue(asArray(objectRecord(ticker).c)[0]);
}

function krakenFuturesRows(payload: unknown): unknown[] {
  const record = objectRecord(payload);
  return asArray(record.tickers).length > 0 ? asArray(record.tickers) : asArray(record.instruments);
}

async function krakenPrice(client: JsonHttpClient, coin: string): Promise<ExchangePriceStatus> {
  const [spot, futures] = await Promise.all([
    client.getJson(`https://api.kraken.com/0/public/Ticker?pair=${coin}USD`).catch(() => undefined),
    client.getJson("https://futures.kraken.com/derivatives/api/v3/tickers").catch(() => undefined)
  ]);
  const futuresRow = objectRecord(
    krakenFuturesRows(futures).find((item) => {
      const symbol = String(objectRecord(item).symbol ?? "").toUpperCase();
      return symbol === `PF_${coin}USD` || symbol.includes(`${coin}USD`);
    })
  );
  const price = priceResult({
    quote: "USD",
    spotLastPrice: krakenSpotLast(spot),
    contractLastPrice: stringValue(futuresRow.last),
    indexPrice: stringValue(futuresRow.indexPrice),
    markPrice: stringValue(futuresRow.markPrice)
  });

  return price.source === "public" ? price : unavailablePrice("USD", ["Kraken public price endpoints are unavailable."]);
}

export function createKrakenAdapter(client: JsonHttpClient): ExchangeAdapter {
  return {
    id: "kraken",
    name: "Kraken",
    async searchCoin({ coin }) {
      const [pairs, futures, assets, price] = await Promise.all([
        client.getJson(`https://api.kraken.com/0/public/AssetPairs?pair=${coin}USD`),
        client.getJson("https://futures.kraken.com/derivatives/api/v3/instruments"),
        client.getJson(`https://api.kraken.com/0/public/Assets?asset=${coin}`),
        krakenPrice(client, coin)
      ]);

      const pairValues = Object.values(objectRecord(objectRecord(pairs).result));
      const futureRows = asArray(objectRecord(futures).instruments);
      const assetValues = Object.values(objectRecord(objectRecord(assets).result));
      const assetEnabled = assetValues.some((item) => String(objectRecord(item).status ?? "").toLowerCase() === "enabled");

      return statusResult({
        exchange: { id: "kraken", name: "Kraken" },
        coin,
        spot: supportedWhen(pairValues.some((item) => String(objectRecord(item).wsname ?? "").startsWith(`${coin}/`))),
        contract: supportedWhen(
          futureRows.some((item) => String(objectRecord(item).symbol ?? "").includes(coin) && objectRecord(item).tradeable === true)
        ),
        price,
        chains: [unknownFundingChain()],
        source: "public",
        warnings: assetEnabled
          ? ["Kraken public asset status is enabled; detailed deposit and withdrawal methods require private API access."]
          : ["Kraken asset status is not enabled or unavailable."]
      });
    }
  };
}
