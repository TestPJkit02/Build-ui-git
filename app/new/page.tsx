import { clampLimit, fetchNewlyCreatedRepos } from "@/lib/github";
import { rankRepoTrend } from "@/lib/rank";
import { classifyCategory } from "@/lib/category";
import { FALLBACK_REPOS } from "@/lib/fallback";
import type { RankedRepo } from "@/lib/types";
import { RepoTable } from "../components/RepoTable";

export const revalidate = 600;

const DEFAULT_LIMIT = 30;
const DAYS_WINDOW = 60;

async function loadNewRepos(
  limit: number,
): Promise<{ rows: RankedRepo[]; degraded: boolean; error?: string }> {
  let raw;
  let degraded = false;
  let error: string | undefined;
  try {
    raw = await fetchNewlyCreatedRepos(limit, DAYS_WINDOW);
    if (raw.length === 0) {
      raw = FALLBACK_REPOS;
      degraded = true;
    }
  } catch (e) {
    raw = FALLBACK_REPOS;
    degraded = true;
    error = e instanceof Error ? e.message : String(e);
  }
  const ranked = rankRepoTrend(raw).map((r) => ({
    ...r,
    category: classifyCategory({ topics: r.topics, description: r.description }),
  }));
  return { rows: ranked, degraded, error };
}

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function NewPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const limitParam = Array.isArray(params.limit) ? params.limit[0] : params.limit;
  const limit = clampLimit(Number(limitParam), DEFAULT_LIMIT);

  const { rows, degraded, error } = await loadNewRepos(limit);
  return (
    <section className="max-w-6xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-bold">Newly published AI repos</h1>
      <p className="mt-2 text-slate-600">
        Repos created in the last {DAYS_WINDOW} days, ranked by{" "}
        <strong>trend score</strong> (stars per day since creation). Highlights
        young projects gaining traction quickly.
      </p>
      {degraded && (
        <div
          role="alert"
          className="mt-4 border border-amber-200 bg-amber-50 text-amber-900 text-sm rounded-md px-4 py-3"
        >
          GitHub API unavailable — showing curated fallback list (note: trend
          score on fallback rows reflects the curated repos&apos; original
          creation date, not real-time data).
          {error && <span className="block text-amber-700 mt-1">({error})</span>}
        </div>
      )}
      <div className="mt-6">
        <RepoTable
          rows={rows}
          defaultSort="trend_score"
          defaultLimit={DEFAULT_LIMIT}
          showTrend
          showCreated
        />
      </div>
    </section>
  );
}
