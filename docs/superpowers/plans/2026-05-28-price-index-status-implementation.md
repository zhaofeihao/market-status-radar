# Price Index Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add public spot, contract, index, and mark price display to each exchange result row.

**Architecture:** Extend the shared result type with a `price` object, then let each exchange adapter fetch price endpoints in parallel with existing market/funding calls. The React table renders the compact price object without changing the search workflow.

**Tech Stack:** TypeScript, Express, React, Vitest, Testing Library.

---

### Task 1: Shared Price Model

**Files:**
- Modify: `packages/shared/src/status.ts`
- Test: `apps/api/test/adapters.test.ts`

- [ ] **Step 1: Write failing adapter expectations**

Add expectations that an adapter result includes `price.spotLastPrice`, `price.indexPrice`, and `price.markPrice` when the fake exchange payload contains those fields.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run apps/api/test/adapters.test.ts`

Expected: TypeScript or assertion failure because `price` does not exist on `ExchangeCoinStatus`.

- [ ] **Step 3: Add shared type**

Add `ExchangePriceStatus` and a required `price: ExchangePriceStatus` field to `ExchangeCoinStatus`.

- [ ] **Step 4: Run test again**

Expected: adapter implementation failures remain because adapters do not yet populate `price`.

### Task 2: Adapter Price Fetching

**Files:**
- Modify: `apps/api/src/adapters/utils.ts`
- Modify: `apps/api/src/adapters/binance.ts`
- Modify: `apps/api/src/adapters/okx.ts`
- Modify: `apps/api/src/adapters/bybit.ts`
- Modify: `apps/api/src/adapters/gate.ts`
- Modify: `apps/api/src/adapters/bitget.ts`
- Modify: `apps/api/src/adapters/kraken.ts`
- Modify: `apps/api/src/adapters/htx.ts`
- Test: `apps/api/test/adapters.test.ts`

- [ ] **Step 1: Add utility helpers**

Add helpers for safe object parsing, optional string extraction, and unavailable price fallback.

- [ ] **Step 2: Implement each adapter**

Fetch public price endpoints in parallel with existing requests. Parse only known fields and return partial prices when some endpoints fail.

- [ ] **Step 3: Run adapter tests**

Run: `npm test -- --run apps/api/test/adapters.test.ts`

Expected: PASS.

### Task 3: Frontend Price Column

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/styles.css`
- Test: `apps/web/src/App.test.tsx`

- [ ] **Step 1: Write failing UI expectation**

Update the mock `SearchResponse` to include price data and assert that `Spot`, `Index`, and `Mark` values appear after search.

- [ ] **Step 2: Run UI test to verify it fails**

Run: `npm test -- --run apps/web/src/App.test.tsx`

Expected: FAIL because the table does not render price fields.

- [ ] **Step 3: Render price cell**

Add a `Price` column and compact price lines in each row.

- [ ] **Step 4: Run UI test**

Run: `npm test -- --run apps/web/src/App.test.tsx`

Expected: PASS.

### Task 4: Documentation and Verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update README**

Mention that search results include public price fields and that price failures do not block status results.

- [ ] **Step 2: Run full verification**

Run:

```bash
npm test -- --run
npm run build
```

Expected: both commands PASS.

- [ ] **Step 3: Commit**

Commit with:

```bash
git add .
git commit -m "feat: add public price index status"
```
