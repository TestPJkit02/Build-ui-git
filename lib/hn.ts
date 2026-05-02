import type { NewsStory } from "./types";

const AI_KEYWORDS = [
  "ai",
  "llm",
  "gpt",
  "claude",
  "gemini",
  "machine learning",
  "deep learning",
  "neural",
  "transformer",
  "rag",
  "agent",
  "openai",
  "anthropic",
];

/**
 * Returns true if the title looks AI-related using a case-insensitive
 * keyword match.
 *
 * Whole-word match for short / ambiguous tokens (`ai`, `llm`, `gpt`, `rag`,
 * `agent`) so we don't match e.g. "rain" or "again". Multi-word keywords are
 * substring-matched.
 */
export function isAiTitle(title: string): boolean {
  const lower = title.toLowerCase();
  for (const kw of AI_KEYWORDS) {
    if (kw.includes(" ")) {
      if (lower.includes(kw)) return true;
    } else if (kw.length <= 5) {
      const re = new RegExp(`\\b${escapeRegex(kw)}\\b`, "i");
      if (re.test(title)) return true;
    } else if (lower.includes(kw)) {
      return true;
    }
  }
  return false;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface HnAlgoliaHit {
  objectID: string;
  title: string | null;
  url: string | null;
  points: number | null;
  num_comments: number | null;
  author: string;
  created_at: string;
}

interface HnAlgoliaResponse {
  hits: HnAlgoliaHit[];
}

/**
 * Map a single Algolia hit into our domain `NewsStory`. Drops items without
 * a title (Ask HN polls etc are noisy here).
 */
export function hitToStory(hit: HnAlgoliaHit): NewsStory | null {
  if (!hit.title) return null;
  return {
    id: hit.objectID,
    title: hit.title,
    url: hit.url,
    points: hit.points ?? 0,
    num_comments: hit.num_comments ?? 0,
    author: hit.author,
    created_at: hit.created_at,
    source: "hackernews",
  };
}

/**
 * Fetch the latest AI stories from Hacker News (Algolia).
 *
 * Uses Algolia's `search_by_date` for freshness. Filters with `isAiTitle`
 * because Algolia's `query` is full-text (not strict), so we still want to
 * drop unrelated hits.
 */
export async function fetchAiNews(limit = 30): Promise<NewsStory[]> {
  const url = `https://hn.algolia.com/api/v1/search_by_date?tags=story&hitsPerPage=${Math.min(
    100,
    limit * 3,
  )}&query=AI`;
  const res = await fetch(url, { next: { revalidate: 600 } });
  if (!res.ok) {
    throw new Error(`HN API failed: ${res.status}`);
  }
  const data = (await res.json()) as HnAlgoliaResponse;
  const stories: NewsStory[] = [];
  for (const hit of data.hits) {
    const story = hitToStory(hit);
    if (story && isAiTitle(story.title)) stories.push(story);
    if (stories.length >= limit) break;
  }
  return stories;
}
