export type SupportStatus = "supported" | "unsupported" | "unknown" | "error";

export type FundingStatus = "enabled" | "disabled" | "unknown" | "requires_api_key" | "error";

export type DataSource = "public" | "api_key" | "mixed" | "unavailable";

export interface SearchInput {
  coin: string;
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

export interface ExchangeCoinStatus {
  exchange: ExchangeIdentity;
  coin: string;
  spot: SupportStatus;
  contract: SupportStatus;
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
    chains: [],
    source: "unavailable",
    warnings: [message],
    updatedAt
  };
}
