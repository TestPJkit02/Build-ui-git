import { clampLimit, fetchAiRepos } from "@/lib/github";
import { rankRepos } from "@/lib/rank";
import { classifyCategory, ALL_CATEGORIES } from "@/lib/category";
import { FALLBACK_REPOS } from "@/lib/fallback";
import { formatCompactInt } from "@/lib/format";
import StatsCharts from "./StatsCharts";
import { PageHeader, DegradedBanner } from "../components/PagePrimitives";
import type { RankedRepo, Category } from "@/lib/types";

export const revalidate = 600;

const DEFAULT_LIMIT = 50;

async function loadRanked(limit: number): Promise<{ rows: RankedRepo[]; degraded: boolean }> {
  try {
    const raw = await fetchAiRepos(limit);
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

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function StatsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const limitParam = Array.isArray(params.limit) ? params.limit[0] : params.limit;
  const limit = clampLimit(Number(limitParam), DEFAULT_LIMIT);
  const { rows, degraded } = await loadRanked(limit);
  const agg = aggregate(rows);
  const updated24h = rows.filter((r) => {
    const t = Date.parse(r.pushed_at);
    return Number.isFinite(t) && Date.now() - t < 24 * 3600 * 1000;
  }).length;
  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Module 04 · Signal Core"
        title="Aggregate Stats"
        subtitle={`Aggregated metrics across the ${rows.length} tracked AI repos. Updated every 10 minutes.`}
        statusLabel={degraded ? "DEGRADED" : "LIVE"}
        statusTone={degraded ? "red" : "cyan"}
      />
      {degraded && (
        <DegradedBanner headline="github search api unavailable — stats based on fallback list" />
      )}
      <ul className="grid gap-3 sm:grid-cols-4">
        <KpiCard
          label="repos tracked"
          value={String(rows.length)}
          tone="cyan"
        />
        <KpiCard
          label="total stars"
          value={formatCompactInt(agg.totalStars)}
          tone="amber"
        />
        <KpiCard
          label="total forks"
          value={formatCompactInt(agg.totalForks)}
          tone="green"
        />
        <KpiCard
          label="updated < 24h"
          value={String(updated24h)}
          tone="magenta"
        />
      </ul>
      <StatsCharts categoryRows={agg.categoryRows} cumulative={agg.cumulative} />
    </section>
  );
}

const TONE_DOT: Record<string, string> = {
  cyan: "status-dot-cyan",
  amber: "status-dot-amber",
  green: "status-dot-green",
  magenta: "status-dot-magenta",
};

function KpiCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "cyan" | "amber" | "green" | "magenta";
}) {
  return (
    <li className="panel">
      <div className="panel-header">
        <span className="flex items-center gap-2">
          <span className={`status-dot ${TONE_DOT[tone]}`} />
          {label}
        </span>
        <span className="label-tag">metric</span>
      </div>
      <div className="px-4 py-4">
        <p className="text-fg-strong text-2xl sm:text-3xl font-semibold tabular-nums tracking-tight">
          {value}
        </p>
      </div>
    </li>
  );
}
