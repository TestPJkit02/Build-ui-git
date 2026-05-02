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
