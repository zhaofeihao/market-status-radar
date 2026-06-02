import type { DataSource, TradfiMarketQuote } from "@status-monitor/shared";
import type { JsonHttpClient } from "../httpClient.js";
import { asArray, firstDataRecord, objectRecord, stringValue } from "../adapters/utils.js";
import type { TradfiMarketAdapter } from "./types.js";

function isoFromMs(value: unknown): string | undefined {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return undefined;
  }
  return new Date(numeric).toISOString();
}

function estimateUsd(size: unknown, price: unknown, multiplier: unknown = 1): string | undefined {
  const numericSize = Number(size);
  const numericPrice = Number(price);
  const numericMultiplier = Number(multiplier);
  if (!Number.isFinite(numericSize) || !Number.isFinite(numericPrice) || !Number.isFinite(numericMultiplier)) {
    return undefined;
  }
  return (numericSize * numericPrice * numericMultiplier).toFixed(2);
}

function marketQuote(input: Omit<TradfiMarketQuote, "quoteAsset" | "source" | "warnings" | "updatedAt"> & {
  quoteAsset?: string;
  source?: DataSource;
  warnings?: string[];
}): TradfiMarketQuote {
  return {
    quoteAsset: "USDT",
    source: "public",
    warnings: [],
    updatedAt: new Date().toISOString(),
    ...input
  };
}

function unsupported(id: string, name: string, symbol: string, contractSymbol: string): TradfiMarketQuote {
  return marketQuote({
    exchange: { id, name },
    querySymbol: symbol,
    contractSymbol,
    status: "unsupported",
    source: "unavailable",
    warnings: [`${name} does not list ${contractSymbol}.`]
  });
}

export function createBybitTradfiAdapter(client: JsonHttpClient): TradfiMarketAdapter {
  return {
    id: "bybit",
    name: "Bybit",
    async searchMarket({ symbol }) {
      const contractSymbol = `${symbol}USDT`;
      const payload = await client.getJson(`https://api.bybit.com/v5/market/tickers?category=linear&symbol=${contractSymbol}`);
      const row = objectRecord(asArray(objectRecord(objectRecord(payload).result).list)[0]);
      if (!row.symbol) {
        return unsupported("bybit", "Bybit", symbol, contractSymbol);
      }

      return marketQuote({
        exchange: { id: "bybit", name: "Bybit" },
        querySymbol: symbol,
        contractSymbol,
        status: "supported",
        lastPrice: stringValue(row.lastPrice),
        markPrice: stringValue(row.markPrice),
        indexPrice: stringValue(row.indexPrice),
        bidPrice: stringValue(row.bid1Price),
        askPrice: stringValue(row.ask1Price),
        fundingRate: stringValue(row.fundingRate),
        nextFundingTime: isoFromMs(row.nextFundingTime),
        volume24hBase: stringValue(row.volume24h),
        volume24hQuote: stringValue(row.turnover24h),
        openInterest: stringValue(row.openInterest),
        openInterestUsd: stringValue(row.openInterestValue)
      });
    }
  };
}

export function createOkxTradfiAdapter(client: JsonHttpClient): TradfiMarketAdapter {
  return {
    id: "okx",
    name: "OKX",
    async searchMarket({ symbol }) {
      const contractSymbol = `${symbol}-USDT-SWAP`;
      const [ticker, funding, openInterest] = await Promise.all([
        client.getJson(`https://www.okx.com/api/v5/market/ticker?instId=${contractSymbol}`).catch(() => undefined),
        client.getJson(`https://www.okx.com/api/v5/public/funding-rate?instId=${contractSymbol}`).catch(() => undefined),
        client.getJson(`https://www.okx.com/api/v5/public/open-interest?instType=SWAP&instId=${contractSymbol}`).catch(() => undefined)
      ]);
      const tickerRow = firstDataRecord(ticker);
      if (!tickerRow.instId) {
        return unsupported("okx", "OKX", symbol, contractSymbol);
      }
      const fundingRow = firstDataRecord(funding);
      const oiRow = firstDataRecord(openInterest);

      return marketQuote({
        exchange: { id: "okx", name: "OKX" },
        querySymbol: symbol,
        contractSymbol,
        status: "supported",
        lastPrice: stringValue(tickerRow.last),
        markPrice: stringValue(tickerRow.last),
        fundingRate: stringValue(fundingRow.fundingRate),
        nextFundingTime: isoFromMs(fundingRow.nextFundingTime),
        volume24hBase: stringValue(tickerRow.vol24h),
        openInterest: stringValue(oiRow.oi),
        openInterestUsd: stringValue(oiRow.oiUsd)
      });
    }
  };
}

