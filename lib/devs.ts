import { isBot } from "./bots";
import type { Contributor } from "./contributors";
import type { DevAggregation, DevSortKey, Repo, SortDir, UserProfile } from "./types";

/**
 * Aggregate a list of repos by owner login, joined with user profile data.
 *
 * Owners are bucketed by `repo.owner.login`. Each aggregate tracks the
 * count, total stars/forks, and the single top repo (by stars). Profile
 * data — `type`, `country`, `name`, `avatar_url`, `html_url` — is read from
 * the matching `UserProfile` when present; missing profiles fall back to
 * sensible defaults so the table still renders.
 *
 * The output is *unsorted* — caller applies `sortDevs(...)`.
 *
 * Pure function: no fetches, no globals, no Date.now() — fully testable.
 */
export function aggregateByOwner(
  repos: Repo[],
  profiles: Map<string, UserProfile>,
): DevAggregation[] {
  const profilesByLowerLogin = new Map<string, UserProfile>();
  for (const profile of profiles.values()) {
    profilesByLowerLogin.set(profile.login.toLowerCase(), profile);
  }

  const buckets = new Map<string, DevAggregation>();

  for (const repo of repos) {
    const login = repo.owner.login;
    const key = login.toLowerCase();
    const existing = buckets.get(key);
    if (existing) {
      existing.repos_count += 1;
      existing.total_stars += repo.stargazers_count;
      existing.total_forks += repo.forks_count;
      if (repo.stargazers_count > existing.top_repo_stars) {
        existing.top_repo = repo.full_name;
        existing.top_repo_stars = repo.stargazers_count;
      }
    } else {
      const profile = profilesByLowerLogin.get(key);
      buckets.set(key, {
        login: profile?.login ?? login,
        avatar_url: profile?.avatar_url ?? repo.owner.avatar_url,
        html_url: profile?.html_url ?? `https://github.com/${login}`,
        type: profile?.type ?? "User",
        name: profile?.name ?? null,
        country: profile?.country ?? null,
        repos_count: 1,
        total_stars: repo.stargazers_count,
        total_forks: repo.forks_count,
        total_contributions: 0,
        top_repo: repo.full_name,
        top_repo_stars: repo.stargazers_count,
        score: 0,
      });
    }
  }

  return Array.from(buckets.values()).map((agg) => ({
    ...agg,
    score: scoreDev(agg),
  }));
}

/**
 * Aggregate a list of contributor rows by login, joined with user profile data.
 *
 * Used by `/bots` to surface bot accounts (dependabot[bot], github-actions[bot],
 * etc.) that show up as contributors of trending AI repos. Bots almost
 * never *own* repos but routinely top the contributor list of high-velocity
 * AI projects, so an owner-based aggregate (see `aggregateByOwner` above)
 * misses them entirely.
 *
 * For each unique login we sum stars/forks of every repo they contributed
 * to, count the number of those repos, and remember the single repo with
 * the most stars as `top_repo`. `total_contributions` carries through the
 * raw commit count from GitHub's `/contributors` endpoint.
 *
 * Pure function: no fetches, no globals — fully testable.
 */
export function aggregateByContributor(
  contributors: Contributor[],
  profiles: Map<string, UserProfile>,
): DevAggregation[] {
  const profilesByLowerLogin = new Map<string, UserProfile>();
  for (const profile of profiles.values()) {
    profilesByLowerLogin.set(profile.login.toLowerCase(), profile);
  }

  const buckets = new Map<string, DevAggregation>();

  for (const c of contributors) {
    const login = c.login;
    const key = login.toLowerCase();
    const existing = buckets.get(key);
    if (existing) {
      existing.repos_count += 1;
      existing.total_stars += c.source_repo_stars;
      existing.total_forks += c.source_repo_forks;
      existing.total_contributions += c.contributions;
      if (c.source_repo_stars > existing.top_repo_stars) {
        existing.top_repo = c.source_repo;
        existing.top_repo_stars = c.source_repo_stars;
      }
    } else {
      const profile = profilesByLowerLogin.get(key);
      buckets.set(key, {
        login: profile?.login ?? login,
        avatar_url: profile?.avatar_url ?? c.avatar_url,
        html_url: profile?.html_url ?? c.html_url,
        type: profile?.type ?? "User",
        name: profile?.name ?? null,
        country: profile?.country ?? null,
        repos_count: 1,
        total_stars: c.source_repo_stars,
        total_forks: c.source_repo_forks,
        total_contributions: c.contributions,
        top_repo: c.source_repo,
        top_repo_stars: c.source_repo_stars,
        score: 0,
      });
    }
  }

  return Array.from(buckets.values()).map((agg) => ({
    ...agg,
    score: scoreDev(agg),
  }));
}

