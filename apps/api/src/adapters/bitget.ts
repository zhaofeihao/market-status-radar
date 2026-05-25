import type { ExchangeAdapter } from "./types.js";
import type { JsonHttpClient } from "../httpClient.js";
import { asArray, boolFunding, objectRecord, statusResult, supportedWhen } from "./utils.js";

export function createBitgetAdapter(client: JsonHttpClient): ExchangeAdapter {
  return {
    id: "bitget",
    name: "Bitget",
    async searchCoin({ coin }) {
      const symbol = `${coin}USDT`;
      const [spot, contracts, funding] = await Promise.all([
        client.getJson(`https://api.bitget.com/api/v2/spot/public/symbols?symbol=${symbol}`),
        client.getJson("https://api.bitget.com/api/v2/mix/market/contracts?productType=USDT-FUTURES"),
        client.getJson(`https://api.bitget.com/api/v2/spot/public/coins?coin=${coin}`)
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
        chains: chainRows,
        source: "public",
        warnings: []
      });
    }
  };
}