export function createBitgetTradfiAdapter(client: JsonHttpClient): TradfiMarketAdapter {
  return {
    id: "bitget",
    name: "Bitget",
    async searchMarket({ symbol }) {
      const contractSymbol = `${symbol}USDT`;
      const productType = "USDT-FUTURES";
      const [ticker, funding, openInterest] = await Promise.all([
        client.getJson(`https://api.bitget.com/api/v2/mix/market/ticker?symbol=${contractSymbol}&productType=${productType}`).catch(() => undefined),
        client.getJson(`https://api.bitget.com/api/v2/mix/market/current-fund-rate?symbol=${contractSymbol}&productType=${productType}`).catch(() => undefined),
        client.getJson(`https://api.bitget.com/api/v2/mix/market/open-interest?symbol=${contractSymbol}&productType=${productType}`).catch(() => undefined)
      ]);
      const tickerRow = objectRecord(asArray(objectRecord(ticker).data)[0]);
      if (!tickerRow.symbol) {
        return unsupported("bitget", "Bitget", symbol, contractSymbol);
      }
      const fundingRow = objectRecord(asArray(objectRecord(funding).data)[0]);
      const oiRow = objectRecord(asArray(objectRecord(objectRecord(openInterest).data).openInterestList)[0]);

      return marketQuote({
        exchange: { id: "bitget", name: "Bitget" },
        querySymbol: symbol,
        contractSymbol,
        status: "supported",
        lastPrice: stringValue(tickerRow.lastPr),
        markPrice: stringValue(tickerRow.markPrice ?? tickerRow.lastPr),
        indexPrice: stringValue(tickerRow.indexPrice),
        fundingRate: stringValue(fundingRow.fundingRate),
        nextFundingTime: isoFromMs(fundingRow.nextUpdate),
        fundingIntervalHours: stringValue(fundingRow.fundingRateInterval),
        volume24hBase: stringValue(tickerRow.baseVolume),
        volume24hQuote: stringValue(tickerRow.quoteVolume),
        openInterest: stringValue(oiRow.size),
        openInterestUsd: estimateUsd(oiRow.size, tickerRow.markPrice ?? tickerRow.lastPr)
      });
    }
  };
}

export function createGateTradfiAdapter(client: JsonHttpClient): TradfiMarketAdapter {
  return {
    id: "gate",
    name: "Gate.io",
    async searchMarket({ symbol }) {
      const contractSymbol = `${symbol}_USDT`;
      const payload = await client.getJson(`https://api.gateio.ws/api/v4/futures/usdt/tickers?contract=${contractSymbol}`);
      const row = objectRecord(asArray(payload)[0]);
      if (!row.contract) {
        return unsupported("gate", "Gate.io", symbol, contractSymbol);
      }

      return marketQuote({
        exchange: { id: "gate", name: "Gate.io" },
        querySymbol: symbol,
        contractSymbol,
        status: "supported",
        lastPrice: stringValue(row.last),
        markPrice: stringValue(row.mark_price),
        indexPrice: stringValue(row.index_price),
        bidPrice: stringValue(row.highest_bid),
        askPrice: stringValue(row.lowest_ask),
        fundingRate: stringValue(row.funding_rate),
        volume24hBase: stringValue(row.volume_24h_base),
        volume24hQuote: stringValue(row.volume_24h_quote ?? row.volume_24h_settle),
        openInterest: stringValue(row.total_size),
        openInterestUsd: estimateUsd(row.total_size, row.mark_price ?? row.last, row.quanto_multiplier)
      });
    }
  };
}

export function createBinanceTradfiAdapter(client: JsonHttpClient): TradfiMarketAdapter {
  return {
    id: "binance",
    name: "Binance",
    async searchMarket({ symbol }) {
      const contractSymbol = `${symbol}USDT`;
      const [ticker, premium, openInterest] = await Promise.all([
        client.getJson(`https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=${contractSymbol}`).catch(() => undefined),
        client.getJson(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${contractSymbol}`).catch(() => undefined),
        client.getJson(`https://fapi.binance.com/fapi/v1/openInterest?symbol=${contractSymbol}`).catch(() => undefined)
      ]);
      const tickerRow = objectRecord(ticker);
      if (!tickerRow.symbol) {
        return unsupported("binance", "Binance", symbol, contractSymbol);
      }
      const premiumRow = objectRecord(premium);
      const oiRow = objectRecord(openInterest);

      return marketQuote({
        exchange: { id: "binance", name: "Binance" },
        querySymbol: symbol,
        contractSymbol,
        status: "supported",
        lastPrice: stringValue(tickerRow.lastPrice),
        markPrice: stringValue(premiumRow.markPrice ?? tickerRow.lastPrice),
        indexPrice: stringValue(premiumRow.indexPrice),
        fundingRate: stringValue(premiumRow.lastFundingRate),
        nextFundingTime: isoFromMs(premiumRow.nextFundingTime),
        volume24hBase: stringValue(tickerRow.volume),
        volume24hQuote: stringValue(tickerRow.quoteVolume),
        openInterest: stringValue(oiRow.openInterest),
        openInterestUsd: estimateUsd(oiRow.openInterest, premiumRow.markPrice ?? tickerRow.lastPrice)
      });
    }
  };
}
