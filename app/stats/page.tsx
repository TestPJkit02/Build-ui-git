import { fetchAiRepos } from "@/lib/github";
import { rankRepos } from "@/lib/rank";
import { classifyCategory, ALL_CATEGORIES } from "@/lib/category";
import { FALLBACK_REPOS } from "@/lib/fallback";
import { formatCompactInt } from "@/lib/format";
import StatsCharts from "./StatsCharts";
import type { RankedRepo, Category } from "@/lib/types";

export const revalidate = 600;

async function loadRanked(): Promise<{ rows: RankedRepo[]; degraded: boolean }> {
  try {
    const raw = await fetchAiRepos(50);
    const list = raw.length > 0 ? raw : FALLBACK_REPOS;
    const ranked = rankRepos(list).map((r) => ({
      ...r,
      category: classifyCategory({ topics: r.topics, description: r.description }),
    }));
    return { rows: ranked, degraded: raw.length === 0 };
  } catch {
    const ranked = rankRepos(FALLBACK_REPOS).map((r) => ({
      ...r,
      category: classifyCategory({ topics: r.topics, description: r.description }),
    }));
    return { rows: ranked, degraded: true };
  }
}

function aggregate(rows: RankedRepo[]) {
  const totalStars = rows.reduce((acc, r) => acc + r.stargazers_count, 0);
  const totalForks = rows.reduce((acc, r) => acc + r.forks_count, 0);
  const byCategory: Record<Category, { repos: number; stars: number }> = {
    LLM: { repos: 0, stars: 0 },
    Agents: { repos: 0, stars: 0 },
    RAG: { repos: 0, stars: 0 },
    Vision: { repos: 0, stars: 0 },
    Audio: { repos: 0, stars: 0 },
    Image: { repos: 0, stars: 0 },
    Tooling: { repos: 0, stars: 0 },
    Other: { repos: 0, stars: 0 },
  };
  for (const r of rows) {
    byCategory[r.category].repos += 1;
    byCategory[r.category].stars += r.stargazers_count;
  }
  const categoryRows = ALL_CATEGORIES.map((c) => ({
    category: c,
    repos: byCategory[c].repos,
    stars: byCategory[c].stars,
  }));
  // pretend each repo "earned" its stars on its pushed_at day for the cumulative chart
  const sortedByPush = [...rows].sort(
    (a, b) => Date.parse(a.pushed_at) - Date.parse(b.pushed_at),
  );
  let acc = 0;
  const cumulative = sortedByPush.map((r) => {
    acc += r.stargazers_count;
    return { date: r.pushed_at.slice(0, 10), stars: acc };
  });
  return { totalStars, totalForks, categoryRows, cumulative };
}

export default async function StatsPage() {
  const { rows, degraded } = await loadRanked();
  const agg = aggregate(rows);
  const updated24h = rows.filter((r) => {
    const t = Date.parse(r.pushed_at);
    return Number.isFinite(t) && Date.now() - t < 24 * 3600 * 1000;
  }).length;
  return (
    <section className="max-w-6xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-bold">Stats</h1>
      <p className="mt-2 text-slate-600">
        Aggregated metrics across the {rows.length} tracked AI repos.
      </p>
      {degraded && (
        <div
          role="alert"
          className="mt-4 border border-amber-200 bg-amber-50 text-amber-900 text-sm rounded-md px-4 py-3"
        >
          GitHub API unavailable — stats based on fallback list.
        </div>
      )}
      <ul className="mt-6 grid gap-4 sm:grid-cols-4">
        <KpiCard label="Repos tracked" value={String(rows.length)} />
        <KpiCard label="Total stars" value={formatCompactInt(agg.totalStars)} />
        <KpiCard label="Total forks" value={formatCompactInt(agg.totalForks)} />
        <KpiCard label="Updated < 24h" value={String(updated24h)} />
      </ul>
      <StatsCharts categoryRows={agg.categoryRows} cumulative={agg.cumulative} />
    </section>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <li className="rounded-lg border bg-white p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
    </li>
  );
}
