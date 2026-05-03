import type { Repo } from "./types";

const CONTRIBUTORS_BASE = "https://api.github.com/repos";

/**
 * Concurrent contributor fetches. GitHub's secondary rate limit kicks in
 * around 80 concurrent requests; we stay well under that, but stricter than
 * `lib/users.ts` because each contributors call returns more bytes and is
 * usually run against more repos.
 */
const CONTRIBUTORS_CONCURRENCY = 6;

/** Revalidation window in seconds (matches `lib/github.ts` / `lib/users.ts`). */
const REVALIDATE_SECONDS = 600;

/**
 * Per-repo cap on contributors returned. GitHub's `?per_page` max is 100;
 * 50 is plenty for a bot leaderboard (the high-volume contributors — humans
 * AND bots — sit at the top of the list).
 */
const DEFAULT_PER_PAGE = 50;

/**
 * Per-repo cap on the total number of repos we hit for contributor data.
 * One repo = one HTTP call, so this directly bounds the worst-case API cost
 * of the `/bots` page. Trending repo lists beyond this are still tracked on
 * `/`, `/new`, `/devs` — only the bot leaderboard caps here.
 */
export const MAX_REPOS_FOR_CONTRIBUTORS = 200;

/**
 * One contributor entry, joined with the repo we observed it on.
 *
 * Multiple Contributor rows for the same `login` are expected — one per
 * source repo. Aggregation (`aggregateByContributor` in `lib/devs.ts`)
 * collapses them.
 */
export interface Contributor {
  login: string;
  avatar_url: string;
  html_url: string;
  /** Number of commits attributed to this login on this repo. */
  contributions: number;
  /** Repo full_name (`owner/name`) where these contributions came from. */
  source_repo: string;
  source_repo_stars: number;
  source_repo_forks: number;
}

interface GitHubContributorResponse {
  login: string;
  avatar_url: string;
  html_url: string;
  contributions: number;
  type: "User" | "Bot";
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
 * Fetch up to `perPage` top contributors for a single repo.
 *
 * GitHub's contributors endpoint returns the list pre-sorted by commit
 * count desc. Bots like `dependabot[bot]` and `github-actions[bot]`
 * routinely sit in the top 5 of high-velocity AI repos — that's the signal
 * the `/bots` page surfaces.
 *
 * Returns `[]` on any 4xx/5xx response or network error so a single dead
 * repo doesn't break the whole page.
 */
export async function fetchContributorsForRepo(
  repo: Repo,
  perPage = DEFAULT_PER_PAGE,
): Promise<Contributor[]> {
  const url = `${CONTRIBUTORS_BASE}/${repo.full_name}/contributors?per_page=${perPage}`;
  try {
    const res = await fetch(url, {
      headers: buildHeaders(),
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as GitHubContributorResponse[];
    if (!Array.isArray(data)) return [];
    return data.map((c) => ({
      login: c.login,
      avatar_url: c.avatar_url,
      html_url: c.html_url,
      contributions: c.contributions,
      source_repo: repo.full_name,
      source_repo_stars: repo.stargazers_count,
      source_repo_forks: repo.forks_count,
    }));
  } catch {
    return [];
  }
}

/**
 * Fetch contributors for many repos in parallel with bounded concurrency.
 *
 * The output is a flat list of {login, source_repo} pairs — same login may
 * appear once per repo it contributed to. Use `aggregateByContributor` in
 * `lib/devs.ts` to collapse into one row per login.
 *
 * Repos beyond `MAX_REPOS_FOR_CONTRIBUTORS` are silently skipped to bound
 * the worst-case API cost of the `/bots` page.
 */
export async function fetchContributorsForRepos(
  repos: Repo[],
  perPage = DEFAULT_PER_PAGE,
): Promise<Contributor[]> {
  const slice = repos.slice(0, MAX_REPOS_FOR_CONTRIBUTORS);
  const all: Contributor[] = [];
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < slice.length) {
      const i = cursor++;
      const result = await fetchContributorsForRepo(slice[i], perPage);
      all.push(...result);
    }
  }

  const workers = Array.from(
    { length: Math.min(CONTRIBUTORS_CONCURRENCY, slice.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return all;
}
