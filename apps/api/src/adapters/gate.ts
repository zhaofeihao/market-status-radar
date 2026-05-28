import type { ExchangeAdapter } from "./types.js";
import type { JsonHttpClient } from "../httpClient.js";
import type { ExchangePriceStatus } from "@status-monitor/shared";
import { asArray, boolFunding, objectRecord, priceResult, statusResult, stringValue, supportedWhen, unavailablePrice } from "./utils.js";

async function gatePrice(client: JsonHttpClient, pair: string): Promise<ExchangePriceStatus> {
  const [spot, futures] = await Promise.all([
    client.getJson(`https://api.gateio.ws/api/v4/spot/tickers?currency_pair=${pair}`).catch(() => undefined),
    client.getJson(`https://api.gateio.ws/api/v4/futures/usdt/tickers?contract=${pair}`).catch(() => undefined)
  ]);
  const spotRow = objectRecord(asArray(spot)[0]);
  const futuresRow = objectRecord(asArray(futures)[0]);
  const price = priceResult({
    quote: "USDT",
    spotLastPrice: stringValue(spotRow.last),
    contractLastPrice: stringValue(futuresRow.last),
    indexPrice: stringValue(futuresRow.index_price),
    markPrice: stringValue(futuresRow.mark_price)
  });

  return price.source === "public" ? price : unavailablePrice("USDT", ["Gate.io public price endpoints are unavailable."]);
}

export function createGateAdapter(client: JsonHttpClient): ExchangeAdapter {
  return {
    id: "gate",
    name: "Gate.io",
    async searchCoin({ coin }) {
      const pair = `${coin}_USDT`;
      const [spot, futures, chains, price] = await Promise.all([
        client.getJson(`https://api.gateio.ws/api/v4/spot/currency_pairs/${pair}`),
        client.getJson(`https://api.gateio.ws/api/v4/futures/usdt/contracts/${pair}`),
        client.getJson(`https://api.gateio.ws/api/v4/wallet/currency_chains?currency=${coin}`),
        gatePrice(client, pair)
      ]);

      const chainRows = asArray(chains).map((item) => {
        const row = objectRecord(item);
        const chain = String(row.chain ?? row.name ?? "ALL").toUpperCase();
        return {
          chain,
          rawChain: String(row.chain ?? row.name ?? ""),
          deposit: boolFunding(row.is_deposit_disabled, 0),
          withdraw: boolFunding(row.is_withdraw_disabled, 0)
        };
      });

      return statusResult({
        exchange: { id: "gate", name: "Gate.io" },
        coin,
        spot: supportedWhen(objectRecord(spot).trade_status === "tradable"),
        contract: supportedWhen(objectRecord(futures).in_delisting === false),
        price,
        chains: chainRows,
        source: "public",
        warnings: []
      });
    }
  };
}
