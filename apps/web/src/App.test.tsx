import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App.js";
import type { SearchResponse, TradfiSearchResponse } from "@status-monitor/shared";

const response: SearchResponse = {
  coin: "SOL",
  updatedAt: "2026-05-25T00:00:00.000Z",
  results: [
    {
      exchange: { id: "bitget", name: "Bitget" },
      coin: "SOL",
      spot: "supported",
      contract: "supported",
      price: {
        quote: "USDT",
        spotLastPrice: "81.13",
        contractLastPrice: "81.08",
        indexPrice: "81.12",
        markPrice: "81.07",
        source: "public",
        indexComponentSource: "public",
        indexComponents: [
          { exchange: "BINANCE", symbol: "SOL/USDT", price: "81.17", weight: "0.37" },
          { exchange: "OKX", symbol: "SOL/USDT", price: "81.19", weight: "0.09" }
        ],
        warnings: []
      },
      chains: [{ chain: "SOL", deposit: "enabled", withdraw: "disabled", withdrawFee: "0.006" }],
      source: "public",
      warnings: [],
      updatedAt: "2026-05-25T00:00:00.000Z"
    },
    {
      exchange: { id: "binance", name: "Binance" },
      coin: "SOL",
      spot: "supported",
      contract: "supported",
      price: {
        quote: "USDT",
        source: "unavailable",
        indexComponentSource: "unavailable",
        indexComponents: [],
        warnings: ["Binance price endpoints are unavailable."]
      },
      chains: [{ chain: "ALL", deposit: "requires_api_key", withdraw: "requires_api_key" }],
      source: "mixed",
      warnings: ["Binance deposit and withdrawal status requires signed wallet API access."],
      updatedAt: "2026-05-25T00:00:00.000Z"
    }
  ]
};

const tradfiResponse: TradfiSearchResponse = {
  symbol: "TSLA",
  updatedAt: "2026-06-01T00:00:00.000Z",
  spread: {
    sourceField: "markPrice",
    lowExchange: "Bybit",
    highExchange: "OKX",
    lowPrice: "436.24",
    highPrice: "438.42",
    absolute: "2.18",
    percent: "0.5000",
    lowFundingRate: "0",
    highFundingRate: "0.0001",
    fundingRateDiff: "0.0001"
  },
  results: [
    {
      exchange: { id: "bybit", name: "Bybit" },
      querySymbol: "TSLA",
      contractSymbol: "TSLAUSDT",
      status: "supported",
      quoteAsset: "USDT",
      lastPrice: "436.24",
      markPrice: "436.24",
      indexPrice: "435.86",
      premium: "0.000871839",
      fundingRate: "0.0006",
      nextFundingTime: "2026-06-01T08:00:00.000Z",
      volume24hBase: "415.6900",
      volume24hQuote: "181857.9585",
      openInterest: "4070.88",
      openInterestUsd: "1775880.69",
      source: "public",
      warnings: [],
      updatedAt: "2026-06-01T00:00:00.000Z"
    },
    {
      exchange: { id: "okx", name: "OKX" },
      querySymbol: "TSLA",
      contractSymbol: "TSLA-USDT-SWAP",
      status: "supported",
      quoteAsset: "USDT",
      lastPrice: "438.5",
      markPrice: "438.42",
      indexPrice: "435.80",
      premium: "0.006",
      fundingRate: "0.0001",
      openInterestUsd: "5774785.87",
      source: "public",
      warnings: [],
      updatedAt: "2026-06-01T00:00:00.000Z"
    }
  ]
};

