import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
import { AlertTriangle, BarChart3, CheckCircle2, ExternalLink, Info, KeyRound, RefreshCcw, Save, Search, Trash2, WalletCards, X, XCircle } from "lucide-react";
import type {
  ExchangeCoinStatus,
  FundingStatus,
  SearchCredentials,
  SearchResponse,
  SupportStatus,
  TradfiMarketQuote,
  TradfiSearchResponse
} from "@status-monitor/shared";
import { searchCoin, searchTradfiMarket } from "./api.js";
import { clearCredentials, hasCredentials, loadCredentials, saveCredentials } from "./credentials.js";

type Route = "status" | "tradfi";
type FilterMode = "all" | "tradable" | "deposit_disabled" | "withdraw_disabled" | "needs_api_key" | "unknown";
type TradeMarket = "spot" | "contract";
type ArbTone = "good" | "watch" | "risk" | "mixed" | "muted";
type ArbSignal = {
  label: string;
  tone: ArbTone;
  zone: string;
  direction: string;
  thesis: string;
  oiRead: string;
  risk: string;
};
type PremiumSpread = {
  value: number;
  low: TradfiMarketQuote;
  high: TradfiMarketQuote;
};
type DraftCredentials = {
  binance: { apiKey: string; apiSecret: string };
  okx: { apiKey: string; apiSecret: string; passphrase: string };
  bybit: { apiKey: string; apiSecret: string };
};

const filters: Array<{ value: FilterMode; label: string }> = [
  { value: "all", label: "All" },
  { value: "tradable", label: "Tradable" },
  { value: "deposit_disabled", label: "Deposit disabled" },
  { value: "withdraw_disabled", label: "Withdraw disabled" },
  { value: "needs_api_key", label: "Needs API key" },
  { value: "unknown", label: "Unknown" }
];

function supportLabel(status: SupportStatus) {
  return status === "supported" ? "Supported" : status === "unsupported" ? "Unsupported" : status === "error" ? "Error" : "Unknown";
}

