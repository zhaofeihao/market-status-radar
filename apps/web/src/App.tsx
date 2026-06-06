import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
import { AlertTriangle, BarChart3, CheckCircle2, ExternalLink, Info, KeyRound, RefreshCcw, Save, Search, Trash2, WalletCards, X, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
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
import { localeFromLanguage, type SupportedLanguage } from "./i18n.js";

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

const filters: Array<{ value: FilterMode; labelKey: string }> = [
  { value: "all", labelKey: "filter.all" },
  { value: "tradable", labelKey: "filter.tradable" },
  { value: "deposit_disabled", labelKey: "filter.deposit_disabled" },
  { value: "withdraw_disabled", labelKey: "filter.withdraw_disabled" },
  { value: "needs_api_key", labelKey: "filter.needs_api_key" },
  { value: "unknown", labelKey: "filter.unknown" }
];

function supportLabel(status: SupportStatus, t: TFunction) {
  return t(`badge.${status}`);
}

function fundingLabel(status: FundingStatus, t: TFunction) {
  return t(`badge.${status}`);
}

function StatusBadge({ status }: { status: SupportStatus | FundingStatus }) {
  const { t } = useTranslation();
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
  const label = status === "supported" || status === "unsupported" ? supportLabel(status, t) : fundingLabel(status as FundingStatus, t);

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
  const { t } = useTranslation();
  const status = market === "spot" ? row.spot : row.contract;
  const href = status === "supported" ? exchangeTradeUrl(row, market) : undefined;
  const quote = (row.price?.quote || "USDT").split(/[/-]/u)[0]!.toUpperCase();
  const marketLabel = t(market === "spot" ? "common.spot" : "common.contract");

  if (!href) {
    return <StatusBadge status={status} />;
  }

  return (
    <a
      className="market-link"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t("status.openMarket", { exchange: row.exchange.name, coin: row.coin, quote, market: marketLabel })}
      title={t("status.openMarketTitle", { exchange: row.exchange.name, market: marketLabel })}
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
  const { t } = useTranslation();
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
        aria-label={t("tradfi.openContract", { exchange: row.exchange.name, contract: row.contractSymbol })}
        title={t("tradfi.openContractTitle", { exchange: row.exchange.name })}
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

function formatTime(value: string | undefined, language: string) {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat(localeFromLanguage(language), {
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

function formatCompactUsd(value: string | undefined, language: string) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return value ?? "-";
  }
  return new Intl.NumberFormat(localeFromLanguage(language), {
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

function premiumZone(premium: number | undefined, t: TFunction) {
  if (premium === undefined) {
    return t("signal.noPremiumData");
  }
  const absolute = Math.abs(premium);
  if (absolute <= 0.005) {
    return t("signal.normalZone");
  }
  if (absolute < 0.01) {
    return t("signal.neutralWatch");
  }
  if (absolute <= 0.03) {
    return t("signal.watchZone");
  }
  if (absolute <= 0.05) {
    return t("signal.highRiskWatch");
  }
  return t("signal.extremeZone");
}

function fundingDirection(funding: number | undefined, t: TFunction) {
  if (funding === undefined || Math.abs(funding) < 0.000001) {
    return t("signal.noFundingEdge");
  }
  return funding > 0 ? t("signal.shortPerpLongIndex") : t("signal.longPerpShortIndex");
}

function evaluateArbSignal(row: TradfiMarketQuote, t: TFunction): ArbSignal {
  const premium = numericField(row.premium);
  const funding = numericField(row.fundingRate);
  const zone = premiumZone(premium, t);
  const direction = fundingDirection(funding, t);
  const oiRead = row.openInterestUsd || row.openInterest
    ? t("signal.oiAvailable")
    : t("signal.oiUnavailable");

  if (premium === undefined || funding === undefined) {
    return {
      label: t("signal.noData"),
      tone: "muted",
      zone,
      direction,
      thesis: t("signal.noDataThesis"),
      oiRead,
      risk: t("signal.noDataRisk")
    };
  }

  const absolutePremium = Math.abs(premium);
  const highFunding = Math.abs(funding) > 0.0005;
  const opposingBasis = Math.sign(premium) !== 0 && Math.sign(funding) !== 0 && Math.sign(premium) !== Math.sign(funding);

  if (absolutePremium > 0.05) {
    return {
      label: t("signal.risk"),
      tone: "risk",
      zone,
      direction,
      thesis: t("signal.extremeThesis"),
      oiRead,
      risk: t("signal.extremeRisk")
    };
  }

  if (absolutePremium >= 0.03) {
    return {
      label: t("signal.riskWatch"),
      tone: "risk",
      zone,
      direction,
      thesis: t("signal.stretchedThesis"),
      oiRead,
      risk: t("signal.stretchedRisk")
    };
  }

  if (absolutePremium >= 0.01) {
    return {
      label: t("signal.watchOi"),
      tone: "watch",
      zone,
      direction,
      thesis: t("signal.warningBandThesis"),
      oiRead,
      risk: t("signal.warningBandRisk")
    };
  }

  if (absolutePremium > 0.005) {
    return {
      label: opposingBasis ? t("signal.mixed") : t("signal.neutralWatchLabel"),
      tone: opposingBasis ? "mixed" : "watch",
      zone,
      direction,
      thesis: opposingBasis ? t("signal.opposingThesis") : t("signal.modestThesis"),
      oiRead,
      risk: t("signal.modestRisk")
    };
  }

  if (highFunding) {
    return {
      label: t("signal.good"),
      tone: "good",
      zone,
      direction,
      thesis: t("signal.goodThesis"),
      oiRead,
      risk: t("signal.goodRisk")
    };
  }

  return {
    label: opposingBasis ? t("signal.mixed") : t("signal.neutral"),
    tone: opposingBasis ? "mixed" : "muted",
    zone,
    direction,
    thesis: opposingBasis ? t("signal.mixedThesis") : t("signal.neutralThesis"),
    oiRead,
    risk: t("signal.lowFundingRisk")
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

function bestArbSetup(rows: TradfiMarketQuote[], t: TFunction) {
  const evaluated = rows.map((row) => ({ row, signal: evaluateArbSignal(row, t), funding: Math.abs(numericField(row.fundingRate) ?? 0) }));
  return evaluated
    .filter((item) => item.signal.tone === "good")
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
  const { t } = useTranslation();
  const configured = exchangeConfigured(credentials, exchange);
  return (
    <span className={`credential-status ${configured ? "configured" : ""}`}>
      {t(configured ? "status.configured" : "status.missing", { exchange: label })}
    </span>
  );
}

function StatusPage() {
  const { t, i18n } = useTranslation();
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
      setError(err instanceof Error ? err.message : t("error.searchFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [activeCoin, coin, credentials, t]);

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
          <p className="eyebrow">{t("status.eyebrow")}</p>
          <h1>{t("status.title")}</h1>
          <p className="subtitle">{t("status.subtitle")}</p>
        </div>

        <form
          className="searchbox"
          onSubmit={(event) => {
            event.preventDefault();
            void runSearch(coin);
          }}
        >
          <label htmlFor="coin-input">{t("status.coin")}</label>
          <div className="searchline">
            <input id="coin-input" value={coin} onChange={(event) => setCoin(event.target.value)} />
            <button type="submit" disabled={isLoading}>
              <Search aria-hidden="true" size={16} />
              {t("common.search")}
            </button>
            <button className="key-button" type="button" onClick={() => setSettingsOpen((open) => !open)}>
              <KeyRound aria-hidden="true" size={16} />
              {t("status.apiKeys")}
            </button>
          </div>
        </form>
      </section>

      {settingsOpen ? (
        <section className="credential-panel" aria-label={t("status.apiKeySettings")}>
          <div className="credential-panel-head">
            <div>
              <h2>{t("status.apiKeys")}</h2>
              <p>{t("status.apiKeyDescription")}</p>
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
                {t("status.saveApiKeys")}
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
                {t("status.clearApiKeys")}
              </button>
            </div>
          </div>

          <div className="credential-grid">
            <fieldset>
              <legend>Binance</legend>
              <CredentialStatus credentials={credentials} exchange="binance" label="Binance" />
              <label htmlFor="binance-api-key">{t("status.apiKey", { exchange: "Binance" })}</label>
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
              <label htmlFor="binance-api-secret">{t("status.apiSecret", { exchange: "Binance" })}</label>
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
              <label htmlFor="okx-api-key">{t("status.apiKey", { exchange: "OKX" })}</label>
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
              <label htmlFor="okx-api-secret">{t("status.apiSecret", { exchange: "OKX" })}</label>
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
              <label htmlFor="okx-passphrase">{t("status.okxPassphrase")}</label>
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
              <label htmlFor="bybit-api-key">{t("status.apiKey", { exchange: "Bybit" })}</label>
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
              <label htmlFor="bybit-api-secret">{t("status.apiSecret", { exchange: "Bybit" })}</label>
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

          <p className="public-only">{t("status.publicOnly")}</p>
        </section>
      ) : null}

      <section className="summary-grid" aria-label={t("status.summary")}>
        <div><span>{t("status.exchangesCount", { count: counts.exchanges })}</span><p>{t("status.covered")}</p></div>
        <div><span>{t("status.spotCount", { count: counts.spot })}</span><p>{t("status.markets")}</p></div>
        <div><span>{t("status.contractCount", { count: counts.contract })}</span><p>{t("status.listed")}</p></div>
        <div><span>{t("status.needKeyCount", { count: counts.needsKey })}</span><p>{t("status.fundingData")}</p></div>
      </section>

      <section className="toolbar" aria-label={t("status.controls")}>
        <div className="filters">
          {filters.map((item) => (
            <button
              className={filter === item.value ? "active" : ""}
              key={item.value}
              type="button"
              onClick={() => setFilter(item.value)}
            >
              {t(item.labelKey)}
            </button>
          ))}
        </div>
        <button className="refresh" type="button" onClick={() => void runSearch(activeCoin || coin)} disabled={isLoading || (!activeCoin && !coin)}>
          <RefreshCcw aria-hidden="true" size={16} />
          {t("common.refresh")}
        </button>
        {activeCoin ? <p className="countdown">{t("common.autoRefresh", { seconds: refreshIn })}</p> : null}
      </section>

      {error ? <p className="error">{error}</p> : null}

      <section className="table-wrap" aria-label={t("status.results")}>
        <div className="result-table">
          <div className="table-head">
            <span>{t("common.exchange")}</span>
            <span>{t("common.spot")}</span>
            <span>{t("common.contract")}</span>
            <span>{t("status.components")}</span>
            <span>{t("status.chains")}</span>
            <span>{t("common.updated")}</span>
          </div>
          {rows.length === 0 ? (
            <div className="empty">{result ? t("status.noRows") : t("status.empty")}</div>
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
                      <summary>{t("status.componentsCount", { count: row.price.indexComponents.length })}</summary>
                      {row.price.indexComponents.map((component) => (
                        <div className="index-component" key={`${component.exchange}-${component.symbol ?? ""}`}>
                          <span>{component.exchange} {component.symbol ?? ""}</span>
                          {component.price ? <small>{component.price}</small> : null}
                          {component.weight ? <b>{formatWeight(component.weight)}</b> : null}
                        </div>
                      ))}
                    </details>
                  ) : row.price?.indexComponentSource === "unavailable" ? (
                    <small className="muted">{t("status.componentsUnavailable")}</small>
                  ) : null}
                </div>
                <div className="chains">
                  {row.chains.length === 0 ? (
                    <span className="muted">{t("status.noChainData")}</span>
                  ) : (
                    row.chains.map((chain) => (
                      <div className="chain" key={`${row.exchange.id}-${chain.chain}-${chain.rawChain ?? ""}`}>
                        <strong>{chain.chain}</strong>
                        {chain.deposit === chain.withdraw ? (
                          <span>{t("status.depositWithdraw")} <StatusBadge status={chain.deposit} /></span>
                        ) : (
                          <>
                            <span>{t("status.deposit")} <StatusBadge status={chain.deposit} /></span>
                            <span>{t("status.withdraw")} <StatusBadge status={chain.withdraw} /></span>
                          </>
                        )}
                        {chain.withdrawFee ? <small>{t("status.fee", { fee: chain.withdrawFee })}</small> : null}
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
                <time>{formatTime(row.updatedAt, i18n.language)}</time>
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
  const { t, i18n } = useTranslation();
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
      setError(err instanceof Error ? err.message : t("error.tradfiSearchFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [activeSymbol, symbol, t]);

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
  const bestSetup = useMemo(() => bestArbSetup(rows, t), [rows, t]);
  const selectedSignalRow = rows.find((row) => row.exchange.id === selectedSignalId);
  const selectedSignal = selectedSignalRow ? evaluateArbSignal(selectedSignalRow, t) : undefined;

  return (
    <>
      <section className="topbar tradfi-topbar">
        <div>
          <p className="eyebrow">{t("tradfi.eyebrow")}</p>
          <h1>{t("tradfi.title")}</h1>
          <p className="subtitle">{t("tradfi.subtitle")}</p>
        </div>

        <form
          className="searchbox"
          onSubmit={(event) => {
            event.preventDefault();
            void runSearch(symbol);
          }}
        >
          <label htmlFor="tradfi-symbol-input">{t("tradfi.symbol")}</label>
          <div className="searchline">
            <input id="tradfi-symbol-input" value={symbol} onChange={(event) => setSymbol(event.target.value)} />
            <button type="submit" disabled={isLoading}>
              <Search aria-hidden="true" size={16} />
              {t("common.search")}
            </button>
          </div>
        </form>
      </section>

      <section className="summary-grid tradfi-summary" aria-label={t("tradfi.summary")}>
        <div><span>{t("tradfi.venuesCount", { count: counts.venues })}</span><p>{t("tradfi.queried")}</p></div>
        <div><span>{t("tradfi.listedCount", { count: counts.listed })}</span><p>{t("tradfi.contracts")}</p></div>
        <div><span>{t("tradfi.fundingCount", { count: counts.fundingRows })}</span><p>{t("tradfi.ratesLive")}</p></div>
        <div><span>{formatCompactUsd(String(counts.oiUsd), i18n.language)}</span><p>{t("tradfi.reportedOi")}</p></div>
      </section>

      <section className="arb-lens" aria-label={t("tradfi.arbLens")}>
        <div className="arb-lens-head">
          <div>
            <span className="eyebrow">{t("tradfi.arbLens")}</span>
            <h2>{t("tradfi.premiumFunding")}</h2>
          </div>
          <small title={t("tradfi.rulesTooltipTitle")}>
            <Info aria-hidden="true" size={15} />
            {t("tradfi.rulesTooltip")}
          </small>
        </div>
        <div className="arb-metrics">
          <div>
            <span title={t("tradfi.bestSetupTitle")}>{t("tradfi.bestSetup")}</span>
            <b>{bestSetup ? bestSetup.row.exchange.name : "-"}</b>
            <small>{bestSetup ? bestSetup.signal.direction : t("tradfi.searchToScore")}</small>
          </div>
          <div>
            <span title={t("tradfi.premiumSpreadTitle")}>{t("tradfi.premiumSpread")}</span>
            <b>{premiumSpread ? formatPercent(String(premiumSpread.value)) : "-"}</b>
            <small>
              {premiumSpread
                ? t("tradfi.spreadHighLow", { high: premiumSpread.high.exchange.name, low: premiumSpread.low.exchange.name })
                : t("tradfi.needPremiumValues")}
            </small>
          </div>
          <div>
            <span title={t("tradfi.riskZoneTitle")}>{t("tradfi.riskZone")}</span>
            <b>{bestSetup ? bestSetup.signal.zone : "-"}</b>
            <small>{bestSetup ? bestSetup.signal.label : t("tradfi.noSignalYet")}</small>
          </div>
        </div>
      </section>

      <section className="toolbar" aria-label={t("tradfi.controls")}>
        {result?.spread ? (
          <div className="spread-chip">
            <span>{t("tradfi.maxSpread")}</span>
            <b>{result.spread.percent}%</b>
            <small>
              {t("tradfi.spreadPath", {
                lowExchange: result.spread.lowExchange,
                lowPrice: result.spread.lowPrice,
                highExchange: result.spread.highExchange,
                highPrice: result.spread.highPrice
              })}
            </small>
            {result.spread.fundingRateDiff ? <small>{t("tradfi.fundingDiff", { value: formatPercent(result.spread.fundingRateDiff) })}</small> : null}
          </div>
        ) : (
          <p className="countdown">{t("tradfi.comparePrompt")}</p>
        )}
        <button className="refresh" type="button" onClick={() => void runSearch(activeSymbol || symbol)} disabled={isLoading || (!activeSymbol && !symbol)}>
          <RefreshCcw aria-hidden="true" size={16} />
          {t("common.refresh")}
        </button>
        {activeSymbol ? <p className="countdown">{t("common.autoRefresh", { seconds: refreshIn })}</p> : null}
      </section>

      {error ? <p className="error">{error}</p> : null}

      <section className="table-wrap" aria-label={t("tradfi.results")}>
        <div className="result-table tradfi-table">
          <div className="table-head tradfi-head">
            <span>{t("common.exchange")}</span>
            <span>{t("tradfi.contract")}</span>
            <span>{t("common.price")}</span>
            <span>{t("common.premium")}</span>
            <span>{t("common.signal")}</span>
            <span>{t("common.funding")}</span>
            <span>{t("tradfi.volume24h")}</span>
            <span>{t("common.openInterest")}</span>
            <span>{t("common.updated")}</span>
          </div>
          {rows.length === 0 ? (
            <div className="empty">{t("tradfi.empty")}</div>
          ) : (
            rows.map((row: TradfiMarketQuote) => {
              const signal = evaluateArbSignal(row, t);
              return (
              <article className="table-row tradfi-row" key={row.exchange.id}>
                <div className="exchange-cell">
                  <strong>{row.exchange.name}</strong>
                  <small>{row.source}</small>
                </div>
                <TradfiContractCell row={row} />
                <div className="market-stack">
                  <b>{row.markPrice ?? row.lastPrice ?? "-"}</b>
                  <small>{t("common.last")} {row.lastPrice ?? "-"} / {t("common.index")} {row.indexPrice ?? "-"}</small>
                  {row.bidPrice || row.askPrice ? <small>{t("common.bid")} {row.bidPrice ?? "-"} / {t("common.ask")} {row.askPrice ?? "-"}</small> : null}
                </div>
                <div className="market-stack">
                  <b>{formatPercent(row.premium)}</b>
                  <small>{t("tradfi.premiumFormula")}</small>
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
                  <small>{row.nextFundingTime ? `${t("common.next")} ${formatTime(row.nextFundingTime, i18n.language)}` : t("common.nextEmpty")}</small>
                </div>
                <div className="market-stack">
                  <b>{formatCompactUsd(row.volume24hQuote, i18n.language)}</b>
                  <small>{t("common.base")} {row.volume24hBase ?? "-"}</small>
                </div>
                <div className="market-stack">
                  <b>{formatCompactUsd(row.openInterestUsd, i18n.language)}</b>
                  <small>{t("common.raw")} {row.openInterest ?? "-"}</small>
                </div>
                <time>{formatTime(row.updatedAt, i18n.language)}</time>
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
            aria-label={t("tradfi.dialogAria", { exchange: selectedSignalRow.exchange.name })}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="signal-dialog-head">
              <div>
                <span className={`arb-signal arb-signal-${selectedSignal.tone}`}>{selectedSignal.label}</span>
                <h2>{t("tradfi.dialogTitle", { exchange: selectedSignalRow.exchange.name })}</h2>
              </div>
              <button type="button" aria-label={t("common.close")} onClick={() => setSelectedSignalId("")}>
                <X aria-hidden="true" size={18} />
              </button>
            </div>
            <dl className="signal-detail-grid">
              <div title={t("tradfi.premiumTitle")}>
                <dt>{t("common.premium")}</dt>
                <dd>{formatPercent(selectedSignalRow.premium)} · {selectedSignal.zone}</dd>
              </div>
              <div title={t("tradfi.fundingTitle")}>
                <dt>{t("common.funding")}</dt>
                <dd>{formatPercent(selectedSignalRow.fundingRate)} · {selectedSignal.direction}</dd>
              </div>
              <div title={t("tradfi.oiTitle")}>
                <dt>{t("common.openInterest")}</dt>
                <dd>
                  {t("tradfi.openInterestRaw", {
                    value: formatCompactUsd(selectedSignalRow.openInterestUsd, i18n.language),
                    raw: selectedSignalRow.openInterest ?? "-"
                  })}
                </dd>
              </div>
              <div title={t("tradfi.spreadTitle")}>
                <dt>{t("tradfi.premiumSpread")}</dt>
                <dd>
                  {premiumSpread
                    ? t("tradfi.spreadTrade", {
                        value: formatPercent(String(premiumSpread.value)),
                        high: premiumSpread.high.exchange.name,
                        low: premiumSpread.low.exchange.name
                      })
                    : t("tradfi.needTwoPremiumValues")}
                </dd>
              </div>
            </dl>
            <div className="signal-notes">
              <p><strong>{t("tradfi.meaning")}</strong>{selectedSignal.thesis}</p>
              <p><strong>{t("tradfi.oiRead")}</strong>{selectedSignal.oiRead}</p>
              <p><strong>{t("tradfi.riskCheck")}</strong>{selectedSignal.risk}</p>
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
  const { t, i18n } = useTranslation();
  const activeLanguage = i18n.language.startsWith("zh") ? "zh" : "en";
  const navigate = (nextRoute: Route) => (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    window.history.pushState(null, "", nextRoute === "tradfi" ? "/tradfi" : "/");
    onNavigate(nextRoute);
  };
  const setLanguage = (language: SupportedLanguage) => {
    void i18n.changeLanguage(language);
  };

  return (
    <nav className="app-nav" aria-label={t("nav.aria")}>
      <div className="app-nav-links">
        <a className={route === "status" ? "active" : ""} href="/" onClick={navigate("status")}>
          <WalletCards aria-hidden="true" size={16} />
          {t("nav.status")}
        </a>
        <a className={route === "tradfi" ? "active" : ""} href="/tradfi" onClick={navigate("tradfi")}>
          <BarChart3 aria-hidden="true" size={16} />
          {t("nav.tradfi")}
        </a>
      </div>
      <div className="language-switcher" aria-label={t("nav.language")}>
        <button
          className={activeLanguage === "en" ? "active" : ""}
          type="button"
          onClick={() => setLanguage("en")}
          aria-pressed={activeLanguage === "en"}
        >
          {t("nav.english")}
        </button>
        <button
          className={activeLanguage === "zh" ? "active" : ""}
          type="button"
          onClick={() => setLanguage("zh")}
          aria-pressed={activeLanguage === "zh"}
        >
          {t("nav.chinese")}
        </button>
      </div>
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
