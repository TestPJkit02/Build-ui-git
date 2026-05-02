# SPEC — AI Repo Tracker

> **Mục tiêu:** Trang dashboard theo dõi các repo AI mới cập nhật trên GitHub,
> xếp hạng theo tiêu chí (sao, fork, tăng trưởng), kết hợp feed AI news mới nhất.
> Lấy cảm hứng từ <https://goodailist.com/>.

## 1. User story

Là một AI engineer / product researcher, tôi cần một dashboard duy nhất để:

- xem **repo AI mới release / mới cập nhật** đang trending,
- **xếp hạng** repo theo nhiều tiêu chí (stars, growth, forks, recency),
- lọc theo **category** (LLM, Agents, RAG, Computer Vision, Audio, Tooling, …),
- đọc lướt **AI news mới nhất** (Hacker News + community) ngay trong cùng UI,
- xem **stats tổng hợp** (số repo / sao trung bình / phân bố category) qua chart.

→ Không phải mở 5 tab GitHub Trending + HN + Twitter mỗi sáng nữa.

## 2. Functional requirements

### F1. Trang `/` — Repos
- Bảng repo có cột: `#`, `Repo` (owner/name + link), `Stars`, `Forks`,
  `Score` (composite ranking), `Category`, `Description`, `Updated`.
- Sort: stars / forks / score / updated.
- Filter: category (multi-select), tối thiểu sao (`stars:>=N`).
- Mặc định: top 30 repo có topic AI (`topic:ai OR topic:llm OR topic:agents OR …`)
  pushed trong 30 ngày gần nhất, sort theo score giảm dần.
- Data source: GitHub Search API `/search/repositories` (public, không cần auth
  cho rate-limit nhỏ; có support `GITHUB_TOKEN` env nếu cần).

### F2. Trang `/news` — AI news feed
- Hiển thị 30 AI story mới nhất (title, source, points, comments, time, link).
- Source: Hacker News Algolia API (`hn.algolia.com/api/v1/search_by_date`)
  với query `AI OR LLM OR GPT OR "machine learning"`.
- Sort: thời gian giảm dần.
- Có badge `points` + link comments.

### F3. Trang `/stats` — Stats overview
- KPI cards: tổng repo theo dõi, tổng sao, số category, repo cập nhật trong 24h.
- Chart 1: phân bố sao theo category (bar).
- Chart 2: cumulative stars theo thời gian update (area, mock data từ list hiện tại).

### F4. Ranking algorithm
- Input: `{ stars, forks, pushed_at, created_at }`.
- Score = `log2(stars + 1) * 0.5 + log2(forks + 1) * 0.3 + recency_factor * 0.2`.
- `recency_factor`: `1.0` nếu pushed trong 7 ngày, giảm tuyến tính về `0.0`
  ở 90 ngày, `0.0` nếu cũ hơn.
- Pure function, deterministic, easy to unit-test.

### F5. Category classification
- Cho mỗi repo, từ `topics` + `description`, suy ra **một category** trong
  enum: `LLM`, `Agents`, `RAG`, `Vision`, `Audio`, `Image`, `Tooling`, `Other`.
- Heuristic dựa trên keyword match (case-insensitive) — pure function, testable.

### F6. Layout chung
- Top nav: `Repos` / `News` / `Stats`.
- Footer: link GitHub source + credit goodailist.com.
- Responsive (mobile breakpoint: stack table thành cards).
- Tailwind dark-mode-friendly (bonus).

## 3. Non-functional requirements

| Aspect | Target |
|---|---|
| Stack | Next.js 15 (App Router) + TypeScript + Tailwind + recharts |
| Lint | `next lint` (eslint) clean |
| Type | `tsc --noEmit` clean |
| Test | Vitest unit tests, **coverage ≥ 80%** trên `lib/` |
| CI | GitHub Actions: install → typecheck → lint → test → build |
| Performance | First paint < 2s với data đã cache (use `revalidate` 600s) |
| Security | Không commit secret; `GITHUB_TOKEN` optional qua `.env.local` |
| Deploy | Vercel-ready (`vercel.json` đã có) |

## 4. Out of scope (giai đoạn này)

- Authentication / user accounts.
- Database persistence — mọi data fetch on-demand từ public API.
- Notification / alert.
- Mobile native app.
- Dark-mode toggle UI (chỉ cần class-based để dev sau).

## 5. Acceptance criteria

1. `npm install && npm run build` chạy thành công, không error.
2. `npm run lint` không report error.
3. `npm run test` pass tất cả test, coverage trên `lib/` ≥ 80%.
4. `npm run dev` rồi mở `http://localhost:3000`:
   - Trang `/` show ≥ 1 repo (real data từ GitHub) hoặc fallback nếu rate-limit.
   - Trang `/news` show ≥ 1 story từ HN.
   - Trang `/stats` render chart không crash.
5. CI workflow GitHub Actions xanh trên PR.
6. README có hướng dẫn chạy local + deploy Vercel.

## 6. Permission engine activity (kit)

Mọi shell command được generate trong quá trình build sẽ pass qua
`vibecodekit.permission_engine.decide_typed`. Audit log lưu tại
`~/.vibecode/security/attempts.jsonl`.
