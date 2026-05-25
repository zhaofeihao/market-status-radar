# Exchange Deposit and Withdrawal Status Monitor Design

## Goal

Build a local web application for searching a coin symbol and checking where it is supported for spot and contract trading, plus current deposit and withdrawal status where exchange APIs expose it.

The MVP covers these exchanges:

- Binance
- OKX
- Bybit
- Gate.io
- Kraken
- Bitget
- HTX

## Scope

The first version uses public exchange APIs first. API keys are optional enhancements for exchanges or endpoints that do not expose wallet status anonymously.

Included:

- React single-page search UI.
- TypeScript backend API.
- PM2 process configuration for the backend.
- One unified exchange result model.
- Per-exchange adapters that normalize public API responses.
- Manual search by coin symbol.
- Manual refresh and automatic refresh for the current result.
- Clear degraded states for unavailable data.

Excluded from the MVP:

- User accounts.
- Persistent historical status storage.
- Alert notifications.
- Production deployment automation.
- Full private API key integration for every exchange.

## Product Behavior

The user enters a coin symbol such as `SOL` or `USDT`. The frontend calls the backend search endpoint. The backend queries each configured exchange adapter concurrently and returns one normalized result per exchange.

The page shows:

- Exchange name.
- Spot support status.
- Contract support status.
- Deposit status by chain where available.
- Withdrawal status by chain where available.
- Fee and minimum withdrawal fields where publicly available.
- Data state: `live`, `unknown`, `requires_api_key`, or `error`.
- Last updated time.

The current search result refreshes automatically every 60 seconds. The user can also refresh manually.

## Architecture

The app has two runnable pieces:

- `apps/web`: React frontend.
- `apps/api`: TypeScript backend service managed by PM2.

The backend exposes a compact HTTP API:

- `GET /api/health`
- `GET /api/exchanges`
- `GET /api/search?coin=SOL`

The backend defines an `ExchangeAdapter` interface. Each adapter owns exchange-specific URL construction, response parsing, and conversion into the common model.

```ts
interface ExchangeAdapter {
  id: string;
  name: string;
  searchCoin(input: SearchInput): Promise<ExchangeCoinStatus>;
}
```

## Unified Status Model

Each exchange result contains:

- `exchange`: stable id and display name.
- `spot`: `supported`, `unsupported`, `unknown`, or `error`.
- `contract`: `supported`, `unsupported`, `unknown`, or `error`.
- `chains`: array of normalized chain funding statuses.
- `source`: public, api key, mixed, or unavailable.
- `warnings`: human-readable caveats, such as `requires API key for wallet status`.
- `updatedAt`: ISO timestamp.

Each chain result contains:

- `chain`: normalized chain/network name.
- `deposit`: enabled, disabled, unknown, or requires api key.
- `withdraw`: enabled, disabled, unknown, or requires api key.
- `withdrawFee`, `withdrawMin`, and raw chain label when available.

The UI must never infer enabled deposit or withdrawal when the source does not explicitly provide it.

## Data Source Strategy

Trading support comes from public market or instrument endpoints.

Funding status uses public currency or coin metadata endpoints where available. When an exchange requires authentication or only exposes partial information, the adapter returns a degraded but explicit status.

Expected first-pass behavior:

- Bybit, Gate.io, Bitget, and HTX are likely to provide useful public chain funding data.
- Binance wallet-wide coin information is expected to require a signed endpoint, so funding status may show `requires_api_key`.
- Kraken public asset data can help with asset/trading identification, but detailed deposit and withdrawal method status may show `unknown` or `requires_api_key`.
- OKX funding currency availability needs implementation-time verification; adapter must degrade explicitly if authentication is required.

## Error Handling

One exchange failure must not fail the whole search. The backend returns partial results with per-exchange errors.

Backend errors include:

- request timeout
- rate limit
- invalid response shape
- exchange unavailable
- authentication required for a requested private endpoint

The frontend displays these as row-level states and keeps successful exchange rows visible.

## Configuration

Configuration is environment based:

- API port.
- Frontend API base URL.
- Request timeout.
- Optional API keys per exchange for future private endpoint support.

Secrets live in `.env` files and are not committed.

## Testing

Backend tests cover:

- normalization helpers
- each adapter parser using representative fixtures
- search aggregation with partial failures
- API endpoint response shape

Frontend tests cover:

- search form behavior
- loading, success, empty, degraded, and error states
- auto-refresh timer behavior

Manual verification covers:

- searching common symbols such as `USDT`, `BTC`, and `SOL`
- network or exchange adapter failure
- PM2 start and restart behavior

## Implementation Order

1. Scaffold workspace, TypeScript API, React frontend, and PM2 config.
2. Define shared status model and adapter contract.
3. Add backend tests for aggregation and parser behavior.
4. Implement public market and funding adapters exchange by exchange.
5. Build the React search UI and result table.
6. Wire frontend to backend and add refresh behavior.
7. Verify locally and document run commands.
