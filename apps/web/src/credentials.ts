import type { SearchCredentials } from "@status-monitor/shared";

export const CREDENTIAL_STORAGE_KEY = "exchangeStatusMonitor.credentials.v1";

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeCredentials(credentials: SearchCredentials): SearchCredentials {
  const normalized: SearchCredentials = {};

  if (clean(credentials.binance?.apiKey) && clean(credentials.binance?.apiSecret)) {
    normalized.binance = {
      apiKey: clean(credentials.binance?.apiKey),
      apiSecret: clean(credentials.binance?.apiSecret)
    };
  }

  if (clean(credentials.okx?.apiKey) && clean(credentials.okx?.apiSecret) && clean(credentials.okx?.passphrase)) {
    normalized.okx = {
      apiKey: clean(credentials.okx?.apiKey),
      apiSecret: clean(credentials.okx?.apiSecret),
      passphrase: clean(credentials.okx?.passphrase)
    };
  }

  if (clean(credentials.bybit?.apiKey) && clean(credentials.bybit?.apiSecret)) {
    normalized.bybit = {
      apiKey: clean(credentials.bybit?.apiKey),
      apiSecret: clean(credentials.bybit?.apiSecret)
    };
  }

  return normalized;
}

export function loadCredentials(): SearchCredentials {
  try {
    const raw = window.localStorage.getItem(CREDENTIAL_STORAGE_KEY);
    return raw ? normalizeCredentials(JSON.parse(raw) as SearchCredentials) : {};
  } catch {
    return {};
  }
}

export function saveCredentials(credentials: SearchCredentials): SearchCredentials {
  const normalized = normalizeCredentials(credentials);
  if (Object.keys(normalized).length === 0) {
    window.localStorage.removeItem(CREDENTIAL_STORAGE_KEY);
    return {};
  }
  window.localStorage.setItem(CREDENTIAL_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function clearCredentials() {
  window.localStorage.removeItem(CREDENTIAL_STORAGE_KEY);
}

export function hasCredentials(credentials: SearchCredentials): boolean {
  return Object.keys(normalizeCredentials(credentials)).length > 0;
}
