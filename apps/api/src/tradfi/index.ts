import type { AppConfig } from "../config.js";
import { createJsonHttpClient } from "../httpClient.js";
import {
  createBinanceTradfiAdapter,
  createBitgetTradfiAdapter,
  createBybitTradfiAdapter,
  createGateTradfiAdapter,
  createOkxTradfiAdapter
} from "./adapters.js";
import type { TradfiMarketAdapter } from "./types.js";

export function createDefaultTradfiAdapters(config: AppConfig): TradfiMarketAdapter[] {
  const client = createJsonHttpClient(config.requestTimeoutMs);
  return [
    createBinanceTradfiAdapter(client),
    createOkxTradfiAdapter(client),
    createBybitTradfiAdapter(client),
    createGateTradfiAdapter(client),
    createBitgetTradfiAdapter(client)
  ];
}
