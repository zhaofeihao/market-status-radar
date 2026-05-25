import { createErrorStatus, normalizeCoin, type SearchCredentials, type SearchResponse } from "@status-monitor/shared";
import type { ExchangeAdapter } from "../adapters/types.js";

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }
  return "exchange request failed";
}

export async function searchCoinAcrossExchanges(
  coinInput: string,
  adapters: ExchangeAdapter[],
  credentials?: SearchCredentials
): Promise<SearchResponse> {
  const coin = normalizeCoin(coinInput);
  const results = await Promise.all(
    adapters.map(async (adapter) => {
      try {
        return await adapter.searchCoin({ coin, credentials });
      } catch (error) {
        return createErrorStatus({ id: adapter.id, name: adapter.name }, coin, errorMessage(error));
      }
    })
  );

  return {
    coin,
    results,
    updatedAt: new Date().toISOString()
  };
}
