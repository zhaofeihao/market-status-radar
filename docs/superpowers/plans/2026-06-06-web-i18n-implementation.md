# Web I18n Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add English and Chinese internationalization to the React web app with browser-language defaults, manual switching, and persisted user choice.

**Architecture:** Install `i18next`, `react-i18next`, and `i18next-browser-languagedetector` in the web workspace. Initialize i18n before React renders, keep translations in `apps/web/src/locales`, and translate UI copy through `useTranslation()` while leaving market data and backend warnings unchanged.

**Tech Stack:** React 19, Vite, TypeScript, Vitest, Testing Library, i18next, react-i18next.

---

### Task 1: Add Failing I18n Tests

**Files:**
- Modify: `apps/web/src/App.test.tsx`

- [x] Add tests that expect Chinese browser language to show Chinese UI by default, expect the language switcher to change UI text, and expect the selected language to survive a remount.
- [x] Run `npm run test:web -- --run App.test.tsx` and verify the new tests fail because the app has no i18n support yet.

### Task 2: Install And Initialize I18n

**Files:**
- Modify: `apps/web/package.json`
- Modify: `package-lock.json`
- Create: `apps/web/src/i18n.ts`
- Create: `apps/web/src/locales/en.ts`
- Create: `apps/web/src/locales/zh.ts`
- Modify: `apps/web/src/main.tsx`

- [x] Install `i18next`, `react-i18next`, and `i18next-browser-languagedetector` in the web workspace.
- [x] Add English and Chinese resource modules with the UI keys needed by the app.
- [x] Initialize i18next with supported languages `en` and `zh`, localStorage caching, browser detection, fallback English, and React integration.
- [x] Import the initializer from `main.tsx`.

### Task 3: Translate App UI

**Files:**
- Modify: `apps/web/src/App.tsx`

- [x] Replace static user-visible copy with `t()` calls.
- [x] Add a language switcher to primary navigation that calls `i18n.changeLanguage()`.
- [x] Pass the active language into formatting helpers for time and compact USD formatting.
- [x] Keep exchange names, market symbols, source values, URLs, backend warnings, and API behavior unchanged.

### Task 4: Update Existing Assertions

**Files:**
- Modify: `apps/web/src/App.test.tsx`

- [x] Update existing tests so behavior remains covered with i18n-aware labels and text.
- [x] Keep assertions for search requests, trading links, API key persistence, filtering, TradFi navigation, and signal dialog behavior.

### Task 5: Verify And Commit

**Files:**
- Review all modified files.

- [x] Run `npm run test:web -- --run`.
- [x] Run `npm run build`.
- [x] Commit the completed implementation.
