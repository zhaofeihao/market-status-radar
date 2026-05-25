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
});
