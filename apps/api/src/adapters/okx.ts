import type { ExchangeAdapter } from "./types.js";
import type { JsonHttpClient } from "../httpClient.js";
import type { ChainFundingStatus, SearchInput } from "@status-monitor/shared";
import { createOkxAuthHeaders } from "../signing.js";
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
    async searchCoin(input) {
      const { coin } = input;
      const spotId = `${coin}-USDT`;
      const swapId = `${coin}-USDT-SWAP`;
      const fundingPath = `/api/v5/asset/currencies?ccy=${coin}`;
      let fundingWarning = "";
      const fundingRequest = okxCredentialsComplete(input)
        ? client.getJson(`https://www.okx.com${fundingPath}`, {
            headers: createOkxAuthHeaders({
              ...input.credentials!.okx!,
              method: "GET",
              requestPath: fundingPath,
              timestamp: new Date().toISOString()
            })
          }).catch(() => {
            fundingWarning = "OKX private funding request failed. Check API key, passphrase, permissions, and IP whitelist.";
            return { code: "requires_api_key" };
          })
        : client.getJson(`https://www.okx.com${fundingPath}`).catch(() => ({
            code: "requires_api_key"
          }));
      const [spot, swap, funding] = await Promise.all([
        client.getJson(`https://www.okx.com/api/v5/public/instruments?instType=SPOT&instId=${spotId}`),
        client.getJson(`https://www.okx.com/api/v5/public/instruments?instType=SWAP&instId=${swapId}`),
        fundingRequest
      ]);

      const fundingRecord = objectRecord(funding);
      const fundingCode = String(fundingRecord.code ?? "");
      const chains =
        fundingCode === "0"
          ? asArray(fundingRecord.data).map((item): ChainFundingStatus => {
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
        source: fundingCode === "0" ? (okxCredentialsComplete(input) ? "api_key" : "public") : "mixed",
        warnings: fundingCode === "0" ? [] : [fundingWarning || "OKX funding currency endpoint requires API credentials in this environment."]
      });
    }
  };
}

function okxCredentialsComplete(input: SearchInput) {
  return Boolean(input.credentials?.okx?.apiKey && input.credentials.okx.apiSecret && input.credentials.okx.passphrase);
}
