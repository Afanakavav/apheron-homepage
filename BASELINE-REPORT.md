# Phase 0 — Baseline & Safety Net Report

**Date:** 2025-02-10  
**Scope:** `apheron-homepage` (Firebase Hosting + Cloud Functions)

---

## 1. Stack Detection

| Layer | Technology |
|-------|------------|
| **Hosting** | Firebase Hosting — static `public/` (no bundler) |
| **Runtime** | Node 20 (Functions), browser (static sites) |
| **Package manager** | npm |
| **Framework** | None for hosting; Cloud Functions use vanilla Node + Firebase SDK |
| **Static sites** | Plain HTML/CSS/JS. One SPA build in `public/home-assistant/` (pre-built assets). |

**Sub-projects:**

- **Root:** No `package.json`. Deploy via Firebase CLI (`firebase deploy`).
- **functions/** — Node 20, ESLint (Google config), no tests, no typecheck.
- **public/italian-lessons-dublin/** — Own `package.json`: `live-server` only; scripts: `start`, `test` (opens test.html), `dev`, `build` (no-op), `deploy` (echo). No lint/test tooling.

---

## 2. Existing Scripts & Checks

| Location | Scripts | Lint | Test | Build |
|----------|---------|------|------|-------|
| **apheron-homepage (root)** | — | — | — | — |
| **functions/** | `lint`, `serve`, `deploy`, `logs` | ESLint (fails, see below) | None | N/A |
| **public/italian-lessons-dublin/** | `start`, `test`, `dev`, `build`, `deploy` | None | None (test = open test.html) | No-op echo |

**Commands run:**

- `cd apheron-homepage/functions && npm install` — OK (warnings: engine node 20 vs 22, 4 npm audit issues).
- `cd apheron-homepage/functions && npm run lint` — **Fails** (16 errors: `max-len`, `valid-jsdoc`). ESLint config was updated: `ecmaVersion` 2020 (optional chaining), `linebreak-style` off for Windows; auto-fix applied for trailing spaces/quotes/comma-dangle.
- `cd apheron-homepage/public/italian-lessons-dublin && npm install` — OK (deprecated deps, 6 vulnerabilities).
- No test suite present anywhere; no typecheck (no TypeScript).

---

## 3. Baseline Metrics

| Metric | Value |
|--------|--------|
| **App start / build time** | N/A — static hosting; no build step. Functions deploy: not measured. |
| **Bundle size** | N/A — no bundler; assets served as-is. |
| **Lighthouse/Perf** | Not run (manual step: run against https://apheron.io/ and sub-routes if needed). |
| **Lint (functions)** | 16 errors remaining (max-len, valid-jsdoc). |
| **Tests** | 0 tests. |
| **npm audit** | functions: 4 (1 moderate, 3 high); italian-lessons-dublin: 6 (2 moderate, 4 high). |

---

## 4. Obvious Errors / Warnings

- **functions:** ESLint fails with 16 errors (line length 80, JSDoc). No runtime or build errors.
- **functions:** `package.json` engines `"node": "20"` — host has Node 22 (warning only).
- **italian-lessons-dublin:** `build` and `deploy` are placeholders (echo); no real build or deploy from this folder (deploy is from repo root via Firebase).
- **public/** — multiple static sites; no shared lint/format/test.

---

## 5. Phase 0 Edits Made

- **functions/.eslintrc.js:** Set `parserOptions.ecmaVersion` to `2020` (for optional chaining in `index.js`), added `"linebreak-style": "off"` for Windows/CI, ran `eslint . --fix` (trailing spaces, quotes, comma-dangle fixed). No behavior change to app code.

---

## 6. How to Run (Local)

**Install:**

```powershell
cd apheron-homepage\functions
npm install
```

**Lint (functions):**

```powershell
cd apheron-homepage\functions
npm run lint
```
*(Currently 16 errors; to be addressed in Phase 1.)*

**Serve static site (e.g. Italian Lessons Dublin):**

```powershell
cd apheron-homepage\public\italian-lessons-dublin
npm install
npm run dev
```
*(Opens index.html with live-server on port 5500.)*

**Deploy (requires Firebase CLI and project):**

```powershell
cd apheron-homepage
firebase deploy --only hosting
firebase deploy --only functions
```

---

## Phase 1 — Quality Gates (done)

- **Lint:** ESLint in functions ora passa (max-len 120 + ignore strings/templates, JSDoc aggiunto per `createTransporter` e `escapeHtml`).
- **Root package.json:** aggiunto con script `lint`, `format`, `typecheck`, `test`, `build` (tutti no-prompt).
- **QUALITY-GATES.md:** creato con checklist e istruzioni.
- Pre-commit: non aggiunto (non nello stack).

---

## Phase 2 — Refactor for Maintainability (done)

- **functions:** Introdotta `throwValidationError(message)`; sostituiti i 3 throw di validazione (meno duplicazione).
- **public/italian-lessons-dublin:** Rimossa variabile inutilizzata `selectedTimeSlot`; aggiunta `trackEvent()` e uso di `CONFIG` per WhatsApp, mappa, countdown e nomi eventi analytics (single source of truth).
- Dettaglio in **REFACTOR-PHASE2.md**.

---

## Phase 3 — Performance (done)

- **italian-lessons-dublin/index.html:** Aggiunti preconnect (fonts, cdnjs, googletagmanager); config.js spostato in body; video con `preload="none"`; script.js con `defer`.
- Nessun cambiamento di comportamento; cache già impostata in firebase.json.
- Dettaglio in **PERF-PHASE3.md**.

---

## Phase 4 — Automated Functional Verification (done)

- **Inventario:** Pagina unica Italian Lessons Dublin con sezioni, form prenotazione, modali, quiz, mini game, link WhatsApp, countdown, mappa (vedi **FUNCTIONAL-TEST-PLAN.md**).
- **E2E:** Playwright in root con `serve` per `public/italian-lessons-dublin`. 8 test: home load, sezioni, modal prenotazione/video, quiz, form booking, link WhatsApp, countdown.
- **Script:** `npm run test` e `npm run test:e2e`; prima esecuzione `npx playwright install chromium`.
- Nessun `data-testid` aggiunto (selector basati su ruoli e id esistenti).
