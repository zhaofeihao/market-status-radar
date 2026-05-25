import type { ExchangeAdapter } from "./types.js";
import type { JsonHttpClient } from "../httpClient.js";
import { asArray, boolFunding, objectRecord, statusResult, supportedWhen } from "./utils.js";

export function createGateAdapter(client: JsonHttpClient): ExchangeAdapter {
  return {
    id: "gate",
    name: "Gate.io",
    async searchCoin({ coin }) {
      const pair = `${coin}_USDT`;
      const [spot, futures, chains] = await Promise.all([
        client.getJson(`https://api.gateio.ws/api/v4/spot/currency_pairs/${pair}`),
        client.getJson(`https://api.gateio.ws/api/v4/futures/usdt/contracts/${pair}`),
        client.getJson(`https://api.gateio.ws/api/v4/wallet/currency_chains?currency=${coin}`)
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
        chains: chainRows,
        source: "public",
        warnings: []
      });
    }
  };
}
