import { describe, expect, it } from "vitest";
import type { JsonHttpClient } from "../src/httpClient.js";
import {
  createBinanceTradfiAdapter,
  createBitgetTradfiAdapter,
  createBybitTradfiAdapter,
  createGateTradfiAdapter,
  createOkxTradfiAdapter
} from "../src/tradfi/adapters.js";

function client(handler: (url: string) => unknown): JsonHttpClient {
  return {
    async getJson(url) {
      return handler(url);
    }
  };
}

describe("tradfi market adapters", () => {
  it("maps Bybit ticker fields from one public response", async () => {
    const adapter = createBybitTradfiAdapter(
      client(() => ({
        result: {
          list: [
            {
              symbol: "TSLAUSDT",
              lastPrice: "436.24",
              indexPrice: "435.86",
              markPrice: "436.24",
              volume24h: "415.6900",
              turnover24h: "181857.9585",
              openInterest: "4070.88",
              openInterestValue: "1775880.69",
              fundingRate: "0",
              nextFundingTime: "1780272000000"
            }
          ]
        }
      }))
    );

    await expect(adapter.searchMarket({ symbol: "TSLA" })).resolves.toMatchObject({
      contractSymbol: "TSLAUSDT",
      status: "supported",
      lastPrice: "436.24",
      markPrice: "436.24",
      indexPrice: "435.86",
      volume24hBase: "415.6900",
      volume24hQuote: "181857.9585",
      openInterest: "4070.88",
      openInterestUsd: "1775880.69",
      fundingRate: "0"
    });
  });

  it("combines OKX ticker, funding, and open interest responses", async () => {
    const adapter = createOkxTradfiAdapter(
      client((url) => {
        if (url.includes("/market/ticker")) {
          return { data: [{ instId: "TSLA-USDT-SWAP", last: "436.5", vol24h: "3059.73" }] };
        }
        if (url.includes("/funding-rate")) {
          return { data: [{ fundingRate: "0.0001", nextFundingTime: "1780300800000" }] };
        }
        return { data: [{ oi: "13229.75", oiUsd: "5774785.87", ts: "1780248122389" }] };
      })
    );

    await expect(adapter.searchMarket({ symbol: "TSLA" })).resolves.toMatchObject({
      contractSymbol: "TSLA-USDT-SWAP",
      lastPrice: "436.5",
      markPrice: "436.5",
      volume24hBase: "3059.73",
      fundingRate: "0.0001",
      openInterest: "13229.75",
      openInterestUsd: "5774785.87"
    });
  });

  it("maps Bitget ticker, funding, and open interest responses", async () => {
    const adapter = createBitgetTradfiAdapter(
      client((url) => {
        if (url.includes("/ticker?")) {
          return { data: [{ symbol: "TSLAUSDT", lastPr: "435.75", indexPrice: "435.43", markPrice: "435.75", baseVolume: "2952.16", quoteVolume: "1290274.637" }] };
        }
        if (url.includes("/current-fund-rate")) {
          return { data: [{ fundingRate: "0", fundingRateInterval: "8", nextUpdate: "1780272000000" }] };
        }
        return { data: { openInterestList: [{ symbol: "TSLAUSDT", size: "26455.58" }] } };
      })
    );

    await expect(adapter.searchMarket({ symbol: "TSLA" })).resolves.toMatchObject({
      contractSymbol: "TSLAUSDT",
      markPrice: "435.75",
      indexPrice: "435.43",
      volume24hBase: "2952.16",
      volume24hQuote: "1290274.637",
      fundingRate: "0",
      fundingIntervalHours: "8",
      openInterest: "26455.58"
    });
  });

  it("maps Gate ticker fields for underscore contract symbols", async () => {
    const adapter = createGateTradfiAdapter(
      client(() => [
        {
          contract: "MSFT_USDT",
          last: "464.11",
          mark_price: "464.11",
          index_price: "461.469",
          volume_24h_base: "647",
          volume_24h_quote: "298130",
          funding_rate: "0.003499",
          total_size: "213404"
        }
      ])
    );

    await expect(adapter.searchMarket({ symbol: "MSFT" })).resolves.toMatchObject({
      contractSymbol: "MSFT_USDT",
      lastPrice: "464.11",
      markPrice: "464.11",
      indexPrice: "461.469",
      volume24hBase: "647",
      volume24hQuote: "298130",
      fundingRate: "0.003499",
      openInterest: "213404"
    });
  });

  it("maps Binance ticker, premium index, and open interest responses", async () => {
    const adapter = createBinanceTradfiAdapter(
      client((url) => {
        if (url.includes("/ticker/24hr")) {
          return { symbol: "TSLAUSDT", lastPrice: "436.20", volume: "170", quoteVolume: "74154" };
        }
        if (url.includes("/premiumIndex")) {
          return { symbol: "TSLAUSDT", markPrice: "436.19", indexPrice: "435.86", lastFundingRate: "0", nextFundingTime: 1780272000000 };
        }
        return { symbol: "TSLAUSDT", openInterest: "1020.5", time: 1780248122389 };
      })
    );

    await expect(adapter.searchMarket({ symbol: "TSLA" })).resolves.toMatchObject({
      contractSymbol: "TSLAUSDT",
      lastPrice: "436.20",
      markPrice: "436.19",
      indexPrice: "435.86",
      volume24hBase: "170",
      volume24hQuote: "74154",
      fundingRate: "0",
      openInterest: "1020.5"
    });
  });
});
