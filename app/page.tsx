import { fetchAiRepos, clampLimit } from "@/lib/github";
import { rankRepos } from "@/lib/rank";
import { classifyCategory } from "@/lib/category";
import { FALLBACK_REPOS } from "@/lib/fallback";
import { formatCompactInt } from "@/lib/format";
import type { RankedRepo } from "@/lib/types";
import { RepoTable } from "./components/RepoTable";
import { PageHeader, MetricChips, DegradedBanner } from "./components/PagePrimitives";

export const revalidate = 600;

const DEFAULT_LIMIT = 50;

async function loadRepos(
  limit: number,
): Promise<{ rows: RankedRepo[]; degraded: boolean; error?: string }> {
  let raw;
  let degraded = false;
  let error: string | undefined;
  try {
    raw = await fetchAiRepos(limit);
    if (raw.length === 0) {
      raw = FALLBACK_REPOS;
      degraded = true;
    }
  } catch (e) {
    raw = FALLBACK_REPOS;
    degraded = true;
    error = e instanceof Error ? e.message : String(e);
  }
  const ranked = rankRepos(raw).map((r) => ({
    ...r,
    category: classifyCategory({ topics: r.topics, description: r.description }),
  }));
  return { rows: ranked, degraded, error };
}

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ReposPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const limitParam = Array.isArray(params.limit) ? params.limit[0] : params.limit;
  const limit = clampLimit(Number(limitParam), DEFAULT_LIMIT);

  const { rows, degraded, error } = await loadRepos(limit);
  const totalStars = rows.reduce((acc, r) => acc + r.stargazers_count, 0);
  const medianScore = (() => {
    if (rows.length === 0) return 0;
    const arr = [...rows].map((r) => r.score).sort((a, b) => a - b);
    return arr[Math.floor(arr.length / 2)];
  })();

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Module 01 · Trending"
        title="Trending AI Repositories"
        subtitle={`Top ${rows.length} repos with AI / LLM / Agents topics, pushed in the last 30 days. Ranked by composite score (stars · forks · recency).`}
        statusLabel={degraded ? "DEGRADED" : "LIVE"}
        statusTone={degraded ? "red" : "cyan"}
      />
      <MetricChips
        items={[
          { label: "tracked", value: String(rows.length) },
          { label: "window", value: "30d push" },
          { label: "total stars", value: formatCompactInt(totalStars) },
          { label: "median score", value: medianScore.toFixed(2) },
        ]}
      />
      {degraded && (
        <DegradedBanner
          headline="github search api unavailable — showing curated fallback list"
          error={error}
        />
      )}
      <RepoTable rows={rows} defaultSort="score" defaultLimit={DEFAULT_LIMIT} />
    </section>
  );
}
