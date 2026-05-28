import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App.js";
import type { SearchResponse } from "@status-monitor/shared";

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

function mockFetch(payload: SearchResponse = response) {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    json: async () => payload
  })) as unknown as typeof fetch;
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
});
