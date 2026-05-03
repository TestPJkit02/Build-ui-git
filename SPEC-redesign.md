# SPEC — UI/UX redesign in "intelligence terminal" style (crucix.live)

## 1. Reference

https://www.crucix.live/ — visual style is "OSINT intelligence terminal":
- Pure-black canvas, dark navy panels with thin teal/cyan borders.
- Monospace typeface with all-caps section headers + small label tags (e.g. `LIVE`, `STRESS`, `13 URGENT`).
- Color signal language: cyan/teal (active/normal), red (alert), amber (warning), green (positive delta), magenta (accent).
- Status dots, sparklines, tabular numerics, dense info density.
- Panel layout: every section is a bordered card with a header strip showing title + optional right-aligned status tag.

We are NOT cloning the data domain (no 3D globe, no markets, no OSINT feeds). We're adopting the **visual language** for the AI Repo Tracker's existing 4 routes.

## 2. Goals

- Re-skin all 4 routes (`/`, `/new`, `/news`, `/stats`) to the intel-terminal aesthetic.
- Add design tokens once, reuse across the app (CSS custom properties + Tailwind theme extension — no per-component hard-coded colors).
- Keep all existing **logic, data, and copy semantics** intact: ranking math, category classifier, filter/sort behavior, URL search params, fallback banner, ISR revalidate, etc.
- Keep all **106 vitest tests** passing without modifications. Visual changes must not touch `lib/` or test code.
- Keep the page accessible: WCAG AA contrast on all text, focus rings on interactive elements, `prefers-reduced-motion` respected for any animation.

## 3. Non-goals (out of scope, will not touch)

