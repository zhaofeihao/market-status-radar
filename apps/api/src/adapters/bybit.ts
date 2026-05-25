import type { ExchangeAdapter } from "./types.js";
import type { JsonHttpClient } from "../httpClient.js";
import { asArray, authRequiredChain, objectRecord, statusResult, supportedWhen } from "./utils.js";

function bybitList(payload: unknown): unknown[] {
  return asArray(objectRecord(objectRecord(payload).result).list);
}

export function createBybitAdapter(client: JsonHttpClient): ExchangeAdapter {
  return {
    id: "bybit",
    name: "Bybit",
    async searchCoin({ coin }) {
      const symbol = `${coin}USDT`;
      const [spot, linear, funding] = await Promise.all([
        client.getJson(`https://api.bybit.com/v5/market/instruments-info?category=spot&symbol=${symbol}`),
        client.getJson(`https://api.bybit.com/v5/market/instruments-info?category=linear&symbol=${symbol}`),
        client.getJson(`https://api.bybit.com/v5/asset/coin/query-info?coin=${coin}`)
      ]);

      const fundingRecord = objectRecord(funding);
      const retCode = Number(fundingRecord.retCode);
      const chains =
        retCode === 0
          ? bybitList(funding).map((item) => {
              const row = objectRecord(item);
              return {
                chain: String(row.chain ?? row.chainType ?? "ALL").toUpperCase(),
                rawChain: String(row.chain ?? row.chainType ?? ""),
                deposit: String(row.chainDeposit ?? row.depositStatus ?? "").toLowerCase() === "1" ? "enabled" : "unknown",
                withdraw: String(row.chainWithdraw ?? row.withdrawStatus ?? "").toLowerCase() === "1" ? "enabled" : "unknown",
                withdrawFee: row.withdrawFee === undefined ? undefined : String(row.withdrawFee),
                withdrawMin: row.withdrawMin === undefined ? undefined : String(row.withdrawMin)
              };
            })
          : [authRequiredChain()];

      return statusResult({
        exchange: { id: "bybit", name: "Bybit" },
        coin,
        spot: supportedWhen(bybitList(spot).some((item) => objectRecord(item).symbol === symbol && objectRecord(item).status === "Trading")),
        contract: supportedWhen(
          bybitList(linear).some((item) => objectRecord(item).symbol === symbol && objectRecord(item).status === "Trading")
        ),
        chains,
        source: retCode === 0 ? "public" : "mixed",
        warnings: retCode === 0 ? [] : ["Bybit coin chain funding status requires API credentials in this environment."]
      });
    }
  };
}
