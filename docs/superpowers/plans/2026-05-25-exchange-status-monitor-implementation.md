# Exchange Status Monitor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local React and TypeScript web app that searches a coin and shows spot, contract, deposit, and withdrawal status across Binance, OKX, Bybit, Gate.io, Kraken, Bitget, and HTX.

**Architecture:** Use a small npm workspace with `apps/api`, `apps/web`, and `packages/shared`. The backend exposes Express endpoints and normalizes exchange adapter results. The frontend consumes the search endpoint and renders a compact monitoring console with auto-refresh.

**Tech Stack:** TypeScript, Node.js fetch, Express, Vitest, React, Vite, Testing Library, PM2.

---

## File Structure

- `package.json`: root workspace scripts and shared dev dependencies.
- `tsconfig.base.json`: shared TypeScript compiler settings.
- `ecosystem.config.cjs`: PM2 app definition for the backend.
- `.env.example`: documented runtime configuration.
- `packages/shared/src/status.ts`: normalized status types and helpers.
- `packages/shared/src/index.ts`: shared package exports.
- `apps/api/src/config.ts`: environment parsing.
- `apps/api/src/httpClient.ts`: timeout-aware JSON fetch helper.
- `apps/api/src/adapters/types.ts`: adapter interface.
- `apps/api/src/adapters/*.ts`: one adapter per exchange.
- `apps/api/src/adapters/index.ts`: adapter registry.
- `apps/api/src/services/searchService.ts`: concurrent aggregation and partial failure handling.
- `apps/api/src/server.ts`: Express app and routes.
- `apps/api/src/index.ts`: server bootstrap.
- `apps/api/test/*.test.ts`: backend unit and endpoint tests.
- `apps/web/src/api.ts`: frontend API client.
- `apps/web/src/App.tsx`: monitoring console UI.
- `apps/web/src/App.test.tsx`: frontend behavior tests.
- `apps/web/src/styles.css`: UI styling.
- `README.md`: run, test, and PM2 instructions.

## Tasks

### Task 1: Workspace scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `.env.example`
- Create: `ecosystem.config.cjs`
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/src/status.ts`
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/src/index.ts`
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/index.html`
- Create: `apps/web/src/main.tsx`

- [ ] Install dependencies with `npm install`.
- [ ] Add root scripts: `dev`, `build`, `test`, `test:api`, `test:web`, `start:api`, and `pm2:start`.
- [ ] Define shared status unions in `packages/shared/src/status.ts`: `SupportStatus`, `FundingStatus`, `DataSource`, `ChainFundingStatus`, `ExchangeCoinStatus`, `SearchResponse`.
- [ ] Run `npm test -- --run` and confirm the scaffold has no tests or passes cleanly.
- [ ] Commit with `git commit -m "chore: scaffold exchange monitor workspace"`.

### Task 2: Backend aggregation TDD

**Files:**
- Create: `apps/api/src/adapters/types.ts`
- Create: `apps/api/src/services/searchService.ts`
- Create: `apps/api/test/searchService.test.ts`

- [ ] Write a failing test that two successful adapters return two exchange results for `SOL`.
- [ ] Write a failing test that one adapter error becomes a row-level `error` result without failing the whole search.
- [ ] Implement `searchCoinAcrossExchanges(coin, adapters)` with `Promise.all`.
- [ ] Run `npm run test:api -- searchService`.
- [ ] Commit with `git commit -m "feat: add exchange search aggregation"`.

### Task 3: Backend HTTP API TDD

**Files:**
- Create: `apps/api/src/server.ts`
- Create: `apps/api/src/config.ts`
- Create: `apps/api/test/server.test.ts`

- [ ] Write failing tests for `GET /api/health`, `GET /api/exchanges`, missing `coin`, and successful `GET /api/search?coin=SOL`.
- [ ] Implement `createServer({ adapters })`.
- [ ] Implement config defaults for `PORT` and `REQUEST_TIMEOUT_MS`.
- [ ] Run `npm run test:api -- server`.
- [ ] Commit with `git commit -m "feat: expose status monitor API"`.

### Task 4: Exchange adapters TDD

**Files:**
- Create: `apps/api/src/httpClient.ts`
- Create: `apps/api/src/adapters/binance.ts`
- Create: `apps/api/src/adapters/okx.ts`
- Create: `apps/api/src/adapters/bybit.ts`
- Create: `apps/api/src/adapters/gate.ts`
- Create: `apps/api/src/adapters/kraken.ts`
- Create: `apps/api/src/adapters/bitget.ts`
- Create: `apps/api/src/adapters/htx.ts`
- Create: `apps/api/src/adapters/index.ts`
- Create: `apps/api/test/adapters.test.ts`

- [ ] Write parser tests for supported, unsupported, degraded, and chain funding results using local fixtures.
- [ ] Implement HTTP helper with timeout and JSON validation.
- [ ] Implement market support checks from public endpoints.
- [ ] Implement public funding status parsing where available.
- [ ] Return explicit `requires_api_key` or `unknown` when public data is unavailable.
- [ ] Run `npm run test:api -- adapters`.
- [ ] Commit with `git commit -m "feat: add public exchange adapters"`.

### Task 5: React UI TDD

**Files:**
- Create: `apps/web/src/api.ts`
- Create: `apps/web/src/App.tsx`
- Create: `apps/web/src/App.test.tsx`
- Create: `apps/web/src/styles.css`
- Modify: `apps/web/src/main.tsx`

- [ ] Write failing tests for initial screen, successful search table, degraded state display, and manual refresh.
- [ ] Implement API client with `VITE_API_BASE_URL`.
- [ ] Implement the search console, summary cards, filters, result table, and 60-second auto-refresh.
- [ ] Run `npm run test:web -- App`.
- [ ] Commit with `git commit -m "feat: build coin status console"`.

### Task 6: Integration and docs

**Files:**
- Create: `README.md`
- Modify: `apps/api/src/index.ts`
- Modify: `ecosystem.config.cjs`

- [ ] Build all packages with `npm run build`.
- [ ] Start backend and frontend locally.
- [ ] Verify `GET /api/health` returns `{"ok":true}`.
- [ ] Open the React app in the browser and verify a search for `SOL`.
- [ ] Add README run commands, environment variables, PM2 commands, and known data-source caveats.
- [ ] Run `npm test -- --run` and `npm run build`.
- [ ] Commit with `git commit -m "docs: add local run instructions"`.
