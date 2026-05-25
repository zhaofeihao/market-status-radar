# Local API Key Configuration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add browser-local API key settings and use configured credentials to enhance private funding status for Binance, OKX, and Bybit.

**Architecture:** Extend shared request types with credentials, add a credential-aware `POST /api/search`, and pass request credentials into existing adapters. The React app stores credentials in `localStorage`, exposes a settings panel, and sends credentials only with search requests.

**Tech Stack:** TypeScript, Express, Node crypto, Vitest, React, localStorage, Testing Library.

---

## Tasks

### Task 1: Shared Credential Model and Search API

**Files:**
- Modify: `packages/shared/src/status.ts`
- Modify: `apps/api/src/server.ts`
- Modify: `apps/api/test/server.test.ts`
- Modify: `apps/api/src/services/searchService.ts`
- Modify: `apps/api/test/searchService.test.ts`

- [ ] Write failing tests proving credentials reach adapters through `POST /api/search`.
- [ ] Add shared `ExchangeCredentials` and `SearchCredentials` types.
- [ ] Change aggregation to pass `{ coin, credentials }`.
- [ ] Add `POST /api/search` while preserving public `GET /api/search`.
- [ ] Run `npm run test:api -- server searchService`.

### Task 2: Signed Request Helpers and Private Adapter Paths

**Files:**
- Create: `apps/api/src/signing.ts`
- Modify: `apps/api/src/httpClient.ts`
- Modify: `apps/api/src/adapters/binance.ts`
- Modify: `apps/api/src/adapters/okx.ts`
- Modify: `apps/api/src/adapters/bybit.ts`
- Modify: `apps/api/test/adapters.test.ts`

- [ ] Write failing tests for deterministic Binance, OKX, and Bybit signing.
- [ ] Write failing tests for private funding fixture parsing with complete credentials.
- [ ] Add header-aware `getJson`.
- [ ] Implement HMAC signing helpers.
- [ ] Implement Binance signed wallet funding lookup.
- [ ] Implement OKX signed funding lookup.
- [ ] Implement Bybit signed coin info lookup.
- [ ] Run `npm run test:api -- adapters`.

### Task 3: Frontend Credential Storage and Settings UI

**Files:**
- Create: `apps/web/src/credentials.ts`
- Modify: `apps/web/src/api.ts`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/App.test.tsx`
- Modify: `apps/web/src/styles.css`

- [ ] Write failing tests for opening settings, saving credentials, clearing credentials, and sending credentials in search.
- [ ] Implement localStorage helpers under `exchangeStatusMonitor.credentials.v1`.
- [ ] Add settings panel with masked inputs and per-exchange status.
- [ ] Send credentials in `POST /api/search` when configured.
- [ ] Run `npm run test:web -- App`.

### Task 4: Verification and Docs

**Files:**
- Modify: `README.md`

- [ ] Document local browser credential storage and security caveats.
- [ ] Run `npm test -- --run`.
- [ ] Run `npm run build`.
- [ ] Start API and web, verify public search still works.
- [ ] Commit the completed feature.