function mockFetch(payload: SearchResponse = response) {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    json: async () => payload
  })) as unknown as typeof fetch;
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function mockFetchRoutes() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    return {
      ok: true,
      json: async () => (url.includes("/api/tradfi/search") ? tradfiResponse : response)
    };
  }) as unknown as typeof fetch;
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("App", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("renders the initial search console", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: /exchange status monitor/i })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /coin/i })).toHaveValue("SOL");
    expect(screen.getByRole("button", { name: /search/i })).toBeInTheDocument();
  });

  it("searches a coin and renders status rows", async () => {
    const fetchMock = mockFetch();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);

    await user.click(screen.getByRole("button", { name: /search/i }));

    await screen.findByText("Bitget");
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:4000/api/search?coin=SOL");
    expect(screen.getByText("2 exchanges")).toBeInTheDocument();
    expect(screen.getByText("81.13")).toBeInTheDocument();
    expect(screen.getByText("81.08")).toBeInTheDocument();
    expect(screen.queryByText("Spot 81.13")).not.toBeInTheDocument();
    expect(screen.queryByText("Contract 81.08")).not.toBeInTheDocument();
    expect(screen.queryByText("Index 81.12")).not.toBeInTheDocument();
    expect(screen.queryByText("Mark 81.07")).not.toBeInTheDocument();
    expect(screen.queryByText("Price")).not.toBeInTheDocument();
    expect(screen.getByText("Components 2")).toBeInTheDocument();
    expect(screen.getByText("Components 2").closest("details")).not.toHaveAttribute("open");
    expect(screen.getByText("Withdraw disabled")).toBeInTheDocument();
    expect(screen.getByText("Requires API key")).toBeInTheDocument();
  });

  it("links supported spot and contract markets to exchange trading pages", async () => {
    mockFetch();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);

    await user.click(screen.getByRole("button", { name: /search/i }));
    await screen.findByText("Bitget");

    const bitgetSpot = screen.getByRole("link", { name: /open bitget sol usdt spot market/i });
    const bitgetContract = screen.getByRole("link", { name: /open bitget sol usdt contract market/i });
    const binanceSpot = screen.getByRole("link", { name: /open binance sol usdt spot market/i });
    const binanceContract = screen.getByRole("link", { name: /open binance sol usdt contract market/i });

    expect(bitgetSpot).toHaveAttribute("href", "https://www.bitget.com/spot/SOLUSDT");
    expect(bitgetContract).toHaveAttribute("href", "https://www.bitget.com/futures/usdt/SOLUSDT");
    expect(binanceSpot).toHaveAttribute("href", "https://www.binance.com/en/trade/SOL_USDT?type=spot");
    expect(binanceContract).toHaveAttribute("href", "https://www.binance.com/en/futures/SOLUSDT");
    expect(bitgetSpot).toHaveAttribute("target", "_blank");
    expect(bitgetSpot).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("normalizes composite price quotes before building trading links", async () => {
    mockFetch({
      coin: "SOL",
      updatedAt: "2026-05-25T00:00:00.000Z",
      results: [
        {
          exchange: { id: "okx", name: "OKX" },
          coin: "SOL",
          spot: "supported",
          contract: "supported",
          price: {
            quote: "USDT/USD",
            source: "public",
            indexComponentSource: "public",
            indexComponents: [],
            warnings: []
          },
          chains: [],
          source: "public",
          warnings: [],
          updatedAt: "2026-05-25T00:00:00.000Z"
        }
      ]
    });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);

    await user.click(screen.getByRole("button", { name: /search/i }));
    await screen.findByText("OKX");

    expect(screen.getByRole("link", { name: /open okx sol usdt spot market/i })).toHaveAttribute(
      "href",
      "https://www.okx.com/trade-spot/sol-usdt"
    );
    expect(screen.getByRole("link", { name: /open okx sol usdt contract market/i })).toHaveAttribute(
      "href",
      "https://www.okx.com/trade-swap/sol-usdt-swap"
    );
  });

  it("filters rows that need API key", async () => {
    mockFetch();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);

    await user.click(screen.getByRole("button", { name: /search/i }));
    await screen.findByText("Bitget");
    await user.click(screen.getByRole("button", { name: /needs api key/i }));

    expect(screen.queryByText("Bitget")).not.toBeInTheDocument();
    expect(screen.getByText("Binance")).toBeInTheDocument();
  });

  it("refreshes the current result manually", async () => {
    const fetchMock = mockFetch();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);

    await user.click(screen.getByRole("button", { name: /search/i }));
    await screen.findByText("Bitget");
    await user.click(screen.getByRole("button", { name: /refresh/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it("saves API keys locally and sends them with searches", async () => {
    const fetchMock = mockFetch();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);

    await user.click(screen.getByRole("button", { name: /api keys/i }));
    await user.type(screen.getByLabelText("Binance API key"), "binance-key");
    await user.type(screen.getByLabelText("Binance API secret"), "binance-secret");
    await user.click(screen.getByRole("button", { name: /save api keys/i }));

    expect(screen.getByText("Binance configured locally")).toBeInTheDocument();
    expect(window.localStorage.getItem("exchangeStatusMonitor.credentials.v1")).toContain("binance-key");

    await user.click(screen.getByRole("button", { name: /search/i }));

    await screen.findByText("Bitget");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/search",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          coin: "SOL",
          credentials: {
            binance: {
              apiKey: "binance-key",
              apiSecret: "binance-secret"
            }
          }
        })
      })
    );
  });

  it("clears locally saved API keys", async () => {
    window.localStorage.setItem(
      "exchangeStatusMonitor.credentials.v1",
      JSON.stringify({ binance: { apiKey: "binance-key", apiSecret: "binance-secret" } })
    );
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);

    await user.click(screen.getByRole("button", { name: /api keys/i }));
    expect(screen.getByText("Binance configured locally")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /clear api keys/i }));

    expect(window.localStorage.getItem("exchangeStatusMonitor.credentials.v1")).toBeNull();
    expect(screen.getByText("Binance missing")).toBeInTheDocument();
  });

  it("navigates to stock perpetuals and renders cross-exchange market data", async () => {
    const fetchMock = mockFetchRoutes();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);

    await user.click(screen.getByRole("link", { name: /stock perps/i }));
    await user.click(screen.getByRole("button", { name: /search/i }));

    await screen.findByText("TSLAUSDT");
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:4000/api/tradfi/search?symbol=TSLA");
    expect(screen.getByRole("heading", { name: /stock perpetual monitor/i })).toBeInTheDocument();
    expect(screen.getByText("0.5000%")).toBeInTheDocument();
    expect(screen.getByText("Funding diff 0.0100%")).toBeInTheDocument();
    expect(screen.getByText("Arb Lens")).toBeInTheDocument();
    expect(screen.getByText("Premium Spread")).toBeInTheDocument();
    expect(screen.getByText("0.5128%")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /good/i })).toBeInTheDocument();
    expect(screen.getByText("436.24")).toBeInTheDocument();
    expect(screen.getByText("0.0872%")).toBeInTheDocument();
    expect(screen.getByText("$1.78M")).toBeInTheDocument();
    expect(screen.getByText("0.0100%")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /good/i }));

    expect(screen.getByRole("dialog", { name: /bybit arbitrage signal/i })).toBeInTheDocument();
    expect(screen.getByText("Short perp / long index bias")).toBeInTheDocument();
    expect(screen.getByText(/Funding > 0.05% with premium inside normal zone/i)).toBeInTheDocument();
  });

  it("links supported stock perpetual contracts to exchange trading pages", async () => {
    mockFetchRoutes();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);

    await user.click(screen.getByRole("link", { name: /stock perps/i }));
    await user.click(screen.getByRole("button", { name: /search/i }));

    await screen.findByText("TSLAUSDT");

    expect(screen.getByRole("link", { name: /open bybit tslausdt stock perpetual market/i })).toHaveAttribute(
      "href",
      "https://www.bybit.com/trade/usdt/TSLAUSDT"
    );
    expect(screen.getByRole("link", { name: /open okx tsla-usdt-swap stock perpetual market/i })).toHaveAttribute(
      "href",
      "https://www.okx.com/trade-swap/tsla-usdt-swap"
    );
  });
});
