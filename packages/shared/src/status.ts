export type SupportStatus = "supported" | "unsupported" | "unknown" | "error";

export type FundingStatus = "enabled" | "disabled" | "unknown" | "requires_api_key" | "error";

export type DataSource = "public" | "api_key" | "mixed" | "unavailable";

export interface SearchInput {
  coin: string;
  credentials?: SearchCredentials;
}

export interface BasicApiCredentials {
  apiKey: string;
  apiSecret: string;
}

export interface OkxApiCredentials extends BasicApiCredentials {
  passphrase: string;
}

export interface SearchCredentials {
  binance?: BasicApiCredentials;
  okx?: OkxApiCredentials;
  bybit?: BasicApiCredentials;
  gate?: BasicApiCredentials;
  kraken?: BasicApiCredentials;
  bitget?: BasicApiCredentials;
  htx?: BasicApiCredentials;
}

export interface ExchangeIdentity {
  id: string;
  name: string;
}

export interface ChainFundingStatus {
  chain: string;
  rawChain?: string;
  deposit: FundingStatus;
  withdraw: FundingStatus;
  withdrawFee?: string;
  withdrawMin?: string;
}

export interface ExchangeIndexComponent {
  exchange: string;
  symbol?: string;
  price?: string;
  weight?: string;
}

export interface ExchangePriceStatus {
  quote: string;
  spotLastPrice?: string;
  contractLastPrice?: string;
  indexPrice?: string;
  markPrice?: string;
  source: DataSource;
  indexComponentSource: DataSource;
  indexComponents: ExchangeIndexComponent[];
  warnings: string[];
}

export interface ExchangeCoinStatus {
  exchange: ExchangeIdentity;
  coin: string;
  spot: SupportStatus;
  contract: SupportStatus;
  price: ExchangePriceStatus;
  chains: ChainFundingStatus[];
  source: DataSource;
  warnings: string[];
  updatedAt: string;
}

export interface SearchResponse {
  coin: string;
  results: ExchangeCoinStatus[];
  updatedAt: string;
}

export function normalizeCoin(input: string): string {
  return input.trim().toUpperCase();
}

export function createErrorStatus(
  exchange: ExchangeIdentity,
  coin: string,
  message: string,
  updatedAt = new Date().toISOString()
): ExchangeCoinStatus {
  return {
    exchange,
    coin: normalizeCoin(coin),
    spot: "error",
    contract: "error",
    price: { quote: "USDT", source: "unavailable", indexComponentSource: "unavailable", indexComponents: [], warnings: [message] },
    chains: [],
    source: "unavailable",
    warnings: [message],
    updatedAt
  };
}
