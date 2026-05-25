import type { AppConfig } from "../config.js";
import type { ExchangeAdapter } from "./types.js";
import { createJsonHttpClient } from "../httpClient.js";
import { createBinanceAdapter } from "./binance.js";
import { createBitgetAdapter } from "./bitget.js";
import { createBybitAdapter } from "./bybit.js";
import { createGateAdapter } from "./gate.js";
import { createHtxAdapter } from "./htx.js";
import { createKrakenAdapter } from "./kraken.js";
import { createOkxAdapter } from "./okx.js";

export function createDefaultAdapters(config: AppConfig): ExchangeAdapter[] {
  const client = createJsonHttpClient(config.requestTimeoutMs);
  return [
    createBinanceAdapter(client),
    createOkxAdapter(client),
    createBybitAdapter(client),
    createGateAdapter(client),
    createKrakenAdapter(client),
    createBitgetAdapter(client),
    createHtxAdapter(client)
  ];
}
