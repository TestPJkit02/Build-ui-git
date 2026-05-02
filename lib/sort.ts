import type { RankedRepo, SortDir, SortKey } from "./types";

const VALID_SORT_KEYS: readonly SortKey[] = [
  "stars",
  "forks",
  "score",
  "trend_score",
  "updated",
  "created",
];

/**
 * Coerce an unknown string into a valid `SortKey`, falling back to `fallback`.
 *
 * Handles user-supplied search params (which can be anything) without throwing.
 */
export function parseSortKey(input: string | null | undefined, fallback: SortKey): SortKey {
  if (typeof input !== "string") return fallback;
  return (VALID_SORT_KEYS as readonly string[]).includes(input)
    ? (input as SortKey)
    : fallback;
}

/** Coerce an unknown string into a `SortDir`, falling back to `desc`. */
export function parseSortDir(input: string | null | undefined): SortDir {
  return input === "asc" ? "asc" : "desc";
}

/**
 * Sort a copy of `repos` by `key` in `dir` direction. Pure (does not mutate).
 *
 * Tie-breaking: stable secondary sort by `full_name` (asc) for determinism.
 *
 * - `stars` / `forks` / `score` / `trend_score` sort numerically.
 * - `updated` sorts by `pushed_at` (most-recent push activity).
 * - `created` sorts by `created_at`.
 * - Missing `trend_score` (undefined on regular `/` rows) is treated as 0.
 */
export function sortRepos(
  repos: readonly RankedRepo[],
  key: SortKey,
  dir: SortDir,
): RankedRepo[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...repos].sort((a, b) => {
    const va = sortValue(a, key);
    const vb = sortValue(b, key);
    if (va !== vb) return sign * (va < vb ? -1 : 1);
    return a.full_name.localeCompare(b.full_name);
  });
}

function sortValue(r: RankedRepo, key: SortKey): number {
  switch (key) {
    case "stars":
      return r.stargazers_count;
    case "forks":
      return r.forks_count;
    case "score":
      return r.score;
    case "trend_score":
      return r.trend_score ?? 0;
    case "updated":
      return Date.parse(r.pushed_at) || 0;
    case "created":
      return Date.parse(r.created_at) || 0;
  }
}
