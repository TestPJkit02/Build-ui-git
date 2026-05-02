import type { Repo } from "./types";

const RECENCY_FRESH_DAYS = 7;
const RECENCY_STALE_DAYS = 90;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Recency factor in [0, 1].
 *
 * - 1.0 if pushed within RECENCY_FRESH_DAYS.
 * - linearly decays to 0 at RECENCY_STALE_DAYS.
 * - 0 if older than RECENCY_STALE_DAYS or invalid date.
 */
export function recencyFactor(pushedAt: string, now: Date = new Date()): number {
  const t = Date.parse(pushedAt);
  if (Number.isNaN(t)) return 0;
  const ageDays = Math.max(0, (now.getTime() - t) / MS_PER_DAY);
  if (ageDays <= RECENCY_FRESH_DAYS) return 1;
  if (ageDays >= RECENCY_STALE_DAYS) return 0;
  const span = RECENCY_STALE_DAYS - RECENCY_FRESH_DAYS;
  return 1 - (ageDays - RECENCY_FRESH_DAYS) / span;
}

/**
 * Composite ranking score.
 *
 *   score = 0.5 * log2(stars+1) + 0.3 * log2(forks+1) + 0.2 * recency
 *
 * Pure function — depends only on inputs and `now` for testability.
 */
export function repoScore(repo: Pick<Repo, "stargazers_count" | "forks_count" | "pushed_at">, now: Date = new Date()): number {
  const stars = Math.max(0, repo.stargazers_count);
  const forks = Math.max(0, repo.forks_count);
  const starComponent = 0.5 * Math.log2(stars + 1);
  const forkComponent = 0.3 * Math.log2(forks + 1);
  const recencyComponent = 0.2 * recencyFactor(repo.pushed_at, now);
  return starComponent + forkComponent + recencyComponent;
}

/**
 * Sort copy of `repos` by score descending. Ties broken by stars then full_name.
 */
export function rankRepos<T extends Repo>(repos: T[], now: Date = new Date()): (T & { score: number })[] {
  return repos
    .map((r) => ({ ...r, score: repoScore(r, now) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.stargazers_count !== a.stargazers_count) {
        return b.stargazers_count - a.stargazers_count;
      }
      return a.full_name.localeCompare(b.full_name);
    });
}