/**
 * Composite score for a developer / org / bot leaderboard row.
 *
 * `score = log2(stars+1)*0.6 + log2(forks+1)*0.3 + log2(repos+1)*0.1`
 *
 * Stars dominate (60%), forks contribute (30%), and breadth across multiple
 * repos adds a small boost (10%). Logarithmic compression prevents a single
 * huge repo from completely flattening the leaderboard.
 *
 * Pure function — no side effects, identical input → identical output.
 */
export function scoreDev(agg: Pick<DevAggregation, "total_stars" | "total_forks" | "repos_count">): number {
  const stars = Math.log2(agg.total_stars + 1) * 0.6;
  const forks = Math.log2(agg.total_forks + 1) * 0.3;
  const repos = Math.log2(agg.repos_count + 1) * 0.1;
  return Number((stars + forks + repos).toFixed(4));
}

/**
 * Sort a list of dev aggregations in-place-style (returns a new array).
 *
 * `key` selects the column; `dir` is `"asc"` or `"desc"`. Falls back to
 * `score` desc on unknown keys. Stable across equal values via secondary
 * sort by login.
 */
export function sortDevs(
  rows: DevAggregation[],
  key: DevSortKey,
  dir: SortDir,
): DevAggregation[] {
  const out = [...rows];
  const flip = dir === "asc" ? 1 : -1;
  out.sort((a, b) => {
    const cmp = compareByKey(a, b, key);
    if (cmp !== 0) return cmp * flip;
    return a.login.localeCompare(b.login);
  });
  return out;
}

function compareByKey(a: DevAggregation, b: DevAggregation, key: DevSortKey): number {
  switch (key) {
    case "stars":
      return a.total_stars - b.total_stars;
    case "forks":
      return a.total_forks - b.total_forks;
    case "repos":
      return a.repos_count - b.repos_count;
    case "contributions":
      return a.total_contributions - b.total_contributions;
    case "score":
    default:
      return a.score - b.score;
  }
}

/** Filter aggregates to only bot accounts (`type==="Bot"` OR heuristic). */
export function selectBots(
  rows: DevAggregation[],
  profiles: Map<string, UserProfile>,
): DevAggregation[] {
  const profilesByLowerLogin = new Map<string, UserProfile>();
  for (const profile of profiles.values()) {
    profilesByLowerLogin.set(profile.login.toLowerCase(), profile);
  }
  return rows.filter((row) => {
    const p = profilesByLowerLogin.get(row.login.toLowerCase());
    return isBot(row.login, p);
  });
}

/** Filter aggregates to only non-bot accounts (`User` or `Organization`). */
export function selectDevs(
  rows: DevAggregation[],
  profiles: Map<string, UserProfile>,
): DevAggregation[] {
  const profilesByLowerLogin = new Map<string, UserProfile>();
  for (const profile of profiles.values()) {
    profilesByLowerLogin.set(profile.login.toLowerCase(), profile);
  }
  return rows.filter((row) => {
    const p = profilesByLowerLogin.get(row.login.toLowerCase());
    return !isBot(row.login, p);
  });
}

/**
 * Parse a `?sort=` value for the dev/bot tables, defaulting to `score` for
 * unknown / missing inputs.
 */
export function parseDevSortKey(
  raw: string | null | undefined,
  fallback: DevSortKey = "score",
): DevSortKey {
  if (
    raw === "stars" ||
    raw === "forks" ||
    raw === "repos" ||
    raw === "score" ||
    raw === "contributions"
  ) {
    return raw;
  }
  return fallback;
}
