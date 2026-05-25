import type { SearchResponse } from "@status-monitor/shared";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

export async function searchCoin(coin: string): Promise<SearchResponse> {
  const response = await fetch(`${apiBaseUrl}/api/search?coin=${encodeURIComponent(coin)}`);
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Search failed with HTTP ${response.status}`);
  }
  return (await response.json()) as SearchResponse;
}
