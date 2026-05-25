import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, KeyRound, RefreshCcw, Search, XCircle } from "lucide-react";
import type { ExchangeCoinStatus, FundingStatus, SearchResponse, SupportStatus } from "@status-monitor/shared";
import { searchCoin } from "./api.js";

type FilterMode = "all" | "tradable" | "deposit_disabled" | "withdraw_disabled" | "needs_api_key" | "unknown";

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

function summary(response: SearchResponse | null) {
  const rows = response?.results ?? [];
  return {
    exchanges: rows.length,
    spot: rows.filter((row) => row.spot === "supported").length,
    contract: rows.filter((row) => row.contract === "supported").length,
    needsKey: rows.filter((row) => hasFunding(row, (status) => status === "requires_api_key")).length
  };
}

export function App() {
  const [coin, setCoin] = useState("SOL");
  const [activeCoin, setActiveCoin] = useState("");
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [filter, setFilter] = useState<FilterMode>("all");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [refreshIn, setRefreshIn] = useState(60);

  const runSearch = useCallback(async (nextCoin = activeCoin || coin) => {
    const normalized = nextCoin.trim().toUpperCase();
    if (!normalized) {
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      const data = await searchCoin(normalized);
      setResult(data);
      setActiveCoin(data.coin);
      setRefreshIn(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setIsLoading(false);
    }
  }, [activeCoin, coin]);

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
    <main className="shell">
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
          </div>
        </form>
      </section>

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
            <span>Deposit / withdraw chains</span>
            <span>Updated</span>
          </div>
          {rows.length === 0 ? (
            <div className="empty">{result ? "No rows match the selected filter." : "Search a coin to load live exchange status."}</div>
          ) : (
            rows.map((row) => (
              <article className="table-row" key={row.exchange.id}>
                <div>
                  <strong>{row.exchange.name}</strong>
                  <small>{row.source}</small>
                </div>
                <StatusBadge status={row.spot} />
                <StatusBadge status={row.contract} />
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
                </div>
                <time>{formatTime(row.updatedAt)}</time>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
