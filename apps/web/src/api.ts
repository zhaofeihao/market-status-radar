import type { SearchCredentials, SearchResponse, TradfiSearchResponse } from "@status-monitor/shared";
import { hasCredentials, normalizeCredentials } from "./credentials.js";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.PROD ? "" : "http://localhost:4000");

export async function searchCoin(coin: string, credentials: SearchCredentials = {}): Promise<SearchResponse> {
  const normalizedCredentials = normalizeCredentials(credentials);
  const response = hasCredentials(normalizedCredentials)
    ? await fetch(`${apiBaseUrl}/api/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coin, credentials: normalizedCredentials })
      })
    : await fetch(`${apiBaseUrl}/api/search?coin=${encodeURIComponent(coin)}`);
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Search failed with HTTP ${response.status}`);
  }
  return (await response.json()) as SearchResponse;
}

export async function searchTradfiMarket(symbol: string): Promise<TradfiSearchResponse> {
  const response = await fetch(`${apiBaseUrl}/api/tradfi/search?symbol=${encodeURIComponent(symbol)}`);
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `TradFi search failed with HTTP ${response.status}`);
  }
  return (await response.json()) as TradfiSearchResponse;
}
