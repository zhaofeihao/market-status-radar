import type { ChainFundingStatus, ExchangePriceStatus, SearchInput } from "@status-monitor/shared";
import type { ExchangeAdapter } from "./types.js";
import type { JsonHttpClient } from "../httpClient.js";
import { createBybitAuthHeaders } from "../signing.js";
import { asArray, authRequiredChain, objectRecord, priceResult, statusResult, stringValue, supportedWhen, unavailablePrice } from "./utils.js";

function bybitList(payload: unknown): unknown[] {
  return asArray(objectRecord(objectRecord(payload).result).list);
}

function bybitFundingRows(payload: unknown): unknown[] {
  const result = objectRecord(objectRecord(payload).result);
  const list = asArray(result.list);
  if (list.length > 0) {
    return list;
  }
  return asArray(result.rows);
}

function bybitChains(payload: unknown): unknown[] {
  return bybitFundingRows(payload).flatMap((item) => asArray(objectRecord(item).chains));
}

function bybitCredentialsComplete(input: SearchInput) {
  return Boolean(input.credentials?.bybit?.apiKey && input.credentials.bybit.apiSecret);
}

function bybitFundingStatus(value: unknown) {
  const normalized = String(value ?? "").toLowerCase();
  if (normalized === "1" || normalized === "true") {
    return "enabled" as const;
  }
  if (normalized === "0" || normalized === "false") {
    return "disabled" as const;
  }
  return "unknown" as const;
}

async function bybitPrice(client: JsonHttpClient, symbol: string): Promise<ExchangePriceStatus> {
  const [spot, linear] = await Promise.all([
    client.getJson(`https://api.bybit.com/v5/market/tickers?category=spot&symbol=${symbol}`).catch(() => undefined),
    client.getJson(`https://api.bybit.com/v5/market/tickers?category=linear&symbol=${symbol}`).catch(() => undefined)
  ]);
  const spotRow = objectRecord(bybitList(spot)[0]);
  const linearRow = objectRecord(bybitList(linear)[0]);
  const price = priceResult({
    quote: "USDT",
    spotLastPrice: stringValue(spotRow.lastPrice),
    contractLastPrice: stringValue(linearRow.lastPrice),
    indexPrice: stringValue(linearRow.indexPrice ?? spotRow.usdIndexPrice),
    markPrice: stringValue(linearRow.markPrice)
  });

  return price.source === "public" ? price : unavailablePrice("USDT", ["Bybit public price endpoints are unavailable."]);
}

export function createBybitAdapter(client: JsonHttpClient): ExchangeAdapter {
  return {
    id: "bybit",
    name: "Bybit",
    async searchCoin(input) {
      const { coin } = input;
      const symbol = `${coin}USDT`;
      const fundingQuery = new URLSearchParams({ coin }).toString();
      const fundingRequest = bybitCredentialsComplete(input)
        ? client.getJson(`https://api.bybit.com/v5/asset/coin/query-info?${fundingQuery}`, {
            headers: createBybitAuthHeaders({
              apiKey: input.credentials!.bybit!.apiKey,
              apiSecret: input.credentials!.bybit!.apiSecret,
              queryString: fundingQuery,
              timestamp: String(Date.now()),
              recvWindow: "5000"
            })
          })
        : client.getJson(`https://api.bybit.com/v5/asset/coin/query-info?${fundingQuery}`);
      const [spot, linear, funding, price] = await Promise.all([
        client.getJson(`https://api.bybit.com/v5/market/instruments-info?category=spot&symbol=${symbol}`),
        client.getJson(`https://api.bybit.com/v5/market/instruments-info?category=linear&symbol=${symbol}`),
        fundingRequest,
        bybitPrice(client, symbol)
      ]);

      const fundingRecord = objectRecord(funding);
      const retCode = Number(fundingRecord.retCode);
      const chains =
        retCode === 0
          ? bybitChains(funding).map((item): ChainFundingStatus => {
              const row = objectRecord(item);
              return {
                chain: String(row.chain ?? row.chainType ?? "ALL").toUpperCase(),
                rawChain: String(row.chain ?? row.chainType ?? ""),
                deposit: bybitFundingStatus(row.chainDeposit ?? row.depositStatus),
                withdraw: bybitFundingStatus(row.chainWithdraw ?? row.withdrawStatus),
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
        price,
        chains,
        source: retCode === 0 ? (bybitCredentialsComplete(input) ? "api_key" : "public") : "mixed",
        warnings: retCode === 0 ? [] : ["Bybit coin chain funding status requires API credentials in this environment."]
      });
    }
  };
}
