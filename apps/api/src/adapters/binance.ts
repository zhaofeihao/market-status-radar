import type { ExchangeAdapter } from "./types.js";
import type { JsonHttpClient } from "../httpClient.js";
import { authRequiredChain, asArray, objectRecord, statusResult, supportedWhen } from "./utils.js";

export function createBinanceAdapter(client: JsonHttpClient): ExchangeAdapter {
  return {
    id: "binance",
    name: "Binance",
    async searchCoin({ coin }) {
      const symbol = `${coin}USDT`;
      const [spot, futures] = await Promise.all([
        client.getJson(`https://api.binance.com/api/v3/exchangeInfo?symbol=${symbol}`),
        client.getJson("https://fapi.binance.com/fapi/v1/exchangeInfo")
      ]);

      const spotSymbols = asArray(objectRecord(spot).symbols);
      const futuresSymbols = asArray(objectRecord(futures).symbols);

      return statusResult({
        exchange: { id: "binance", name: "Binance" },
        coin,
        spot: supportedWhen(spotSymbols.some((item) => objectRecord(item).symbol === symbol && objectRecord(item).status === "TRADING")),
        contract: supportedWhen(
          futuresSymbols.some((item) => objectRecord(item).symbol === symbol && objectRecord(item).status === "TRADING")
        ),
        chains: [authRequiredChain()],
        source: "mixed",
        warnings: ["Binance deposit and withdrawal status requires signed wallet API access."]
      });
    }
  };
}
