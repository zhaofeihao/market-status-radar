import type { ExchangeAdapter } from "./types.js";
import type { JsonHttpClient } from "../httpClient.js";
import { asArray, objectRecord, statusResult, supportedWhen } from "./utils.js";

function htxFundingStatus(status: unknown) {
  const normalized = String(status ?? "").toLowerCase();
  if (normalized === "allowed") {
    return "enabled" as const;
  }
  if (normalized === "prohibited") {
    return "disabled" as const;
  }
  return "unknown" as const;
}

export function createHtxAdapter(client: JsonHttpClient): ExchangeAdapter {
  return {
    id: "htx",
    name: "HTX",
    async searchCoin({ coin }) {
      const lowerCoin = coin.toLowerCase();
      const [symbols, swap, funding] = await Promise.all([
        client.getJson("https://api.huobi.pro/v1/common/symbols"),
        client.getJson(`https://api.hbdm.com/linear-swap-api/v1/swap_contract_info?contract_code=${coin}-USDT`),
        client.getJson(`https://api.huobi.pro/v2/reference/currencies?currency=${lowerCoin}`)
      ]);

      const symbolRows = asArray(objectRecord(symbols).data);
      const swapRows = asArray(objectRecord(swap).data);
      const fundingRows = asArray(objectRecord(funding).data);
      const chainRows = fundingRows.flatMap((item) =>
        asArray(objectRecord(item).chains).map((chainItem) => {
          const row = objectRecord(chainItem);
          return {
            chain: String(row.chain ?? "ALL").toUpperCase(),
            rawChain: String(row.chain ?? ""),
            deposit: htxFundingStatus(row.depositStatus),
            withdraw: htxFundingStatus(row.withdrawStatus),
            withdrawFee: row.withdrawFee === undefined ? undefined : String(row.withdrawFee),
            withdrawMin: row.minWithdrawAmt === undefined ? undefined : String(row.minWithdrawAmt)
          };
        })
      );

      return statusResult({
        exchange: { id: "htx", name: "HTX" },
        coin,
        spot: supportedWhen(
          symbolRows.some(
            (item) =>
              objectRecord(item)["base-currency"] === lowerCoin &&
              objectRecord(item)["quote-currency"] === "usdt" &&
              objectRecord(item).state === "online"
          )
        ),
        contract: supportedWhen(
          swapRows.some((item) => objectRecord(item).contract_code === `${coin}-USDT` && objectRecord(item).contract_status === 1)
        ),
        chains: chainRows,
        source: "public",
        warnings: []
      });
    }
  };
}
