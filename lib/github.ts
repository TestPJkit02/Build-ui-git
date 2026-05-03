import type { Repo } from "./types";

const SEARCH_URL = "https://api.github.com/search/repositories";

/** Hard cap from GitHub Search API: 1000 total results across all pages. */
export const GITHUB_SEARCH_MAX_RESULTS = 1000;
/** Per-page max for GitHub Search API. */
const PER_PAGE_MAX = 100;
/**
 * Allowed `?limit=` values exposed in the UI dropdown. Pages MUST pick a
 * `DEFAULT_LIMIT` from this list — otherwise the `<select>` shows a
 * mismatched value (visually defaults to first option while the server
 * uses the page's `DEFAULT_LIMIT`).
 */
export const LIMIT_PRESETS: readonly number[] = [50, 100, 200, 500, 1000];
const KEYWORDS = ["ai", "llm", "agents", "rag", "machine-learning", "deep-learning"];

/**
 * Pre-baked AI search query targeting trending repos pushed in the last
 * `daysWindow` days.
 *
 * Note: GitHub's Search API does NOT support disjunctive `topic:X OR topic:Y`
 * grouping — that form is rejected with `Validation Failed` (or silently
 * returns 0 results). Earlier versions of this function used
 * `(topic:ai OR topic:llm OR ...) stars:>=200 pushed:>=...` and were
 * therefore always returning empty, causing the page to fall back to the
 * static curated list even when a `GITHUB_TOKEN` was supplied.
 *
 * The fix is to drop the per-keyword `topic:` qualifier and use a single
 * keyword disjunction with `in:topics,description`, which IS supported and
 * matches a repo whose topic OR description contains any of the keywords.
 */
export function buildAiQuery(daysWindow = 30): string {
  const since = isoDaysAgo(daysWindow);
  const keywordClause = KEYWORDS.join(" OR ");
  return `(${keywordClause}) in:topics,description stars:>=200 pushed:>=${since}`;
}

/**
 * Pre-baked query for the `/new` tab — repos *created* in the last
 * `daysWindow` days (default 60). Uses a lower star floor (`stars:>=20`)
 * because brand-new repos rarely have hundreds of stars yet.
 */
export function buildNewRepoQuery(daysWindow = 60): string {
  const since = isoDaysAgo(daysWindow);
  const keywordClause = KEYWORDS.join(" OR ");
  return `(${keywordClause}) in:topics,description stars:>=20 created:>=${since}`;
}

interface GitHubSearchResponse {
  items: Repo[];
}

interface FetchOpts {
  /** Max results to return. Hard-capped at 1000 (GitHub limit). */
  limit?: number;
  /** Time window in days. */
  daysWindow?: number;
  /** Sort field passed to the API. */
  sort?: "stars" | "updated" | "forks";
}

/**
 * Clamp a user-supplied limit into the valid range `[1, GITHUB_SEARCH_MAX_RESULTS]`.
 *
 * Used by both server-side fetchers and client-side input validation. Returns
 * the default `defaultLimit` for any non-finite / non-positive input. Always
 * returns an integer.
 */
export function clampLimit(input: number | undefined, defaultLimit = 50): number {
  if (input === undefined || !Number.isFinite(input) || input <= 0) return defaultLimit;
  return Math.min(GITHUB_SEARCH_MAX_RESULTS, Math.floor(input));
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400 * 1000).toISOString().slice(0, 10);
}

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/**
 * Run a paginated GitHub Search until we have `limit` items (or run out).
 *
 * GitHub Search caps at 100 items per page and 1000 total results, so we
 * issue at most `ceil(limit / 100)` requests. Caller-side `limit` should
 * already be clamped via `clampLimit()` but we re-clamp defensively.
 *
 * Each fetch is wrapped in Next.js's `revalidate` cache (600s) to avoid
 * hammering GitHub on hot routes.
 */
async function fetchSearchPaginated(
  q: string,
  opts: FetchOpts,
): Promise<Repo[]> {
  const limit = clampLimit(opts.limit, 30);
  const sort = opts.sort ?? "stars";
  const headers = buildHeaders();
  const collected: Repo[] = [];
  const totalPages = Math.ceil(limit / PER_PAGE_MAX);

  for (let page = 1; page <= totalPages; page++) {
    const remaining = limit - collected.length;
    if (remaining <= 0) break;
    const perPage = Math.min(PER_PAGE_MAX, remaining);
    const url =
      `${SEARCH_URL}?q=${encodeURIComponent(q)}` +
      `&sort=${sort}&order=desc&per_page=${perPage}&page=${page}`;
    const res = await fetch(url, { headers, next: { revalidate: 600 } });
    if (!res.ok) {
      throw new Error(`GitHub API failed: ${res.status}`);
    }
    const data = (await res.json()) as GitHubSearchResponse;
    const items = data.items ?? [];
    collected.push(...items);
    // Last page may be short — stop early if API returned fewer than requested.
    if (items.length < perPage) break;
  }
  return collected.slice(0, limit);
}

/**
 * Fetch trending AI repos (recent push activity) from GitHub.
 *
 * Uses an optional `GITHUB_TOKEN` env (server-side only) for higher rate
 * limits and supports pagination up to 1000 results. Caches via Next's
 * `fetch` with a 10-minute revalidation window.
 */
export async function fetchAiRepos(limit = 30, daysWindow = 30): Promise<Repo[]> {
  const q = buildAiQuery(daysWindow);
  return fetchSearchPaginated(q, { limit, daysWindow, sort: "stars" });
}

/**
 * Fetch newly published AI repos (created within `daysWindow` days).
 *
 * Same pagination semantics as `fetchAiRepos`. Caller is expected to apply
 * the trend-score ranking via `rankRepoTrend()` rather than relying on the
 * API's `sort=stars` order, since the page-1-by-stars-desc subset is biased
 * toward older repos that hit big stars early.
 */
export async function fetchNewlyCreatedRepos(
  limit = 30,
  daysWindow = 60,
): Promise<Repo[]> {
  const q = buildNewRepoQuery(daysWindow);
  return fetchSearchPaginated(q, { limit, daysWindow, sort: "stars" });
}
