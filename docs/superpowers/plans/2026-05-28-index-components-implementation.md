# Index Components Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add public index component rows to exchange price results and render them in the search table.

**Architecture:** Extend `ExchangePriceStatus` with component metadata, then parse each supported exchange's public component endpoint inside existing adapter price helpers. The React price cell renders a compact expandable list.

**Tech Stack:** TypeScript, Express, React, Vitest, Testing Library.

---

### Task 1: Shared Model and Adapter Tests

**Files:**
- Modify: `packages/shared/src/status.ts`
- Modify: `apps/api/test/adapters.test.ts`

- [ ] **Step 1: Write failing tests**

Expect Binance and OKX adapter results to include `price.indexComponentSource: "public"` and mapped component rows.

- [ ] **Step 2: Run tests**

Run: `npm run test --workspace @status-monitor/api -- --run test/adapters.test.ts`

Expected: FAIL because adapters do not yet populate component data.

- [ ] **Step 3: Add shared fields**

Add `ExchangeIndexComponent`, `indexComponentSource`, and `indexComponents`.

### Task 2: Adapter Implementation

**Files:**
- Modify: `apps/api/src/adapters/binance.ts`
- Modify: `apps/api/src/adapters/okx.ts`
- Modify: `apps/api/src/adapters/gate.ts`
- Modify: `apps/api/src/adapters/bitget.ts`
- Modify: `apps/api/src/adapters/bybit.ts`
- Modify: `apps/api/src/adapters/kraken.ts`
- Modify: `apps/api/src/adapters/htx.ts`

- [ ] **Step 1: Parse supported component APIs**

Map Binance, OKX, Gate.io, and Bitget responses into the shared component list.

- [ ] **Step 2: Mark unsupported direct APIs unavailable**

Return empty component data for Bybit, Kraken, and HTX.

- [ ] **Step 3: Run adapter tests**

Run: `npm run test --workspace @status-monitor/api -- --run test/adapters.test.ts`

Expected: PASS.

### Task 3: Frontend Rendering

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/styles.css`
- Modify: `apps/web/src/App.test.tsx`

- [ ] **Step 1: Write failing UI expectation**

Expect `Components 2`, a component exchange, and a weight to render after search.

- [ ] **Step 2: Render component details**

Add a compact `<details>` list inside the price cell.

- [ ] **Step 3: Run UI tests**

Run: `npm run test --workspace @status-monitor/web -- --run src/App.test.tsx`

Expected: PASS.

### Task 4: Verification and Commit

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update docs**

Mention supported component APIs and unavailable exchanges.

- [ ] **Step 2: Run verification**

Run:

```bash
npm test -- --run
npm run build
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 3: Commit**

Commit with:

```bash
git add .
git commit -m "feat: add contract index components"
```
