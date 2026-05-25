import type { ExchangeCoinStatus, ExchangeIdentity, SearchInput } from "@status-monitor/shared";

export interface ExchangeAdapter extends ExchangeIdentity {
  searchCoin(input: SearchInput): Promise<ExchangeCoinStatus>;
}
