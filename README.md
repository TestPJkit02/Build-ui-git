# AI Repo Tracker

> Dashboard theo dõi các repo AI đang trending trên GitHub và AI news mới
> nhất. Lấy cảm hứng từ [goodailist.com](https://goodailist.com/), build
> bằng [VibecodeKit Hybrid Ultra](https://github.com/VibecodekitPJ8/vibecodekit-hybrid-ultra).

## Pages

| Path | Mô tả |
|---|---|
| `/` | Bảng repo AI ranked theo score (stars + forks + recency). |
| `/news` | Feed AI news mới nhất từ Hacker News (Algolia API + keyword filter). |
| `/stats` | KPI + chart phân bố sao theo category + cumulative stars chart. |

## Stack

- [Next.js 15](https://nextjs.org) (App Router, Server Components)
- TypeScript strict + ESLint (`next/core-web-vitals`)
- Tailwind CSS v3
- recharts (BarChart + AreaChart)
- Vitest + v8 coverage (≥ 80% threshold trên `lib/`)

## Development

```bash
# 1. Install
npm install

# 2. Dev server
npm run dev
# → http://localhost:3000

# 3. Tests + coverage
npm run test
npm run coverage    # gate 80% lines/functions, 75% branches

# 4. Typecheck + lint
npm run typecheck
npm run lint

# 5. Production build
npm run build
npm start
```

### Optional — GitHub auth

Mặc định, `lib/github.ts` gọi GitHub Search API **không cần token** (60
req/giờ/IP). Nếu CI / production bị rate-limit, tạo
[Personal Access Token](https://github.com/settings/tokens) (scope: chỉ
`public_repo`) rồi set:

```bash
echo "GITHUB_TOKEN=ghp_xxx" >> .env.local
```

→ rate limit nâng lên 5000 req/giờ.

## Architecture

```
app/
  layout.tsx        # nav + footer
  page.tsx          # / — Repos (Server Component)
  news/page.tsx     # /news — HN feed
  stats/
    page.tsx        # /stats — KPIs (Server Component)
    StatsCharts.tsx # recharts (Client Component)
lib/
  rank.ts           # composite score (stars/forks/recency)
  category.ts       # keyword classifier (LLM/Agents/RAG/Vision/...)
  format.ts         # compact int + relative time
  github.ts         # GitHub Search API client
  hn.ts             # Hacker News Algolia client
  fallback.ts       # static fallback when upstream is down
  types.ts          # shared types
tests/              # Vitest unit tests, 52 tests, coverage ≥ 80%
.github/workflows/
  ci.yml            # typecheck → lint → test → build
```

## Ranking algorithm

```
score = 0.5 * log2(stars + 1)
      + 0.3 * log2(forks + 1)
      + 0.2 * recency
```

`recency` is `1.0` for repos pushed ≤ 7 days ago, decays linearly to `0`
at 90 days, and is `0` for older repos. See <code>lib/rank.ts</code> +
<code>tests/rank.test.ts</code>.

## Deploy

Vercel-ready (`vercel.json` baked in). Just connect this repo to a Vercel
project and merge the PR — preview deploys ship automatically. Set
`GITHUB_TOKEN` as a Vercel env var if you want the higher rate limit.

## License

MIT (see kit's LICENSE for VibecodeKit-derived files in `.vibecode/`).
