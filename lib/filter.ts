import type { Category, RankedRepo } from "./types";

const VALID_CATEGORIES: readonly Category[] = [
  "LLM",
  "Agents",
  "RAG",
  "Vision",
  "Audio",
  "Image",
  "Tooling",
  "Other",
];

export interface RepoFilter {
  /**
   * Comma-separated category list parsed from the URL. Empty array means
   * "no category filter applied" (i.e. show all categories).
   */
  categories: Category[];
  /** Repos with `stargazers_count < minStars` are filtered out. 0 = no filter. */
  minStars: number;
  /**
   * Free-text query matched (case-insensitive) against `full_name` and
   * `description`. Empty string = no filter.
   */
  query: string;
}

/**
 * Parse a comma-separated string of category names into a deduped, validated
 * `Category[]`. Unknown tokens are silently dropped.
 */
export function parseCategoryList(raw: string | null | undefined): Category[] {
  if (!raw) return [];
  const seen = new Set<Category>();
  for (const token of raw.split(",").map((t) => t.trim()).filter(Boolean)) {
    if ((VALID_CATEGORIES as readonly string[]).includes(token)) {
      seen.add(token as Category);
    }
  }
  return Array.from(seen);
}

/**
 * Parse a non-negative integer from a string, returning `0` for any invalid /
 * unparseable input. Used for the `minStars` filter.
 */
export function parseMinStars(raw: string | null | undefined): number {
  if (!raw) return 0;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/**
 * Apply a filter to a list of ranked repos. Pure — returns a new array.
 *
 * Filters compose with AND semantics: a repo passes only if it matches all
 * non-empty filters.
 */
export function filterRepos(
  repos: readonly RankedRepo[],
  filter: RepoFilter,
): RankedRepo[] {
  const q = filter.query.trim().toLowerCase();
  const catSet = filter.categories.length > 0 ? new Set(filter.categories) : null;
  return repos.filter((r) => {
    if (catSet && !catSet.has(r.category)) return false;
    if (filter.minStars > 0 && r.stargazers_count < filter.minStars) return false;
    if (q) {
      const hay = `${r.full_name}\n${r.description ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