- 3D globe / map widgets.
- New data sources (Telegram, OSINT, markets, satellites).
- Restructuring routes or adding new pages.
- Changing ranking formula, category classifier, or fallback logic.
- Adding charts or replacing recharts (we'll re-theme the existing 2 charts only).
- Adding a light/dark toggle. Output is **dark-only** (matches reference). Existing light-mode body classes (`bg-slate-50`) get fully replaced.
- Server-side or auth changes.

## 4. Design tokens (will live in `app/globals.css` + tailwind.config)

CSS custom properties on `:root`:

```
--bg-canvas:        #050a0e;     /* near-black */
--bg-panel:         #0c1218;     /* panel surface */
--bg-panel-elev:    #121922;     /* hovered/active panel */
--border-line:      #1a2530;     /* default panel border */
--border-line-soft: #131c25;     /* sub-divider */
--accent-cyan:      #36e6d8;     /* primary accent — active state, headlines */
--accent-cyan-dim:  #1a8a82;     /* secondary cyan */
--accent-red:       #ff4d6d;     /* alerts, high alert badge */
--accent-amber:     #f4c54f;     /* warnings, moderate signals */
--accent-green:     #4ade80;     /* positive delta, OK */
--accent-magenta:   #ff5fb3;     /* tertiary accent */
--text-primary:     #cfd8dc;     /* body text */
--text-muted:       #6b7d8c;     /* captions, labels */
--text-dim:         #44525e;     /* placeholders */
--font-mono:        "JetBrains Mono", "Geist Mono", ui-monospace, …;
--font-sans:        "Inter", system-ui, …;  /* used only for paragraph copy */
```

Tailwind theme extension under `theme.extend.colors.*` to expose the same tokens (e.g. `bg-canvas`, `text-primary`, `border-line`, `text-cyan`, `text-red`, etc.).

## 5. Component-level changes

### 5.1. `app/layout.tsx` — global shell

- Replace `bg-slate-50 text-slate-900` body with `bg-canvas text-primary font-mono` and load JetBrains Mono via `next/font/google`.
- Header: rename brand to render as `[CRUCIX-style]` logo block — `▌AI REPO MONITOR` + small status pill `TERMINAL ACTIVE` next to it. Right side: nav links rendered as monospace tabs with cyan underline on active route.
- Add a thin top status strip below the brand strip showing: `SOURCES n/n`, `LAST SWEEP <relative>`, `NEXT REFRESH <ttl>`, `RATE-LIMIT <state>`, `TOKEN <state>`. These read from existing data (no new APIs); when fallback is active, show `SOURCE GITHUB · DEGRADED` in red.

### 5.2. `app/page.tsx` (Repos), `app/new/page.tsx` (New)

- Wrap content in panel `<section>` with bordered header strip: `[ TRENDING REPOS ]` left, `LIVE / DEGRADED` tag right.
- Replace plain `<h1>` with terminal-style heading: `▌TRENDING AI REPOSITORIES` followed by mono subtext.
- Below the heading add a row of "metric chips": `TRACKED <N>`, `WINDOW <30d>`, `MIN STARS <N>`, `MEDIAN SCORE <x>` — small panels, mono, computed from current `rows`.
- Degraded banner: redesign as a thin red-tinted bar with `◆ DEGRADED · SHOWING FALLBACK SNAPSHOT` (replaces yellow Tailwind banner).

### 5.3. `app/components/RepoTable.tsx` — main table

This is the highest-leverage component (388 lines). Re-skin only — keep all sort/filter/limit/URL-param logic identical.

- Filter bar (category pills, min stars, search, Track dropdown, Reset): mono, dark surfaces, cyan focus rings, status-dot prefix on each category pill (color = same as category in stats chart).
- Table: dark zebra (`bg-panel` / `bg-panel-elev`), 1px cyan-tinted divider, mono numerics in tabular-nums, sticky header strip, sortable header arrows in cyan when active.
- Row: clickable, hover row glows cyan border-left. Stars/Forks/Trend in mono, color-graded (top-decile cyan, mid amber, low dim).
- Category cell becomes a `[STATUS · LLM]` style chip with a colored dot.

### 5.4. `app/news/page.tsx`

- Re-frame as "OSINT Stream"-style feed: each story = panel row with source badge + relative time + headline + ↗ link. Mono. Dark.
- No layout change beyond re-theme.

### 5.5. `app/stats/page.tsx` + `StatsCharts.tsx`

- KPI cards become "Signal Core" panels with bordered headers, large mono numerics, optional sparkline-style trend dot.
- Recharts: pass new theme palette (cyan strokes, dark grid, no axis lines, mono tick labels).

### 5.6. Footer

- Single-line mono tag: `BUILT WITH VIBECODEKIT HYBRID ULTRA · DATA: GITHUB SEARCH + HACKER NEWS · v0.22.0`.

## 6. Animations / motion

- Subtle: a 1-line "scan line" gradient across active panel border on page load (1s, ease-out, fades).
- Status pills with pulse on `LIVE` (1.2s loop, 0.4–1.0 opacity).
- Honor `prefers-reduced-motion: reduce` → all animations off.

## 7. Responsive

- Desktop (≥1024px): full panel layout.
- Tablet (768–1024px): collapse sidebar metrics into top row chips.
- Mobile (<768px): single column, tables become horizontally scrollable with sticky first 2 columns.

## 8. Accessibility

- Body text contrast vs `--bg-canvas` ≥ 7:1 (AAA where feasible, AA minimum).
- Focus visible: 2px cyan ring with 2px offset on every interactive element.
- All status dots paired with text label (no color-only meaning).
- Reduced motion respected.

## 9. Implementation phases (post-spec)

### Phase 2 — Skeleton (1 commit)
- Add `next/font/google` JetBrains Mono import.
- Add design tokens to `app/globals.css`.
- Extend `tailwind.config.ts` with token-mapped colors.
- No visual change yet beyond font.

### Phase 3 — Implement (5–7 commits, sequential)
1. Re-skin `app/layout.tsx` (header, nav, footer, body bg).
2. Re-skin `app/page.tsx` + `app/new/page.tsx` headings + metric chips + degraded banner.
3. Re-skin `app/components/RepoTable.tsx` (filter bar + table — biggest commit).
4. Re-skin `app/news/page.tsx` feed.
5. Re-skin `app/stats/page.tsx` KPI cards + `app/stats/StatsCharts.tsx` recharts theme.
6. Add motion + `prefers-reduced-motion` guard.
7. Mobile responsive polish.

### Phase 4 — Test
- Existing 106 vitest tests must still pass unchanged.
- Manual visual smoke test on `/`, `/new`, `/news`, `/stats` at 3 breakpoints (375px / 768px / 1280px).

### Phase 5 — Doctor
- `next lint` 0 errors / 0 warnings.
- `tsc --noEmit` clean.
- `npm run build` succeeds.
- `vibecodekit doctor` (if available in repo).

### Phase 6 — Ship
- 1 PR into `devin/1777700116-ai-repo-tracker`.
- Vercel preview URL auto-generated by integration → comment on PR.
- Production manual deploy via `vercel deploy --prod` after merge if auto-deploy still flaky.

## 10. Acceptance criteria

- [ ] All 4 routes render in terminal aesthetic (dark + mono + cyan accents + bordered panels).
- [ ] All existing data displays correctly (ranking, category, trend, news headlines, KPI numbers, charts).
- [ ] All existing interactive behavior works (sort columns, filter category, min stars, search, change limit dropdown 50→1000, URL params persist).
- [ ] Degraded banner shows when fallback used.
- [ ] Header status strip shows live source health.
- [ ] 106/106 tests pass, lint 0 errors, types clean, build succeeds.
- [ ] Mobile view (375px) usable: filter bar wraps, table horizontally scrolls.
- [ ] Vercel preview URL accessible from PR.

## 11. Risk / open questions

- **Q1**: Should we keep a tiny "Light" toggle for accessibility users who prefer light backgrounds, or pure dark? **Default proposal: pure dark** matching the reference; a future PR can add a toggle if requested.
- **Q2**: Recharts theme — pass via inline `style`/`stroke` props per component, or CSS vars? **Proposal: inline props** because recharts SVG doesn't read CSS custom props on stroke attributes consistently. Simpler.
- **Q3**: Do we want any "decorative scan-lines" overlay on the body? Reference has subtle CRT vibe. **Proposal: subtle 1px line via `background-image: linear-gradient(...)` at very low opacity, only on `body` once, no per-panel scan effect** to keep performance and reduced-motion friendly.

If you have preferences on Q1–Q3, say so and I'll adjust before code. Otherwise I proceed with the proposed defaults.
