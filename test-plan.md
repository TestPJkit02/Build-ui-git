# E2E Test Plan — AI Repo Tracker (post-merge of PR #1, #2, #3, #4)

## Context

- App: Next.js 15 dashboard at `http://localhost:3000`
- Three routes: `/` (Repos), `/news` (HN feed), `/stats` (KPI + charts)
- Recently merged: PR #4 changes `lib/category.ts:matchKeyword` to use leading word-boundary `\bkw` for ≤3-char ambiguous keywords (`gpt`, `rag`, `llm`, `ocr`, `tts`, `asr`, `sdk`) and substring otherwise. The whole reason this PR exists is to make AutoGPT-style repos classify as **Agents** instead of LLM, and to keep `llama2`/`yolov8`/`codellama`/`gpt4`/`agents` working through substring match.
- Code references that informed this plan:
  - `app/page.tsx:36-49` (degraded banner + table render)
  - `lib/category.ts:64-71` (matchKeyword)
  - `lib/fallback.ts:108-113` (AutoGPT entry: `topics: ["agent","autonomous","autogpt","agentic"]`)
  - `app/news/page.tsx:42-67` (HN list rendering)
  - `app/stats/page.tsx:84-90` (KPI cards + StatsCharts)

## What is being tested vs. unrelated regression

The single most important user-visible behavior to prove is: **`AutoGPT` (a real repo with `autogpt` topic) is classified as Agents, not LLM, on the `/` page**. If the merged fix were broken (or reverted), the same repo would show under LLM. Everything else (table layout, news feed, stats charts) is regression coverage and labeled as such.

## Setup state at test time

- Dev server running on `http://localhost:3000` against current default branch `devin/1777700116-ai-repo-tracker` HEAD `3bc5abe` (= post PR #4 merge).
- GitHub Search API rate-limit currently exhausted (0/60 core, 10/10 search but app needs ≥1 search call) → app falls back to `FALLBACK_REPOS` on `/` and `/stats`. This is **intentional and useful for this test** because the AutoGPT entry in `FALLBACK_REPOS` has the exact `autogpt` topic that triggered the original Devin Review bug. The fallback banner is expected.
- HN Algolia API is reachable → `/news` will load real HN data, no fallback banner.

---

## Test cases

### T1 (PRIMARY) — `/` shows AutoGPT under "Agents", not "LLM"

**Steps**
1. Navigate to `http://localhost:3000/` in the browser.
2. Locate the row whose Repo column contains `Significant-Gravitas/AutoGPT`.
3. Read the value in that row's `Category` column (rendered as a small grey pill via `<span class="...">…</span>`).

**Pass criteria** — ALL must hold
- AutoGPT row is present in the table.
- AutoGPT category pill text is exactly **`Agents`**.
- AutoGPT does NOT appear with `LLM` or `Other` in its category column.

**Why this is adversarial**
A broken implementation (substring match on `gpt`) would render AutoGPT as `LLM`. A different broken implementation (`\bllama\b`/`\byolo\b` over-strict) would not affect AutoGPT directly but would surface elsewhere — covered by T2.

---

### T2 (PRIMARY edge guard) — `/` keeps `ollama/ollama` (`llama` topic) classified as `LLM`, not `Other`

**Steps**
1. On `http://localhost:3000/`, locate the row `ollama/ollama`.
2. Read its category pill text.

**Pass criteria**
- `ollama/ollama` category is exactly **`LLM`**.

**Why adversarial**
PR #2's earlier (broken) fix used `\bllama\b` for ≤5-char keywords, which fails to match `llama2`/`codellama` and broke `ollama/ollama` (topics include `llama`). The current code MUST classify `ollama/ollama` as LLM through the substring match. If someone reintroduces `\bkw\b` for length ≤5, this test fails.

---

### T3 (PRIMARY edge guard) — `/` keeps `ultralytics/yolov5` classified as `Vision`

**Steps**
1. On `http://localhost:3000/`, locate the row `ultralytics/yolov5`.
2. Read its category pill text.

**Pass criteria**
- Category pill text is exactly **`Vision`**.

**Why adversarial**
Same logic as T2 — earlier broken fix made `\byolo\b` fail to match `yolov5` topic; current substring fix must catch it.

---

### T4 (Regression) — `/news` renders 30 real Hacker News stories with item IDs, no fallback banner

**Steps**
1. Navigate to `http://localhost:3000/news`.
2. Count the number of `<li>` story rows.
3. Look for the amber "Hacker News API unavailable" banner.
4. Confirm at least 5 of the visible stories link to `news.ycombinator.com/item?id=<numeric>` URLs (i.e. real HN ids, not the fallback `id: "fallback-1"`).

**Pass criteria**
- ≥10 story rows render (target 30).
- The "Hacker News API unavailable" banner is **absent**.
- At least 5 stories show numeric HN item IDs (`item?id=4xxxxxxx`-shape).

**Why adversarial**
A broken `lib/hn.ts` (e.g. wrong endpoint, broken AI keyword filter) would either show 0 stories or only fallback (3 fallback rows + banner visible). Numeric ID check distinguishes real fetch from fallback list.

---

### T5 (Regression) — `/stats` shows 4 KPI cards with sensible numbers + charts render

**Steps**
1. Navigate to `http://localhost:3000/stats`.
2. Read the 4 KPI card values for: `Repos tracked`, `Total stars`, `Total forks`, `Updated < 24h`.
3. Scroll down and confirm 2 chart panels are visible (BarChart of stars by category, AreaChart of cumulative stars).

**Pass criteria**
- Repos tracked = `8` (fallback list size).
- Total stars displayed in compact form ending with `k` (expected `715k` ± rounding).
- Total forks displayed in compact form ending with `k` (expected `131.8k` ± rounding).
- Updated < 24h is a non-negative integer (expected `0` for fallback data, all entries pushed_at ≥ 4 days ago).
- Both chart canvases render without React error boundary fallback.

**Why adversarial**
A broken `aggregate()` in `app/stats/page.tsx` or a broken category enum would either crash the page (500) or render `NaN`/blank for KPIs. A broken `StatsCharts` import chain would crash the client component.

---

## Out of scope

- Login flows: app has no auth.
- Real GitHub Search live data path on `/` and `/stats`: rate-limit currently exhausted, would require a `GITHUB_TOKEN`. Fallback path already exercises the same `classifyCategory` + `rankRepos` code, so the merged fix is fully observable.
- Vercel preview deployment: repo is not connected to Vercel in this session.
- Pixel-level styling.

## Recording

Single continuous browser recording covering T1–T5 with annotations between each test. Will use full-screen Chrome with sidebar / devtools closed.
