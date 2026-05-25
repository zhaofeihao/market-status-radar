import type { ExchangeAdapter } from "./types.js";
import type { JsonHttpClient } from "../httpClient.js";
import type { ChainFundingStatus, SearchInput } from "@status-monitor/shared";
import { createBinanceSignedQuery } from "../signing.js";
import { authRequiredChain, asArray, objectRecord, statusResult, supportedWhen } from "./utils.js";

function hasBinanceCredentials(input: SearchInput) {
  return Boolean(input.credentials?.binance?.apiKey && input.credentials.binance.apiSecret);
}

function mapBinanceChains(payload: unknown, coin: string): ChainFundingStatus[] {
  const coinRows = asArray(payload);
  const coinRow = coinRows.map(objectRecord).find((row) => String(row.coin ?? "").toUpperCase() === coin);
  return asArray(coinRow?.networkList).map((item): ChainFundingStatus => {
    const row = objectRecord(item);
    return {
      chain: String(row.network ?? row.name ?? "ALL").toUpperCase(),
      rawChain: String(row.network ?? row.name ?? ""),
      deposit: row.depositEnable === true ? "enabled" : "disabled",
      withdraw: row.withdrawEnable === true ? "enabled" : "disabled",
      withdrawFee: row.withdrawFee === undefined ? undefined : String(row.withdrawFee),
      withdrawMin: row.withdrawMin === undefined ? undefined : String(row.withdrawMin)
    };
  });
}

export function createBinanceAdapter(client: JsonHttpClient): ExchangeAdapter {
  return {
    id: "binance",
    name: "Binance",
    async searchCoin(input) {
      const { coin } = input;
      const symbol = `${coin}USDT`;
      const fundingPromise = hasBinanceCredentials(input)
        ? client.getJson(
            `https://api.binance.com/sapi/v1/capital/config/getall?${createBinanceSignedQuery(
              { timestamp: String(Date.now()) },
              input.credentials!.binance!.apiSecret
            )}`,
            { headers: { "X-MBX-APIKEY": input.credentials!.binance!.apiKey } }
          )
        : Promise.resolve(undefined);
      const [spot, futures, funding] = await Promise.all([
        client.getJson(`https://api.binance.com/api/v3/exchangeInfo?symbol=${symbol}`),
        client.getJson("https://fapi.binance.com/fapi/v1/exchangeInfo"),
        fundingPromise
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
        chains: funding ? mapBinanceChains(funding, coin) : [authRequiredChain()],
        source: funding ? "api_key" : "mixed",
        warnings: funding ? [] : ["Binance deposit and withdrawal status requires signed wallet API access."]
      });
    }
  };
}
