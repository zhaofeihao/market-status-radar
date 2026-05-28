import type {
  ChainFundingStatus,
  DataSource,
  ExchangeCoinStatus,
  ExchangeIndexComponent,
  ExchangePriceStatus,
  FundingStatus,
  SupportStatus
} from "@status-monitor/shared";
import type { JsonHttpClient } from "../httpClient.js";

export interface AdapterContext {
  client: JsonHttpClient;
}

export function boolFunding(value: unknown, enabledValue: boolean | string | number = true): FundingStatus {
  if (value === undefined) {
    return "unknown";
  }
  if (typeof value === "string") {
    return value.toLowerCase() === String(enabledValue).toLowerCase() ? "enabled" : "disabled";
  }
  return value === enabledValue ? "enabled" : "disabled";
}

export function supportedWhen(condition: boolean | undefined): SupportStatus {
  if (condition === undefined) {
    return "unknown";
  }
  return condition ? "supported" : "unsupported";
}

export function authRequiredChain(): ChainFundingStatus {
  return { chain: "ALL", deposit: "requires_api_key", withdraw: "requires_api_key" };
}

export function unknownFundingChain(): ChainFundingStatus {
  return { chain: "ALL", deposit: "unknown", withdraw: "unknown" };
}

export function unavailablePrice(quote = "USDT", warnings: string[] = []): ExchangePriceStatus {
  return { quote, source: "unavailable", indexComponentSource: "unavailable", indexComponents: [], warnings };
}

export function priceResult(
  input: Omit<ExchangePriceStatus, "source" | "warnings" | "indexComponentSource" | "indexComponents"> & {
    indexComponentSource?: DataSource;
    indexComponents?: ExchangeIndexComponent[];
    warnings?: string[];
  }
): ExchangePriceStatus {
  const hasPrice = Boolean(input.spotLastPrice || input.contractLastPrice || input.indexPrice || input.markPrice);
  return {
    ...input,
    source: hasPrice ? "public" : "unavailable",
    indexComponentSource: input.indexComponentSource ?? (input.indexComponents?.length ? "public" : "unavailable"),
    indexComponents: input.indexComponents ?? [],
    warnings: input.warnings ?? []
  };
}

export function stringValue(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  return String(value);
}

export function statusResult(input: Omit<ExchangeCoinStatus, "updatedAt">): ExchangeCoinStatus {
  return {
    ...input,
    updatedAt: new Date().toISOString()
  };
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function objectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export function firstDataRecord(payload: unknown): Record<string, unknown> {
  return objectRecord(asArray(objectRecord(payload).data)[0]);
}
