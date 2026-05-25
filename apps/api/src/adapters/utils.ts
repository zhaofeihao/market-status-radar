import type { ChainFundingStatus, ExchangeCoinStatus, FundingStatus, SupportStatus } from "@status-monitor/shared";
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
