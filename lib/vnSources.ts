import type { VnSourceId } from "./types";

/**
 * Registry of Vietnamese-language news sources for the `/news?lang=vn`
 * aggregator. Each entry holds:
 *   - `id`: stable URL/serialization key (also a TypeScript discriminator)
 *   - `name`: display label
 *   - `url`: RSS endpoint (probed via curl during research, see PR description)
 *   - `weight`: 1..3, used for the source-pill tone (3 = cyan, 2 = amber, 1 = dim)
 *   - `requires_ai_filter`: true when the feed is general-purpose and we
 *     must drop non-AI items via `isAiText`
 *   - `max_items`: per-source cap so a chatty feed can't drown the merge
 *
 * All URLs were verified to return RSS 2.0 with non-zero `<item>` count
 * during the research phase (May 2026). If a source falls offline, the
 * orchestrator (`lib/vnNews.ts`) catches per-source failure and reports
 * via `degraded` flag rather than killing the route.
 */
export interface VnSourceMeta {
  id: VnSourceId;
  name: string;
  url: string;
  weight: 1 | 2 | 3;
  requires_ai_filter: boolean;
  max_items: number;
}

export const VN_SOURCES: readonly VnSourceMeta[] = [
  {
    id: "vne-khcn",
    name: "VnExpress · KHCN",
    url: "https://vnexpress.net/rss/khoa-hoc-cong-nghe.rss",
    weight: 3,
    requires_ai_filter: false,
    max_items: 50,
  },
  {
    id: "tuoitre-nss",
    name: "Tuổi Trẻ · Nhịp sống số",
    url: "https://tuoitre.vn/rss/nhip-song-so.rss",
    weight: 3,
    requires_ai_filter: false,
    max_items: 50,
  },
  {
    id: "genk-ai",
    name: "Genk · AI",
    url: "https://genk.vn/rss/ai.rss",
    weight: 3,
    requires_ai_filter: false,
    max_items: 50,
  },
  {
    id: "tinhte",
    name: "Tinh Tế",
    url: "https://feeds.feedburner.com/tinhte",
    weight: 2,
    requires_ai_filter: true,
    max_items: 30,
  },
  {
    id: "viblo-ai",
    name: "Viblo · AI",
    url: "https://viblo.asia/rss/tags/artificial-intelligence.rss",
    weight: 2,
    requires_ai_filter: false,
    max_items: 30,
  },
  {
    id: "viblo-dl",
    name: "Viblo · Deep Learning",
    url: "https://viblo.asia/rss/tags/deep-learning.rss",
    weight: 1,
    requires_ai_filter: false,
    max_items: 20,
  },
  {
    id: "viblo-ml",
    name: "Viblo · Machine Learning",
    url: "https://viblo.asia/rss/tags/machine-learning.rss",
    weight: 1,
    requires_ai_filter: false,
    max_items: 20,
  },
  {
    id: "znews-cn",
    name: "ZNews · Công nghệ",
    url: "https://znews.vn/rss/cong-nghe.rss",
    weight: 2,
    requires_ai_filter: true,
    max_items: 30,
  },
] as const;

/** Look up a source by id (constant-time enough for our small list). */
export function getSource(id: VnSourceId): VnSourceMeta | undefined {
  return VN_SOURCES.find((s) => s.id === id);
}