function fundingLabel(status: FundingStatus) {
  if (status === "requires_api_key") {
    return "Requires API key";
  }
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function StatusBadge({ status }: { status: SupportStatus | FundingStatus }) {
  const tone =
    status === "supported" || status === "enabled"
      ? "good"
      : status === "unsupported" || status === "disabled"
        ? "bad"
        : status === "requires_api_key"
          ? "key"
          : status === "error"
            ? "error"
            : "muted";
  const Icon = tone === "good" ? CheckCircle2 : tone === "bad" || tone === "error" ? XCircle : tone === "key" ? KeyRound : AlertTriangle;
  const label = status === "supported" || status === "unsupported" ? supportLabel(status) : fundingLabel(status as FundingStatus);

  return (
    <span className={`badge badge-${tone}`}>
      <Icon aria-hidden="true" size={14} />
      {label}
    </span>
  );
}

function exchangeTradeUrl(row: ExchangeCoinStatus, market: TradeMarket) {
  const base = row.coin.toUpperCase();
  const quote = (row.price?.quote || "USDT").split(/[/-]/u)[0]!.toUpperCase();
  const compactPair = `${base}${quote}`;
  const underscorePair = `${base}_${quote}`;
  const dashedPair = `${base}-${quote}`;
  const lowerDashedPair = dashedPair.toLowerCase();
  const lowerUnderscorePair = underscorePair.toLowerCase();

  switch (row.exchange.id) {
    case "binance":
      return market === "spot"
        ? `https://www.binance.com/en/trade/${underscorePair}?type=spot`
        : `https://www.binance.com/en/futures/${compactPair}`;
    case "okx":
      return market === "spot"
        ? `https://www.okx.com/trade-spot/${lowerDashedPair}`
        : `https://www.okx.com/trade-swap/${lowerDashedPair}-swap`;
    case "bybit":
      return market === "spot"
        ? `https://www.bybit.com/trade/spot/${base}/${quote}`
        : `https://www.bybit.com/trade/usdt/${compactPair}`;
    case "bitget":
      return market === "spot"
        ? `https://www.bitget.com/spot/${compactPair}`
        : `https://www.bitget.com/futures/usdt/${compactPair}`;
    case "gate":
      return market === "spot"
        ? `https://www.gate.com/trade/${underscorePair}`
        : `https://www.gate.com/futures/USDT/${underscorePair}`;
    case "htx":
      return market === "spot"
        ? `https://www.htx.com/trade/${lowerUnderscorePair}?type=spot`
        : `https://www.htx.com/futures/linear_swap/exchange#contract_code=${dashedPair}&contract_type=swap`;
    case "kraken":
      return market === "spot"
        ? `https://pro.kraken.com/app/trade/${dashedPair}`
        : `https://futures.kraken.com/trade/futures/PF_${base}${quote}`;
    default:
      return undefined;
  }
}

function MarketStatusCell({ row, market }: { row: ExchangeCoinStatus; market: TradeMarket }) {
  const status = market === "spot" ? row.spot : row.contract;
  const href = status === "supported" ? exchangeTradeUrl(row, market) : undefined;
  const quote = (row.price?.quote || "USDT").split(/[/-]/u)[0]!.toUpperCase();

  if (!href) {
    return <StatusBadge status={status} />;
  }

  return (
    <a
      className="market-link"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Open ${row.exchange.name} ${row.coin} ${quote} ${market} market`}
      title={`Open ${row.exchange.name} ${market} market`}
    >
      <StatusBadge status={status} />
      <ExternalLink aria-hidden="true" size={13} />
    </a>
  );
}

function tradfiTradeUrl(row: TradfiMarketQuote) {
  const symbol = row.contractSymbol.toUpperCase();
  const compactSymbol = symbol.replace(/[-_]/gu, "").replace(/SWAP$/u, "");
  const lowerSymbol = symbol.toLowerCase();

  switch (row.exchange.id) {
    case "binance":
      return `https://www.binance.com/en/futures/${compactSymbol}`;
    case "okx":
      return `https://www.okx.com/trade-swap/${lowerSymbol}`;
    case "bybit":
      return `https://www.bybit.com/trade/usdt/${compactSymbol}`;
    case "bitget":
      return `https://www.bitget.com/futures/usdt/${compactSymbol}`;
    case "gate":
      return `https://www.gate.com/futures/USDT/${symbol.replace(/-/gu, "_")}`;
    default:
      return undefined;
  }
}

function TradfiContractCell({ row }: { row: TradfiMarketQuote }) {
  const href = row.status === "supported" && row.contractSymbol ? tradfiTradeUrl(row) : undefined;

  if (!href) {
    return (
      <div>
        <strong>{row.contractSymbol || "-"}</strong>
        <small>{row.status}</small>
      </div>
    );
  }

  return (
    <div className="contract-cell">
      <a
        className="contract-link"
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Open ${row.exchange.name} ${row.contractSymbol} stock perpetual market`}
        title={`Open ${row.exchange.name} stock perpetual market`}
      >
        <strong>{row.contractSymbol}</strong>
        <ExternalLink aria-hidden="true" size={13} />
      </a>
      <small>{row.status}</small>
    </div>
  );
}

function hasFunding(row: ExchangeCoinStatus, predicate: (status: FundingStatus) => boolean) {
  return row.chains.some((chain) => predicate(chain.deposit) || predicate(chain.withdraw));
}

function rowMatchesFilter(row: ExchangeCoinStatus, filter: FilterMode) {
  switch (filter) {
    case "tradable":
      return row.spot === "supported" || row.contract === "supported";
    case "deposit_disabled":
      return row.chains.some((chain) => chain.deposit === "disabled");
    case "withdraw_disabled":
      return row.chains.some((chain) => chain.withdraw === "disabled");
    case "needs_api_key":
      return hasFunding(row, (status) => status === "requires_api_key");
    case "unknown":
      return row.spot === "unknown" || row.contract === "unknown" || hasFunding(row, (status) => status === "unknown");
    default:
      return true;
  }
}

function formatTime(value?: string) {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(new Date(value));
}

function formatWeight(weight?: string) {
  const numeric = Number(weight);
  if (!Number.isFinite(numeric)) {
    return weight ?? "";
  }
  return `${(numeric <= 1 ? numeric * 100 : numeric).toFixed(2)}%`;
}

function formatCompactUsd(value?: string) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return value ?? "-";
  }
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2
  }).format(numeric);
}

function formatPercent(value?: string) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "-";
  }
  return `${(numeric * 100).toFixed(4)}%`;
}

function numericField(value?: string) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function premiumZone(premium?: number) {
  if (premium === undefined) {
    return "No premium data";
  }
  const absolute = Math.abs(premium);
  if (absolute <= 0.005) {
    return "Normal zone";
  }
  if (absolute < 0.01) {
    return "Neutral watch";
  }
  if (absolute <= 0.03) {
    return "Watch zone";
  }
  if (absolute <= 0.05) {
    return "High-risk watch";
  }
  return "Extreme zone";
}

function fundingDirection(funding?: number) {
  if (funding === undefined || Math.abs(funding) < 0.000001) {
    return "No funding edge";
  }
  return funding > 0 ? "Short perp / long index bias" : "Long perp / short index bias";
}

function evaluateArbSignal(row: TradfiMarketQuote): ArbSignal {
  const premium = numericField(row.premium);
  const funding = numericField(row.fundingRate);
  const zone = premiumZone(premium);
  const direction = fundingDirection(funding);
  const oiRead = row.openInterestUsd || row.openInterest
    ? "OI is available for sizing context. Direction still needs repeated refreshes or history to confirm whether positions are building."
    : "OI is unavailable on this venue, so position buildup cannot be confirmed here.";

  if (premium === undefined || funding === undefined) {
    return {
      label: "No data",
      tone: "muted",
      zone,
      direction,
      thesis: "Premium and funding are both required before this row can produce an arbitrage read.",
      oiRead,
      risk: "Skip direction scoring until both inputs are live."
    };
  }

  const absolutePremium = Math.abs(premium);
  const highFunding = Math.abs(funding) > 0.0005;
  const opposingBasis = Math.sign(premium) !== 0 && Math.sign(funding) !== 0 && Math.sign(premium) !== Math.sign(funding);

  if (absolutePremium > 0.05) {
    return {
      label: "Risk",
      tone: "risk",
      zone,
      direction,
      thesis: "Premium is beyond 5%, so basis risk dominates the funding edge.",
      oiRead,
      risk: "Extreme premium can keep widening before convergence. Treat leverage, liquidity, and liquidation distance as primary constraints."
    };
  }

  if (absolutePremium >= 0.03) {
    return {
      label: "Risk Watch",
      tone: "risk",
      zone,
      direction,
      thesis: "Premium is between 3% and 5%, which is already stretched even if funding is attractive.",
      oiRead,
      risk: "The trade can be correct on carry and still lose money if the premium expands faster than funding accrues."
    };
  }

  if (absolutePremium >= 0.01) {
    return {
      label: "Watch OI",
      tone: "watch",
      zone,
      direction,
      thesis: "Premium is in the 1% to 3% warning band. Funding alone is not enough; watch whether OI keeps increasing.",
      oiRead,
      risk: "Increasing OI may mean longs or shorts are still adding, so premium can continue expanding before it mean-reverts."
    };
  }

  if (absolutePremium > 0.005) {
    return {
      label: opposingBasis ? "Mixed" : "Neutral Watch",
      tone: opposingBasis ? "mixed" : "watch",
      zone,
      direction,
      thesis: opposingBasis
        ? "Funding direction and premium sign are not aligned, so entry basis can work against the carry."
        : "Premium is modest but outside the clean normal band. Wait for a tighter basis or stronger funding.",
      oiRead,
      risk: "This is not the clean funding-high, premium-small setup."
    };
  }

  if (highFunding) {
    return {
      label: "Good",
      tone: "good",
      zone,
      direction,
      thesis: "Funding > 0.05% with premium inside normal zone. This is the cleanest carry setup in the current rule set.",
      oiRead,
      risk: "Still confirm borrow, fees, slippage, funding timestamp, and whether the index leg is executable."
    };
  }

  return {
    label: opposingBasis ? "Mixed" : "Neutral",
    tone: opposingBasis ? "mixed" : "muted",
    zone,
    direction,
    thesis: opposingBasis
      ? "Premium is small, but the funding direction and basis sign are not aligned."
      : "Premium is normal, but funding is not high enough to create a strong carry signal.",
    oiRead,
    risk: "Low funding can be consumed by fees, slippage, and hedge financing."
  };
}

function premiumSpreadFromRows(rows: TradfiMarketQuote[]): PremiumSpread | undefined {
  const priced = rows
    .map((row) => ({ row, premium: numericField(row.premium) }))
    .filter((item): item is { row: TradfiMarketQuote; premium: number } => item.premium !== undefined);
  if (priced.length < 2) {
    return undefined;
  }
  const low = priced.reduce((best, item) => (item.premium < best.premium ? item : best), priced[0]!);
  const high = priced.reduce((best, item) => (item.premium > best.premium ? item : best), priced[0]!);
  return { value: high.premium - low.premium, low: low.row, high: high.row };
}

function bestArbSetup(rows: TradfiMarketQuote[]) {
  const evaluated = rows.map((row) => ({ row, signal: evaluateArbSignal(row), funding: Math.abs(numericField(row.fundingRate) ?? 0) }));
  return evaluated
    .filter((item) => item.signal.label === "Good")
    .sort((a, b) => b.funding - a.funding)[0] ?? evaluated.sort((a, b) => b.funding - a.funding)[0];
}

function summary(response: SearchResponse | null) {
  const rows = response?.results ?? [];
  return {
    exchanges: rows.length,
    spot: rows.filter((row) => row.spot === "supported").length,
    contract: rows.filter((row) => row.contract === "supported").length,
    needsKey: rows.filter((row) => hasFunding(row, (status) => status === "requires_api_key")).length
  };
}

function emptyCredentials(): DraftCredentials {
  return {
    binance: { apiKey: "", apiSecret: "" },
    okx: { apiKey: "", apiSecret: "", passphrase: "" },
    bybit: { apiKey: "", apiSecret: "" }
  };
}

function mergeCredentials(credentials: SearchCredentials): DraftCredentials {
  return {
    binance: {
      apiKey: credentials.binance?.apiKey ?? "",
      apiSecret: credentials.binance?.apiSecret ?? ""
    },
    okx: {
      apiKey: credentials.okx?.apiKey ?? "",
      apiSecret: credentials.okx?.apiSecret ?? "",
      passphrase: credentials.okx?.passphrase ?? ""
    },
    bybit: {
      apiKey: credentials.bybit?.apiKey ?? "",
      apiSecret: credentials.bybit?.apiSecret ?? ""
    }
  };
}

function exchangeConfigured(credentials: SearchCredentials, exchange: "binance" | "okx" | "bybit") {
  return hasCredentials({ [exchange]: credentials[exchange] });
}

function CredentialStatus({ credentials, exchange, label }: { credentials: SearchCredentials; exchange: "binance" | "okx" | "bybit"; label: string }) {
  const configured = exchangeConfigured(credentials, exchange);
  return (
    <span className={`credential-status ${configured ? "configured" : ""}`}>
      {label} {configured ? "configured locally" : "missing"}
    </span>
  );
}

function StatusPage() {
  const [coin, setCoin] = useState("SOL");
  const [activeCoin, setActiveCoin] = useState("");
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [filter, setFilter] = useState<FilterMode>("all");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [refreshIn, setRefreshIn] = useState(60);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [credentials, setCredentials] = useState<SearchCredentials>(() => loadCredentials());
  const [draftCredentials, setDraftCredentials] = useState<SearchCredentials>(() => mergeCredentials(loadCredentials()));

  const runSearch = useCallback(async (nextCoin = activeCoin || coin) => {
    const normalized = nextCoin.trim().toUpperCase();
    if (!normalized) {
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      const data = await searchCoin(normalized, credentials);
      setResult(data);
      setActiveCoin(data.coin);
      setRefreshIn(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setIsLoading(false);
    }
  }, [activeCoin, coin, credentials]);

  useEffect(() => {
    if (!activeCoin) {
      return;
    }

    const timer = window.setInterval(() => {
      setRefreshIn((current) => {
        if (current <= 1) {
          void runSearch(activeCoin);
          return 60;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [activeCoin, runSearch]);

  const counts = useMemo(() => summary(result), [result]);
  const rows = useMemo(() => (result?.results ?? []).filter((row) => rowMatchesFilter(row, filter)), [filter, result]);

  return (
    <>
      <section className="topbar">
        <div>
          <p className="eyebrow">Public API first</p>
          <h1>Exchange Status Monitor</h1>
          <p className="subtitle">Spot, contract, deposit, and withdrawal status across seven exchanges.</p>
        </div>

        <form
          className="searchbox"
          onSubmit={(event) => {
            event.preventDefault();
            void runSearch(coin);
          }}
        >
          <label htmlFor="coin-input">Coin</label>
          <div className="searchline">
            <input id="coin-input" value={coin} onChange={(event) => setCoin(event.target.value)} />
            <button type="submit" disabled={isLoading}>
              <Search aria-hidden="true" size={16} />
              Search
            </button>
            <button className="key-button" type="button" onClick={() => setSettingsOpen((open) => !open)}>
              <KeyRound aria-hidden="true" size={16} />
              API Keys
            </button>
          </div>
        </form>
      </section>

      {settingsOpen ? (
        <section className="credential-panel" aria-label="API key settings">
          <div className="credential-panel-head">
            <div>
              <h2>API Keys</h2>
              <p>Stored in this browser only. Sent to the local API only during searches.</p>
            </div>
            <div className="credential-actions">
              <button
                type="button"
                onClick={() => {
                  const saved = saveCredentials(draftCredentials);
                  setCredentials(saved);
                  setDraftCredentials(mergeCredentials(saved));
                }}
              >
                <Save aria-hidden="true" size={16} />
                Save API keys
              </button>
              <button
                type="button"
                onClick={() => {
                  clearCredentials();
                  setCredentials({});
                  setDraftCredentials(emptyCredentials());
                }}
              >
                <Trash2 aria-hidden="true" size={16} />
                Clear API keys
              </button>
            </div>
          </div>

          <div className="credential-grid">
            <fieldset>
              <legend>Binance</legend>
              <CredentialStatus credentials={credentials} exchange="binance" label="Binance" />
              <label htmlFor="binance-api-key">Binance API key</label>
              <input
                id="binance-api-key"
                value={draftCredentials.binance?.apiKey ?? ""}
                onChange={(event) =>
                  setDraftCredentials((current) => ({
                    ...current,
                    binance: { apiKey: event.target.value, apiSecret: current.binance?.apiSecret ?? "" }
                  }))
                }
              />
              <label htmlFor="binance-api-secret">Binance API secret</label>
              <input
                id="binance-api-secret"
                type="password"
                value={draftCredentials.binance?.apiSecret ?? ""}
                onChange={(event) =>
                  setDraftCredentials((current) => ({
                    ...current,
                    binance: { apiKey: current.binance?.apiKey ?? "", apiSecret: event.target.value }
                  }))
                }
              />
            </fieldset>

            <fieldset>
              <legend>OKX</legend>
              <CredentialStatus credentials={credentials} exchange="okx" label="OKX" />
              <label htmlFor="okx-api-key">OKX API key</label>
              <input
                id="okx-api-key"
                value={draftCredentials.okx?.apiKey ?? ""}
                onChange={(event) =>
                  setDraftCredentials((current) => ({
                    ...current,
                    okx: {
                      apiKey: event.target.value,
                      apiSecret: current.okx?.apiSecret ?? "",
                      passphrase: current.okx?.passphrase ?? ""
                    }
                  }))
                }
              />
              <label htmlFor="okx-api-secret">OKX API secret</label>
              <input
                id="okx-api-secret"
                type="password"
                value={draftCredentials.okx?.apiSecret ?? ""}
                onChange={(event) =>
                  setDraftCredentials((current) => ({
                    ...current,
                    okx: {
                      apiKey: current.okx?.apiKey ?? "",
                      apiSecret: event.target.value,
                      passphrase: current.okx?.passphrase ?? ""
                    }
                  }))
                }
              />
              <label htmlFor="okx-passphrase">OKX passphrase</label>
              <input
                id="okx-passphrase"
                type="password"
                value={draftCredentials.okx?.passphrase ?? ""}
                onChange={(event) =>
                  setDraftCredentials((current) => ({
                    ...current,
                    okx: {
                      apiKey: current.okx?.apiKey ?? "",
                      apiSecret: current.okx?.apiSecret ?? "",
                      passphrase: event.target.value
                    }
                  }))
                }
              />
            </fieldset>

            <fieldset>
              <legend>Bybit</legend>
              <CredentialStatus credentials={credentials} exchange="bybit" label="Bybit" />
              <label htmlFor="bybit-api-key">Bybit API key</label>
              <input
                id="bybit-api-key"
                value={draftCredentials.bybit?.apiKey ?? ""}
                onChange={(event) =>
                  setDraftCredentials((current) => ({
                    ...current,
                    bybit: { apiKey: event.target.value, apiSecret: current.bybit?.apiSecret ?? "" }
                  }))
                }
              />
              <label htmlFor="bybit-api-secret">Bybit API secret</label>
              <input
                id="bybit-api-secret"
                type="password"
                value={draftCredentials.bybit?.apiSecret ?? ""}
                onChange={(event) =>
                  setDraftCredentials((current) => ({
                    ...current,
                    bybit: { apiKey: current.bybit?.apiKey ?? "", apiSecret: event.target.value }
                  }))
                }
              />
            </fieldset>
          </div>

          <p className="public-only">Gate.io, Kraken, Bitget, and HTX continue using public endpoints in this version.</p>
        </section>
      ) : null}

      <section className="summary-grid" aria-label="Search summary">
        <div><span>{counts.exchanges} exchanges</span><p>covered</p></div>
        <div><span>{counts.spot} spot</span><p>markets</p></div>
        <div><span>{counts.contract} contracts</span><p>listed</p></div>
        <div><span>{counts.needsKey} need key</span><p>funding data</p></div>
      </section>

      <section className="toolbar" aria-label="Result controls">
        <div className="filters">
          {filters.map((item) => (
            <button
              className={filter === item.value ? "active" : ""}
              key={item.value}
              type="button"
              onClick={() => setFilter(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <button className="refresh" type="button" onClick={() => void runSearch(activeCoin || coin)} disabled={isLoading || (!activeCoin && !coin)}>
          <RefreshCcw aria-hidden="true" size={16} />
          Refresh
        </button>
        {activeCoin ? <p className="countdown">Auto-refresh in {refreshIn}s</p> : null}
      </section>

      {error ? <p className="error">{error}</p> : null}

      <section className="table-wrap" aria-label="Exchange results">
        <div className="result-table">
          <div className="table-head">
            <span>Exchange</span>
            <span>Spot</span>
            <span>Contract</span>
            <span>Components</span>
            <span>Deposit / withdraw chains</span>
            <span>Updated</span>
          </div>
          {rows.length === 0 ? (
            <div className="empty">{result ? "No rows match the selected filter." : "Search a coin to load live exchange status."}</div>
          ) : (
            rows.map((row) => (
              <article className="table-row" key={row.exchange.id}>
                <div className="exchange-cell">
                  <strong>{row.exchange.name}</strong>
                  <small>{row.source}</small>
                  <div className="price-tags">
                    {row.price?.spotLastPrice ? <span className="price-tag price-tag-spot">{row.price.spotLastPrice}</span> : null}
                    {row.price?.contractLastPrice ? (
                      <span className="price-tag price-tag-contract">{row.price.contractLastPrice}</span>
                    ) : null}
                  </div>
                </div>
                <MarketStatusCell row={row} market="spot" />
                <MarketStatusCell row={row} market="contract" />
                <div className="components-cell">
                  {row.price?.indexComponents.length ? (
                    <details className="index-components">
                      <summary>Components {row.price.indexComponents.length}</summary>
                      {row.price.indexComponents.map((component) => (
                        <div className="index-component" key={`${component.exchange}-${component.symbol ?? ""}`}>
                          <span>{component.exchange} {component.symbol ?? ""}</span>
                          {component.price ? <small>{component.price}</small> : null}
                          {component.weight ? <b>{formatWeight(component.weight)}</b> : null}
                        </div>
                      ))}
                    </details>
                  ) : row.price?.indexComponentSource === "unavailable" ? (
                    <small className="muted">Components unavailable</small>
                  ) : null}
                </div>
                <div className="chains">
                  {row.chains.length === 0 ? (
                    <span className="muted">No public chain data</span>
                  ) : (
                    row.chains.map((chain) => (
                      <div className="chain" key={`${row.exchange.id}-${chain.chain}-${chain.rawChain ?? ""}`}>
                        <strong>{chain.chain}</strong>
                        {chain.deposit === chain.withdraw ? (
                          <span>Deposit &amp; withdraw <StatusBadge status={chain.deposit} /></span>
                        ) : (
                          <>
                            <span>Deposit <StatusBadge status={chain.deposit} /></span>
                            <span>Withdraw <StatusBadge status={chain.withdraw} /></span>
                          </>
                        )}
                        {chain.withdrawFee ? <small>Fee {chain.withdrawFee}</small> : null}
                      </div>
                    ))
                  )}
                  {row.warnings.map((warning) => (
                    <p className="warning" key={warning}>{warning}</p>
                  ))}
                  {row.price?.warnings.map((warning) => (
                    <p className="warning" key={warning}>{warning}</p>
                  ))}
                </div>
                <time>{formatTime(row.updatedAt)}</time>
              </article>
            ))
          )}
        </div>
      </section>
    </>
  );
}

function tradfiSummary(response: TradfiSearchResponse | null) {
  const rows = response?.results ?? [];
  return {
    venues: rows.length,
    listed: rows.filter((row) => row.status === "supported").length,
    fundingRows: rows.filter((row) => row.fundingRate !== undefined).length,
    oiUsd: rows.reduce((sum, row) => sum + (Number(row.openInterestUsd) || 0), 0)
  };
}

function TradfiPage() {
  const [symbol, setSymbol] = useState("TSLA");
  const [activeSymbol, setActiveSymbol] = useState("");
  const [result, setResult] = useState<TradfiSearchResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [refreshIn, setRefreshIn] = useState(30);
  const [selectedSignalId, setSelectedSignalId] = useState("");

  const runSearch = useCallback(async (nextSymbol = activeSymbol || symbol) => {
    const normalized = nextSymbol.trim().toUpperCase();
    if (!normalized) {
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      const data = await searchTradfiMarket(normalized);
      setResult(data);
      setActiveSymbol(data.symbol);
      setRefreshIn(30);
    } catch (err) {
      setError(err instanceof Error ? err.message : "TradFi search failed");
    } finally {
      setIsLoading(false);
    }
  }, [activeSymbol, symbol]);

  useEffect(() => {
    if (!activeSymbol) {
      return;
    }

    const timer = window.setInterval(() => {
      setRefreshIn((current) => {
        if (current <= 1) {
          void runSearch(activeSymbol);
          return 30;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [activeSymbol, runSearch]);

  const counts = useMemo(() => tradfiSummary(result), [result]);
  const rows = result?.results ?? [];
  const premiumSpread = useMemo(() => premiumSpreadFromRows(rows), [rows]);
  const bestSetup = useMemo(() => bestArbSetup(rows), [rows]);
  const selectedSignalRow = rows.find((row) => row.exchange.id === selectedSignalId);
  const selectedSignal = selectedSignalRow ? evaluateArbSignal(selectedSignalRow) : undefined;

  return (
    <>
      <section className="topbar tradfi-topbar">
        <div>
          <p className="eyebrow">TradFi perpetuals</p>
          <h1>Stock Perpetual Monitor</h1>
          <p className="subtitle">Funding, volume, open interest, and cross-exchange price spread for USDT stock perpetuals.</p>
        </div>

        <form
          className="searchbox"
          onSubmit={(event) => {
            event.preventDefault();
            void runSearch(symbol);
          }}
        >
          <label htmlFor="tradfi-symbol-input">Stock symbol</label>
          <div className="searchline">
            <input id="tradfi-symbol-input" value={symbol} onChange={(event) => setSymbol(event.target.value)} />
            <button type="submit" disabled={isLoading}>
              <Search aria-hidden="true" size={16} />
              Search
            </button>
          </div>
        </form>
      </section>

      <section className="summary-grid tradfi-summary" aria-label="TradFi market summary">
        <div><span>{counts.venues} venues</span><p>queried</p></div>
        <div><span>{counts.listed} listed</span><p>contracts</p></div>
        <div><span>{counts.fundingRows} funding</span><p>rates live</p></div>
        <div><span>{formatCompactUsd(String(counts.oiUsd))}</span><p>reported OI</p></div>
      </section>

      <section className="arb-lens" aria-label="Arbitrage decision lens">
        <div className="arb-lens-head">
          <div>
            <span className="eyebrow">Arb Lens</span>
            <h2>Premium + Funding</h2>
          </div>
          <small title="Premium is (Perp - Index) / Index. Funding determines which side pays. OI helps judge whether positioning is still building.">
            <Info aria-hidden="true" size={15} />
            Rules tooltip
          </small>
        </div>
        <div className="arb-metrics">
          <div>
            <span title="Best row from the current rule set. Good signals require high absolute funding and premium inside +/-0.5%.">Best Setup</span>
            <b>{bestSetup ? bestSetup.row.exchange.name : "-"}</b>
            <small>{bestSetup ? bestSetup.signal.direction : "Search to score venues"}</small>
          </div>
          <div>
            <span title="Highest premium minus lowest premium across venues. Direction hints at cross-venue basis: short highest premium and long lowest premium.">Premium Spread</span>
            <b>{premiumSpread ? formatPercent(String(premiumSpread.value)) : "-"}</b>
            <small>{premiumSpread ? `${premiumSpread.high.exchange.name} high / ${premiumSpread.low.exchange.name} low` : "Need 2 premium values"}</small>
          </div>
          <div>
            <span title="Normal: within +/-0.5%. Watch: +/-1% to 3%. Extreme: beyond +/-5%.">Risk Zone</span>
            <b>{bestSetup ? bestSetup.signal.zone : "-"}</b>
            <small>{bestSetup ? bestSetup.signal.label : "No signal yet"}</small>
          </div>
        </div>
      </section>

      <section className="toolbar" aria-label="TradFi result controls">
        {result?.spread ? (
          <div className="spread-chip">
            <span>Max spread</span>
            <b>{result.spread.percent}%</b>
            <small>{result.spread.lowExchange} {result.spread.lowPrice} {"->"} {result.spread.highExchange} {result.spread.highPrice}</small>
            {result.spread.fundingRateDiff ? <small>Funding diff {formatPercent(result.spread.fundingRateDiff)}</small> : null}
          </div>
        ) : (
          <p className="countdown">Search a stock symbol to compare venues.</p>
        )}
        <button className="refresh" type="button" onClick={() => void runSearch(activeSymbol || symbol)} disabled={isLoading || (!activeSymbol && !symbol)}>
          <RefreshCcw aria-hidden="true" size={16} />
          Refresh
        </button>
        {activeSymbol ? <p className="countdown">Auto-refresh in {refreshIn}s</p> : null}
      </section>

      {error ? <p className="error">{error}</p> : null}

      <section className="table-wrap" aria-label="Stock perpetual results">
        <div className="result-table tradfi-table">
          <div className="table-head tradfi-head">
            <span>Exchange</span>
            <span>Contract</span>
            <span>Price</span>
            <span>Premium</span>
            <span>Signal</span>
            <span>Funding</span>
            <span>Volume 24h</span>
            <span>Open interest</span>
            <span>Updated</span>
          </div>
          {rows.length === 0 ? (
            <div className="empty">Search a stock symbol to load live perpetual markets.</div>
          ) : (
            rows.map((row: TradfiMarketQuote) => {
              const signal = evaluateArbSignal(row);
              return (
              <article className="table-row tradfi-row" key={row.exchange.id}>
                <div className="exchange-cell">
                  <strong>{row.exchange.name}</strong>
                  <small>{row.source}</small>
                </div>
                <TradfiContractCell row={row} />
                <div className="market-stack">
                  <b>{row.markPrice ?? row.lastPrice ?? "-"}</b>
                  <small>Last {row.lastPrice ?? "-"} / Index {row.indexPrice ?? "-"}</small>
                  {row.bidPrice || row.askPrice ? <small>Bid {row.bidPrice ?? "-"} / Ask {row.askPrice ?? "-"}</small> : null}
                </div>
                <div className="market-stack">
                  <b>{formatPercent(row.premium)}</b>
                  <small>(Perp - Index) / Index</small>
                </div>
                <div className="market-stack">
                  <button
                    className={`arb-signal arb-signal-${signal.tone}`}
                    type="button"
                    title={signal.thesis}
                    onClick={() => setSelectedSignalId(row.exchange.id)}
                  >
                    {signal.label}
                  </button>
                  <small>{signal.zone}</small>
                </div>
                <div className="market-stack">
                  <b>{formatPercent(row.fundingRate)}</b>
                  <small>{row.nextFundingTime ? `Next ${formatTime(row.nextFundingTime)}` : "Next -"}</small>
                </div>
                <div className="market-stack">
                  <b>{formatCompactUsd(row.volume24hQuote)}</b>
                  <small>Base {row.volume24hBase ?? "-"}</small>
                </div>
                <div className="market-stack">
                  <b>{formatCompactUsd(row.openInterestUsd)}</b>
                  <small>Raw {row.openInterest ?? "-"}</small>
                </div>
                <time>{formatTime(row.updatedAt)}</time>
              </article>
              );
            })
          )}
        </div>
      </section>

      {selectedSignalRow && selectedSignal ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setSelectedSignalId("")}>
          <section
            className="signal-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={`${selectedSignalRow.exchange.name} arbitrage signal`}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="signal-dialog-head">
              <div>
                <span className={`arb-signal arb-signal-${selectedSignal.tone}`}>{selectedSignal.label}</span>
                <h2>{selectedSignalRow.exchange.name} arbitrage signal</h2>
              </div>
              <button type="button" aria-label="Close signal details" onClick={() => setSelectedSignalId("")}>
                <X aria-hidden="true" size={18} />
              </button>
            </div>
            <dl className="signal-detail-grid">
              <div title="Premium is (Perp - Index) / Index. It measures how far perp is from index.">
                <dt>Premium</dt>
                <dd>{formatPercent(selectedSignalRow.premium)} · {selectedSignal.zone}</dd>
              </div>
              <div title="Funding tells which side pays. Positive funding generally means longs pay shorts.">
                <dt>Funding</dt>
                <dd>{formatPercent(selectedSignalRow.fundingRate)} · {selectedSignal.direction}</dd>
              </div>
              <div title="OI is useful only as a trend. This app currently shows the latest OI value, not historical change.">
                <dt>Open Interest</dt>
                <dd>{formatCompactUsd(selectedSignalRow.openInterestUsd)} · Raw {selectedSignalRow.openInterest ?? "-"}</dd>
              </div>
              <div title="Premium Spread is max premium minus min premium across venues.">
                <dt>Premium Spread</dt>
                <dd>
                  {premiumSpread
                    ? `${formatPercent(String(premiumSpread.value))}: short ${premiumSpread.high.exchange.name} / long ${premiumSpread.low.exchange.name}`
                    : "Need at least two premium values"}
                </dd>
              </div>
            </dl>
            <div className="signal-notes">
              <p><strong>What this means</strong>{selectedSignal.thesis}</p>
              <p><strong>OI read</strong>{selectedSignal.oiRead}</p>
              <p><strong>Risk check</strong>{selectedSignal.risk}</p>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

function routeFromPath(): Route {
  return window.location.pathname === "/tradfi" ? "tradfi" : "status";
}

function AppNav({ route, onNavigate }: { route: Route; onNavigate: (route: Route) => void }) {
  const navigate = (nextRoute: Route) => (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    window.history.pushState(null, "", nextRoute === "tradfi" ? "/tradfi" : "/");
    onNavigate(nextRoute);
  };

  return (
    <nav className="app-nav" aria-label="Primary navigation">
      <a className={route === "status" ? "active" : ""} href="/" onClick={navigate("status")}>
        <WalletCards aria-hidden="true" size={16} />
        Status
      </a>
      <a className={route === "tradfi" ? "active" : ""} href="/tradfi" onClick={navigate("tradfi")}>
        <BarChart3 aria-hidden="true" size={16} />
        Stock Perps
      </a>
    </nav>
  );
}

export function App() {
  const [route, setRoute] = useState<Route>(() => routeFromPath());

  useEffect(() => {
    const onPopState = () => setRoute(routeFromPath());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  return (
    <main className="shell">
      <AppNav route={route} onNavigate={setRoute} />
      {route === "tradfi" ? <TradfiPage /> : <StatusPage />}
    </main>
  );
}
