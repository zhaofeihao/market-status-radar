import type { ExchangeAdapter } from "./types.js";
import { HttpError, type JsonHttpClient } from "../httpClient.js";
import type { ChainFundingStatus, ExchangeIndexComponent, ExchangePriceStatus, SearchInput } from "@status-monitor/shared";
import { createBinanceSignedQuery } from "../signing.js";
import { authRequiredChain, asArray, objectRecord, priceResult, statusResult, stringValue, supportedWhen, unavailablePrice } from "./utils.js";

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

function binanceUnsupportedSymbol(error: unknown): boolean {
  return error instanceof HttpError && error.status === 400;
}

async function safeBinanceSpot(client: JsonHttpClient, symbol: string): Promise<unknown> {
  try {
    return await client.getJson(`https://api.binance.com/api/v3/exchangeInfo?symbol=${symbol}`);
  } catch (error) {
    if (binanceUnsupportedSymbol(error)) {
      return { symbols: [] };
    }
    return { symbols: undefined };
  }
}

async function safeBinanceFutures(client: JsonHttpClient): Promise<unknown> {
  try {
    return await client.getJson("https://fapi.binance.com/fapi/v1/exchangeInfo");
  } catch {
    return { symbols: undefined };
  }
}

async function binancePrice(client: JsonHttpClient, symbol: string): Promise<ExchangePriceStatus> {
  const [spot, contract, premium, constituents] = await Promise.all([
    client.getJson(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`).catch(() => undefined),
    client.getJson(`https://fapi.binance.com/fapi/v1/ticker/price?symbol=${symbol}`).catch(() => undefined),
    client.getJson(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${symbol}`).catch(() => undefined),
    client.getJson(`https://fapi.binance.com/fapi/v1/constituents?symbol=${symbol}`).catch(() => undefined)
  ]);
  const spotRecord = objectRecord(spot);
  const contractRecord = objectRecord(contract);
  const premiumRecord = objectRecord(premium);
  const indexComponents = asArray(objectRecord(constituents).constituents).map((item): ExchangeIndexComponent => {
    const row = objectRecord(item);
    return {
      exchange: String(row.exchange ?? "unknown"),
      symbol: stringValue(row.symbol),
      price: stringValue(row.price),
      weight: stringValue(row.weight)
    };
  });
  const price = priceResult({
    quote: "USDT",
    spotLastPrice: stringValue(spotRecord.price),
    contractLastPrice: stringValue(contractRecord.price),
    indexPrice: stringValue(premiumRecord.indexPrice),
    markPrice: stringValue(premiumRecord.markPrice),
    indexComponents
  });

  return price.source === "public" ? price : unavailablePrice("USDT", ["Binance public price endpoints are unavailable."]);
}

export function createBinanceAdapter(client: JsonHttpClient): ExchangeAdapter {
  return {
    id: "binance",
    name: "Binance",
    async searchCoin(input) {
      const { coin } = input;
      const symbol = `${coin}USDT`;
      let fundingWarning = "";
      const fundingPromise = hasBinanceCredentials(input)
        ? client.getJson(
            `https://api.binance.com/sapi/v1/capital/config/getall?${createBinanceSignedQuery(
              { timestamp: String(Date.now()) },
              input.credentials!.binance!.apiSecret
            )}`,
            { headers: { "X-MBX-APIKEY": input.credentials!.binance!.apiKey } }
          ).catch(() => {
            fundingWarning = "Binance private funding request failed. Check API key permissions, timestamp, and IP whitelist.";
            return undefined;
          })
        : Promise.resolve(undefined);
      const [spot, futures, funding, price] = await Promise.all([
        safeBinanceSpot(client, symbol),
        safeBinanceFutures(client),
        fundingPromise,
        binancePrice(client, symbol)
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
        price,
        chains: funding ? mapBinanceChains(funding, coin) : [authRequiredChain()],
        source: funding ? "api_key" : "mixed",
        warnings: funding
          ? []
          : [fundingWarning || "Binance deposit and withdrawal status requires signed wallet API access."]
      });
    }
  };
}
