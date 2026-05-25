import type { AppConfig } from "../config.js";
import type { ExchangeAdapter } from "./types.js";

export function createDefaultAdapters(_config: AppConfig): ExchangeAdapter[] {
  return [];
}
