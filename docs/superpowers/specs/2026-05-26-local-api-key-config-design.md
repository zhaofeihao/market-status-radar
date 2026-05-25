# Local API Key Configuration Design

## Goal

Add browser-local API key configuration so exchanges that require signed private endpoints can provide richer deposit and withdrawal status without storing secrets on the backend.

## Scope

Included:

- A frontend API key settings panel.
- Browser `localStorage` persistence for exchange credentials.
- Search requests that include configured credentials for the current request only.
- Backend request models that accept credentials without logging or persisting them.
- Private funding-status enhancement for Binance, OKX, and Bybit.
- Clear UI states for configured, missing, invalid, and degraded credentials.

Excluded:

- Server-side credential storage.
- User accounts or encryption-at-rest beyond browser storage.
- Cloud deployment secret management.
- Private endpoint support for every exchange in this iteration.

## Security Boundary

Credentials are stored only in the browser through `localStorage`. During a search, the frontend sends configured credentials to the local backend over the existing localhost API request. The backend may use them to sign exchange API calls for that request, but must not persist them, log them, or return secret values in any response.

This design is intended for local use. If the app is later deployed beyond localhost, credential handling must be redesigned before use.

## Product Behavior

The page adds an `API Keys` entry point near the search controls. The settings panel lists supported exchanges and their required fields:

- Binance: API key, API secret.
- OKX: API key, API secret, passphrase.
- Bybit: API key, API secret.
- Other exchanges: visible as public-only or reserved for future private support.

Users can save, clear, or update credentials. Saved credentials stay in the current browser.

When the user searches a coin:

- Configured credentials are included in the request body.
- The backend passes matching credentials to each exchange adapter.
- Adapters use private endpoints only when the credential shape is complete.
- Missing credentials keep the current `requires_api_key` degraded status.
- Invalid credentials become row-level warnings or errors without failing the whole search.

## API Changes

Keep `GET /api/search?coin=SOL` for public-only usage.

Add `POST /api/search` for credential-aware searches:

```json
{
  "coin": "SOL",
  "credentials": {
    "binance": {
      "apiKey": "...",
      "apiSecret": "..."
    },
    "okx": {
      "apiKey": "...",
      "apiSecret": "...",
      "passphrase": "..."
    },
    "bybit": {
      "apiKey": "...",
      "apiSecret": "..."
    }
  }
}
```

Responses keep the existing `SearchResponse` shape.

## Backend Design

Shared types define `ExchangeCredentials` and `SearchCredentials`. `SearchInput` gains an optional `credentials` object.

Adapters receive credentials through `searchCoin(input)`. Each adapter is responsible for validating whether its credential fields are complete before attempting a private call.

Signed request helpers are added for:

- Binance HMAC SHA256 query signing.
- OKX timestamp + method + path signing with Base64 HMAC SHA256.
- Bybit V5 timestamp + API key + recv window + query signing.

The HTTP client accepts optional headers.

## Frontend Design

Add a focused settings panel within the existing console. It should preserve the current utilitarian visual style:

- An `API Keys` button near the search form.
- A panel with exchange rows and masked password inputs.
- Save and clear controls.
- A small status label per exchange: `Configured locally`, `Missing`, or `Public only`.

The frontend stores credentials under one localStorage key, `exchangeStatusMonitor.credentials.v1`.

The API client switches from `GET /api/search` to `POST /api/search` whenever credentials are available. Public-only searching remains supported.

## Testing

Backend tests cover:

- `POST /api/search` passing credentials into adapters.
- Secret values not appearing in API responses.
- Signing helper output for Binance, OKX, and Bybit using deterministic fixtures.
- Adapters using private funding data when complete credentials are provided.
- Adapters degrading when credentials are missing or incomplete.

Frontend tests cover:

- Opening the API key panel.
- Saving credentials to localStorage.
- Clearing credentials.
- Search request includes saved credentials.
- Configured status appears without revealing secret values.
