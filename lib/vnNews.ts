import { aiScore, isAiText } from "./aiKeywords";
import { parseRssFeed } from "./rss";
import type { VnNewsItem, VnSourceId } from "./types";
import { VN_SOURCES, getSource, type VnSourceMeta } from "./vnSources";

/**
 * Canonical-URL helper: lowercase host, strip `utm_*` query params, drop
 * trailing slash. Used as the dedup key + as the basis for the item id.
 *
 * Returns the original input on parse failure so we never crash a feed
 * because of one weird URL.
 */
export function canonicalUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.hostname = u.hostname.toLowerCase();
    const drop: string[] = [];
    u.searchParams.forEach((_, k) => {
      if (k.toLowerCase().startsWith("utm_") || k.toLowerCase() === "fbclid") {
        drop.push(k);
      }
    });
    drop.forEach((k) => u.searchParams.delete(k));
    let s = u.toString();
    if (s.endsWith("/") && u.pathname !== "/") s = s.slice(0, -1);
    return s;
  } catch {
    return raw;
  }
}

/**
 * djb2-style hash (32-bit). Stable across runs, no external dep.
 * We only need a short id — collision risk is negligible at this scale.
 */
export function shortHash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

/**
 * Parse one source's RSS body into normalized `VnNewsItem`s. Pure (no
 * fetch); accepts the raw feed body so callers can mock it.
 */
export function parseSourceFeed(meta: VnSourceMeta, xml: string): VnNewsItem[] {
  const items = parseRssFeed(xml);
  const out: VnNewsItem[] = [];
  for (const it of items) {
    const haystack = `${it.title} ${it.description ?? ""}`;
    if (meta.requires_ai_filter && !isAiText(haystack)) continue;
    const url = canonicalUrl(it.link);
    out.push({
      id: shortHash(`${meta.id}|${url}`),
      source_id: meta.id,
      source_name: meta.name,
      title: it.title,
      url,
      pub_date: it.pub_date_iso,
      pub_date_ts: it.pub_date_ts,
      excerpt: it.description,
      ai_score: aiScore(haystack),
    });
    if (out.length >= meta.max_items) break;
  }
  return out;
}

/**
 * Dedup a merged list by canonical URL. Keeps the first occurrence — when
 * two sources cross-post (e.g. Tuổi Trẻ + VnExpress on the same wire
 * story) we surface the source that listed it first per the merge order.
 */
export function dedupByUrl(items: VnNewsItem[]): VnNewsItem[] {
  const seen = new Set<string>();
  const out: VnNewsItem[] = [];
  for (const it of items) {
    if (seen.has(it.url)) continue;
    seen.add(it.url);
    out.push(it);
  }
  return out;
}

/**
 * Sort a list newest-first (descending by `pub_date_ts`). Stable.
 */
export function sortByRecency(items: VnNewsItem[]): VnNewsItem[] {
  return [...items].sort((a, b) => b.pub_date_ts - a.pub_date_ts);
}

/**
 * Trending score: `ai_score × recency_decay`, where recency decays
 * linearly from 1.0 (just posted) to 0 at one week old. A burst of
 * AI-keyword density pushes a fresh item above older heavyweight items
 * — same shape as the `/new` route's trend score for repos.
 */
export function trendScore(item: VnNewsItem, now: number): number {
  const ageMs = now - item.pub_date_ts;
  const ageHours = Math.max(0, ageMs / (1000 * 60 * 60));
  const decay = Math.max(0, 1 - ageHours / (24 * 7));
  return item.ai_score * decay;
}

/**
 * Top-N items by `trendScore`, ties broken by recency. Filters out items
 * with `ai_score == 0` (irrelevant).
 */
export function rankTrending(items: VnNewsItem[], n: number, now: number): VnNewsItem[] {
  return items
    .filter((it) => it.ai_score > 0)
    .map((it) => ({ it, t: trendScore(it, now) }))
    .filter(({ t }) => t > 0)
    .sort((a, b) => (b.t - a.t) || (b.it.pub_date_ts - a.it.pub_date_ts))
    .slice(0, n)
    .map(({ it }) => it);
}

/**
 * Bounded-concurrency map. Worker count = 4 to balance fetch parallelism
 * against politeness for the upstream sites.
 */
export async function mapWithConcurrency<I, O>(
  items: readonly I[],
  worker: (item: I) => Promise<O>,
  concurrency = 4,
): Promise<O[]> {
  const out: O[] = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      out[i] = await worker(items[i]);
    }
  });
  await Promise.all(runners);
  return out;
}

export interface VnNewsBundle {
  /** All items from successful sources, deduped, sorted newest-first. */
  items: VnNewsItem[];
  /** Top trending (ai_score × recency_decay). */
  trending: VnNewsItem[];
  /** Sources that failed to fetch or parse. */
  failures: VnSourceId[];
  /** Captured per-source error messages keyed by source id (for debugging). */
  errors: Partial<Record<VnSourceId, string>>;
}

interface FetchVnNewsOptions {
  sources?: readonly VnSourceId[];
  trendingTake?: number;
  /** Injection seam for tests / fallback-mode (e.g. process.env). */
  fetchFn?: typeof fetch;
  /** Overrideable wall clock for the trending decay. */
  now?: number;
}

/**
 * Top-level orchestrator: fetch every selected source in parallel, parse,
 * filter, dedup, sort, rank trending. Per-source failures degrade the
 * page rather than break it. Cached at the Next.js data layer for 600 s
 * to match the existing `/news` (HN) and `/` (GitHub) cadence.
 */
export async function fetchVnNewsBundle(
  options: FetchVnNewsOptions = {},
): Promise<VnNewsBundle> {
  const fetchFn = options.fetchFn ?? fetch;
  const now = options.now ?? Date.now();
  const enabledIds = options.sources && options.sources.length > 0 ? options.sources : null;
  const selected = VN_SOURCES.filter((s) => !enabledIds || enabledIds.includes(s.id));

  const failures: VnSourceId[] = [];
  const errors: Partial<Record<VnSourceId, string>> = {};
  type Result = { id: VnSourceId; items: VnNewsItem[] };

  const results = await mapWithConcurrency<VnSourceMeta, Result>(selected, async (meta) => {
    try {
      const res = await fetchFn(meta.url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; AiRepoMonitor/1.0; +https://build-ui-git.vercel.app)",
          Accept: "application/rss+xml, application/xml;q=0.9, */*;q=0.8",
          "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8",
        },
        next: { revalidate: 600 },
      } as RequestInit & { next?: { revalidate: number } });
      if (!res.ok) {
        failures.push(meta.id);
        errors[meta.id] = `HTTP ${res.status}`;
        return { id: meta.id, items: [] };
      }
      const xml = await res.text();
      const items = parseSourceFeed(meta, xml);
      if (items.length === 0) {
        failures.push(meta.id);
        errors[meta.id] = "no items parsed";
      }
      return { id: meta.id, items };
    } catch (e) {
      failures.push(meta.id);
      errors[meta.id] = e instanceof Error ? e.message : String(e);
      return { id: meta.id, items: [] };
    }
  });

  const merged = results.flatMap((r) => r.items);
  const items = sortByRecency(dedupByUrl(merged));
  const trending = rankTrending(items, options.trendingTake ?? 5, now);
  return { items, trending, failures, errors };
}

// Re-export for convenient consumers.
export { VN_SOURCES, getSource };
