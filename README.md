# Exchange Deposit / Withdraw Status Monitor

Local React + TypeScript app for checking whether a coin is supported for spot and contract trading, and whether deposit / withdrawal status is available across selected exchanges.

Covered exchanges:

- Binance
- OKX
- Bybit
- Gate.io
- Kraken
- Bitget
- HTX

## Requirements

- Node.js 20+
- npm
- PM2 for process management, installed through this repo dependency

## Setup

```bash
npm install
cp .env.example .env
```

## Development

Run API and web separately:

```bash
npm run build --workspace @status-monitor/shared
npm run dev --workspace @status-monitor/api
npm run dev --workspace @status-monitor/web
```

Default URLs:

- API: `http://localhost:4000`
- Web: `http://localhost:5173`

Search endpoint:

```bash
curl 'http://localhost:4000/api/search?coin=SOL'
```

## PM2

Build first, then start the backend with PM2:

```bash
npm run build
npm run pm2:start
```

Useful PM2 commands:

```bash
npx pm2 status
npx pm2 logs exchange-status-api
npx pm2 restart exchange-status-api
npx pm2 stop exchange-status-api
```

## Tests

```bash
npm test -- --run
npm run build
```

## Data Source Notes

The MVP uses public endpoints first. If an exchange does not expose funding status publicly, the row stays usable for trading support and marks funding data as `requires_api_key` or `unknown`.

Current expected caveats:

- Binance deposit and withdrawal status requires signed wallet API access.
- OKX funding currency status may require API credentials depending on endpoint access.
- Bybit coin funding status may require API credentials depending on endpoint access.
- Kraken public asset status is available, but detailed deposit and withdrawal methods require private API access.

The UI intentionally does not infer deposit or withdrawal support unless an exchange response explicitly says so.

## Browser-Local API Keys

The web app includes an `API Keys` panel for Binance, OKX, and Bybit. Keys are stored in browser `localStorage` under `exchangeStatusMonitor.credentials.v1`.

When keys are configured, searches are sent with `POST /api/search` and credentials are included only in that request body. The backend uses them to sign private exchange requests for the current search. It does not persist credentials, write them to files, or return secret values in responses.

This is intended for local `localhost` usage. Do not expose this app on a public network without redesigning credential handling.
