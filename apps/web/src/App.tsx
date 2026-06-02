import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
import { AlertTriangle, BarChart3, CheckCircle2, KeyRound, RefreshCcw, Save, Search, Trash2, WalletCards, XCircle } from "lucide-react";
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
                <StatusBadge status={row.spot} />
                <StatusBadge status={row.contract} />
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
            <span>Funding</span>
            <span>Volume 24h</span>
            <span>Open interest</span>
            <span>Updated</span>
          </div>
          {rows.length === 0 ? (
            <div className="empty">Search a stock symbol to load live perpetual markets.</div>
          ) : (
            rows.map((row: TradfiMarketQuote) => (
              <article className="table-row tradfi-row" key={row.exchange.id}>
                <div className="exchange-cell">
                  <strong>{row.exchange.name}</strong>
                  <small>{row.source}</small>
                </div>
                <div>
                  <strong>{row.contractSymbol || "-"}</strong>
                  <small>{row.status}</small>
                </div>
                <div className="market-stack">
                  <b>{row.markPrice ?? row.lastPrice ?? "-"}</b>
                  <small>Last {row.lastPrice ?? "-"} / Index {row.indexPrice ?? "-"}</small>
                  {row.bidPrice || row.askPrice ? <small>Bid {row.bidPrice ?? "-"} / Ask {row.askPrice ?? "-"}</small> : null}
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
            ))
          )}
        </div>
      </section>
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
