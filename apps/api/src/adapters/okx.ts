import type { ExchangeAdapter } from "./types.js";
import type { JsonHttpClient } from "../httpClient.js";
import { asArray, authRequiredChain, objectRecord, statusResult, supportedWhen } from "./utils.js";

function okxMarketSupported(payload: unknown, instId: string): boolean {
  const data = asArray(objectRecord(payload).data);
  return data.some((item) => {
    const row = objectRecord(item);
    const state = String(row.state ?? "live").toLowerCase();
    return row.instId === instId && state !== "suspend" && state !== "offline";
  });
}

export function createOkxAdapter(client: JsonHttpClient): ExchangeAdapter {
  return {
    id: "okx",
    name: "OKX",
    async searchCoin({ coin }) {
      const spotId = `${coin}-USDT`;
      const swapId = `${coin}-USDT-SWAP`;
      const [spot, swap, funding] = await Promise.all([
        client.getJson(`https://www.okx.com/api/v5/public/instruments?instType=SPOT&instId=${spotId}`),
        client.getJson(`https://www.okx.com/api/v5/public/instruments?instType=SWAP&instId=${swapId}`),
        client.getJson(`https://www.okx.com/api/v5/asset/currencies?ccy=${coin}`)
      ]);

      const fundingRecord = objectRecord(funding);
      const fundingCode = String(fundingRecord.code ?? "");
      const chains =
        fundingCode === "0"
          ? asArray(fundingRecord.data).map((item) => {
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
        chains,
        source: fundingCode === "0" ? "public" : "mixed",
        warnings: fundingCode === "0" ? [] : ["OKX funding currency endpoint requires API credentials in this environment."]
      });
    }
  };
}
