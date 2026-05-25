import type { ExchangeAdapter } from "./types.js";
import type { JsonHttpClient } from "../httpClient.js";
import { asArray, objectRecord, statusResult, supportedWhen, unknownFundingChain } from "./utils.js";

export function createKrakenAdapter(client: JsonHttpClient): ExchangeAdapter {
  return {
    id: "kraken",
    name: "Kraken",
    async searchCoin({ coin }) {
      const [pairs, futures, assets] = await Promise.all([
        client.getJson(`https://api.kraken.com/0/public/AssetPairs?pair=${coin}USD`),
        client.getJson("https://futures.kraken.com/derivatives/api/v3/instruments"),
        client.getJson(`https://api.kraken.com/0/public/Assets?asset=${coin}`)
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
        chains: [unknownFundingChain()],
        source: "public",
        warnings: assetEnabled
          ? ["Kraken public asset status is enabled; detailed deposit and withdrawal methods require private API access."]
          : ["Kraken asset status is not enabled or unavailable."]
      });
    }
  };
}
