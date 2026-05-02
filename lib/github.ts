import type { Repo } from "./types";

const SEARCH_URL = "https://api.github.com/search/repositories";

/** Pre-baked AI search query targeting trending repos pushed in the last 30 days. */
export function buildAiQuery(daysWindow = 30): string {
  const since = new Date(Date.now() - daysWindow * 86400 * 1000)
    .toISOString()
    .slice(0, 10);
  const topics = ["ai", "llm", "agents", "rag", "machine-learning", "deep-learning"];
  const topicClause = topics.map((t) => `topic:${t}`).join(" OR ");
  return `(${topicClause}) stars:>=200 pushed:>=${since}`;
}

interface GitHubSearchResponse {
  items: Repo[];
}

/**
 * Fetch trending AI repos from GitHub.
 *
 * Uses an optional `GITHUB_TOKEN` env (server-side only) for higher rate limits.
 * Caches via Next's `fetch` with a 10-minute revalidation window.
 */
export async function fetchAiRepos(limit = 30, daysWindow = 30): Promise<Repo[]> {
  const q = buildAiQuery(daysWindow);
  const url = `${SEARCH_URL}?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=${Math.min(
    100,
    limit,
  )}`;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { headers, next: { revalidate: 600 } });
  if (!res.ok) {
    throw new Error(`GitHub API failed: ${res.status}`);
  }
  const data = (await res.json()) as GitHubSearchResponse;
  return (data.items ?? []).slice(0, limit);
}
