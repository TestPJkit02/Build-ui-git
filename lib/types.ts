/**
 * Shared domain types for the AI Repo Tracker.
 *
 * Naming follows GitHub REST API where possible so we can map straight from
 * `/search/repositories` payloads.
 */

export type Category =
  | "LLM"
  | "Agents"
  | "RAG"
  | "Vision"
  | "Audio"
  | "Image"
  | "Tooling"
  | "Other";

export interface Repo {
  id: number;
  full_name: string; // "owner/name"
  html_url: string;
  description: string | null;
  stargazers_count: number;
  forks_count: number;
  pushed_at: string; // ISO 8601
  created_at: string; // ISO 8601
  topics: string[];
  language: string | null;
  owner: {
    login: string;
    avatar_url: string;
  };
}

export interface RankedRepo extends Repo {
  category: Category;
  /** Composite ranking score (stars + forks + recency). See lib/rank.ts. */
  score: number;
  /** Trend score (stars per day since creation). See lib/rank.ts. */
  trend_score?: number;
}

export type SortKey = "stars" | "forks" | "score" | "trend_score" | "updated" | "created";
export type SortDir = "asc" | "desc";

export interface NewsStory {
  id: string;
  title: string;
  url: string | null;
  points: number;
  num_comments: number;
  author: string;
  created_at: string; // ISO 8601
  source: "hackernews";
}

/** Language switch on the `/news` route. `en` = Hacker News, `vn` = aggregated VN feeds. */
export type NewsLang = "en" | "vn";

/**
 * Source IDs for the VN-news aggregator. Keep stable — they are written
 * to URL search-params (`/news?lang=vn&source=...`) and serialized into
 * fallback fixtures.
 */
export type VnSourceId =
  | "vne-khcn"
  | "tuoitre-nss"
  | "genk-ai"
  | "tinhte"
  | "viblo-ai"
  | "viblo-dl"
  | "viblo-ml"
  | "znews-cn";

export interface VnNewsItem {
  id: string;             // stable hash of canonical URL
  source_id: VnSourceId;
  source_name: string;    // human label, e.g. "VnExpress · KHCN"
  title: string;
  url: string;            // canonical URL (utm-stripped, host-lowercased)
  pub_date: string;       // ISO 8601, normalized
  pub_date_ts: number;    // unix-ms
  excerpt: string | null; // ≤200 char plain text from description
  /** Number of AI-keyword hits in title + excerpt (0..N). Used by trending rank. */
  ai_score: number;
}

/**
 * GitHub user profile fetched from `/users/:login`.
 *
 * `country` is derived from the free-text `location` field via
 * `lib/nationality.ts` and is `null` when the location is empty or cannot be
 * mapped to a known country.
 */
export interface UserProfile {
  login: string;
  avatar_url: string;
  html_url: string;
  type: "User" | "Organization" | "Bot";
  name: string | null;
  company: string | null;
  location: string | null;
  /** ISO 3166-1 alpha-2 country code derived from `location`, or `null`. */
  country: string | null;
  public_repos: number;
}

/**
 * Aggregate of an owner's tracked AI repos used by `/devs` and `/bots`.
 *
 * Constructed by grouping a `Repo[]` by `owner.login` and joining with the
 * matching `UserProfile`. Bots and humans share the same shape; the only
 * distinction is the upstream `type` filter applied per-page.
 */
export interface DevAggregation {
  login: string;
  avatar_url: string;
  html_url: string;
  type: "User" | "Organization" | "Bot";
  name: string | null;
  country: string | null;
  /**
   * Number of tracked AI repos this account is associated with.
   * For `/devs` (owner-aggregation): repos this account *owns*.
   * For `/bots` (contributor-aggregation): repos this account contributed to.
   */
  repos_count: number;
  /** Sum of stars across the tracked repos. */
  total_stars: number;
  /** Sum of forks across the tracked repos. */
  total_forks: number;
  /**
   * Sum of commits attributed to this login across the tracked repos.
   * Only populated by `aggregateByContributor`; `aggregateByOwner` leaves
   * it at `0` because GitHub does not expose owner-level commit counts.
   */
  total_contributions: number;
  /** Top repo (full_name) by stars among the tracked repos. */
  top_repo: string;
  top_repo_stars: number;
  /** Composite score (see `scoreDev` in lib/devs.ts). */
  score: number;
}

/** Sortable columns on the `/devs` and `/bots` tables. */
export type DevSortKey = "score" | "stars" | "forks" | "repos" | "contributions";
