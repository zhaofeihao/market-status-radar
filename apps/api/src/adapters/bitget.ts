import type { ExchangeAdapter } from "./types.js";
import type { JsonHttpClient } from "../httpClient.js";
import type { ExchangeIndexComponent, ExchangePriceStatus } from "@status-monitor/shared";
import { asArray, boolFunding, firstDataRecord, objectRecord, priceResult, statusResult, stringValue, supportedWhen, unavailablePrice } from "./utils.js";

async function bitgetPrice(client: JsonHttpClient, symbol: string): Promise<ExchangePriceStatus> {
  const [spot, contract, components] = await Promise.all([
    client.getJson(`https://api.bitget.com/api/v2/spot/market/tickers?symbol=${symbol}`).catch(() => undefined),
    client.getJson(`https://api.bitget.com/api/v2/mix/market/symbol-price?symbol=${symbol}&productType=USDT-FUTURES`).catch(() => undefined),
    client.getJson(`https://api.bitget.com/api/v3/market/index-components?symbol=${symbol}`).catch(() => undefined)
  ]);
  const spotRow = firstDataRecord(spot);
  const contractRow = firstDataRecord(contract);
  const indexComponents = asArray(objectRecord(firstDataRecord(components).componentList ? firstDataRecord(components) : objectRecord(components).data).componentList).map(
    (item): ExchangeIndexComponent => {
      const row = objectRecord(item);
      return {
        exchange: String(row.exchange ?? "unknown"),
        symbol: stringValue(row.spotPair),
        price: stringValue(row.equivalentPrice),
        weight: stringValue(row.weight)
      };
    }
  );
  const price = priceResult({
    quote: "USDT",
    spotLastPrice: stringValue(spotRow.lastPr),
    contractLastPrice: stringValue(contractRow.price),
    indexPrice: stringValue(contractRow.indexPrice),
    markPrice: stringValue(contractRow.markPrice),
    indexComponents
  });

  return price.source === "public" ? price : unavailablePrice("USDT", ["Bitget public price endpoints are unavailable."]);
}

export function createBitgetAdapter(client: JsonHttpClient): ExchangeAdapter {
  return {
    id: "bitget",
    name: "Bitget",
    async searchCoin({ coin }) {
      const symbol = `${coin}USDT`;
      const [spot, contracts, funding, price] = await Promise.all([
        client.getJson(`https://api.bitget.com/api/v2/spot/public/symbols?symbol=${symbol}`),
        client.getJson("https://api.bitget.com/api/v2/mix/market/contracts?productType=USDT-FUTURES"),
        client.getJson(`https://api.bitget.com/api/v2/spot/public/coins?coin=${coin}`),
        bitgetPrice(client, symbol)
      ]);

      const spotRows = asArray(objectRecord(spot).data);
      const contractRows = asArray(objectRecord(contracts).data);
      const coinRows = asArray(objectRecord(funding).data);
      const chainRows = coinRows.flatMap((item) =>
        asArray(objectRecord(item).chains).map((chainItem) => {
          const row = objectRecord(chainItem);
          return {
            chain: String(row.chain ?? "ALL").toUpperCase(),
            rawChain: String(row.chain ?? ""),
            deposit: boolFunding(row.rechargeable, "true"),
            withdraw: boolFunding(row.withdrawable, "true"),
            withdrawFee: row.withdrawFee === undefined ? undefined : String(row.withdrawFee),
            withdrawMin: row.minWithdrawAmount === undefined ? undefined : String(row.minWithdrawAmount)
          };
        })
      );

      return statusResult({
        exchange: { id: "bitget", name: "Bitget" },
        coin,
        spot: supportedWhen(
          spotRows.some((item) => objectRecord(item).symbol === symbol && String(objectRecord(item).status ?? "online") !== "offline")
        ),
        contract: supportedWhen(
          contractRows.some((item) => objectRecord(item).symbol === symbol && String(objectRecord(item).symbolStatus ?? "normal") !== "off")
        ),
        price,
        chains: chainRows,
        source: "public",
        warnings: []
      });
    }
  };
}
