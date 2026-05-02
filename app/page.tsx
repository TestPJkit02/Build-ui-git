import { fetchAiRepos } from "@/lib/github";
import { rankRepos } from "@/lib/rank";
import { classifyCategory } from "@/lib/category";
import { formatCompactInt, timeAgo } from "@/lib/format";
import { FALLBACK_REPOS } from "@/lib/fallback";
import type { RankedRepo } from "@/lib/types";

export const revalidate = 600;

async function loadRepos(): Promise<{ rows: RankedRepo[]; degraded: boolean; error?: string }> {
  let raw;
  let degraded = false;
  let error: string | undefined;
  try {
    raw = await fetchAiRepos(30);
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

export default async function ReposPage() {
  const { rows, degraded, error } = await loadRepos();
  return (
    <section className="max-w-6xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-bold">Trending AI repositories</h1>
      <p className="mt-2 text-slate-600">
        Top {rows.length} repos with AI / LLM / Agents topics, pushed in the last 30 days.
        Ranked by composite score (stars, forks, recency).
      </p>
      {degraded && (
        <div
          role="alert"
          className="mt-4 border border-amber-200 bg-amber-50 text-amber-900 text-sm rounded-md px-4 py-3"
        >
          GitHub API unavailable — showing curated fallback list.
          {error && <span className="block text-amber-700 mt-1">({error})</span>}
        </div>
      )}
      <div className="mt-6 overflow-x-auto rounded-lg border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-left">
            <tr>
              <th className="px-3 py-2 w-10">#</th>
              <th className="px-3 py-2">Repo</th>
              <th className="px-3 py-2 text-right">Stars</th>
              <th className="px-3 py-2 text-right">Forks</th>
              <th className="px-3 py-2 text-right">Score</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2">Updated</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((repo, idx) => (
              <tr key={repo.id} className="border-t hover:bg-slate-50">
                <td className="px-3 py-2 text-slate-400">{idx + 1}</td>
                <td className="px-3 py-2 font-medium">
                  <a
                    className="text-blue-600 hover:underline"
                    href={repo.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {repo.full_name}
                  </a>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCompactInt(repo.stargazers_count)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCompactInt(repo.forks_count)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-emerald-700">
                  {repo.score.toFixed(2)}
                </td>
                <td className="px-3 py-2">
                  <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs">
                    {repo.category}
                  </span>
                </td>
                <td className="px-3 py-2 max-w-md truncate text-slate-600">
                  {repo.description ?? "—"}
                </td>
                <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{timeAgo(repo.pushed_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
