import { fetchAiNews } from "@/lib/hn";
import { fetchVnNewsBundle } from "@/lib/vnNews";
import { VN_SOURCES } from "@/lib/vnSources";
import { formatCompactInt, timeAgo } from "@/lib/format";
import { FALLBACK_NEWS, FALLBACK_VN_NEWS } from "@/lib/fallback";
import type { NewsLang, NewsStory, VnNewsItem, VnSourceId } from "@/lib/types";
import { PageHeader, MetricChips, DegradedBanner } from "../components/PagePrimitives";
import { LangToggle } from "../components/LangToggle";
import { VnNewsList, VnSourceFilter } from "../components/VnNewsList";

export const revalidate = 600;

const VALID_SOURCE_IDS = new Set<VnSourceId>(VN_SOURCES.map((s) => s.id));

function firstOrUndef(raw: string | string[] | undefined): string | undefined {
  return Array.isArray(raw) ? raw[0] : raw;
}

function parseLang(raw: string | string[] | undefined): NewsLang {
  return firstOrUndef(raw) === "vn" ? "vn" : "en";
}

function parseSourceFilter(raw: string | string[] | undefined): VnSourceId | null {
  const v = firstOrUndef(raw);
  if (typeof v !== "string") return null;
  return VALID_SOURCE_IDS.has(v as VnSourceId) ? (v as VnSourceId) : null;
}

async function loadEnglishNews(): Promise<{
  rows: NewsStory[];
  degraded: boolean;
  error?: string;
}> {
  try {
    const stories = await fetchAiNews(30);
    if (stories.length === 0) {
      return { rows: FALLBACK_NEWS, degraded: true };
    }
    return { rows: stories, degraded: false };
  } catch (e) {
    return {
      rows: FALLBACK_NEWS,
      degraded: true,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

async function loadVietnameseNews(sourceFilter: VnSourceId | null): Promise<{
  items: VnNewsItem[];
  trending: VnNewsItem[];
  available: VnSourceId[];
  failures: VnSourceId[];
  errors: Partial<Record<VnSourceId, string>>;
  degraded: boolean;
  fatal?: string;
}> {
  try {
    const bundle = await fetchVnNewsBundle({ trendingTake: 5 });
    if (bundle.items.length === 0) {
      return {
        items: FALLBACK_VN_NEWS,
        trending: FALLBACK_VN_NEWS,
        available: VN_SOURCES.map((s) => s.id),
        failures: bundle.failures,
        errors: bundle.errors,
        degraded: true,
      };
    }
    const filtered = sourceFilter
      ? bundle.items.filter((it) => it.source_id === sourceFilter)
      : bundle.items;
    return {
      items: filtered,
      trending: bundle.trending,
      available: VN_SOURCES.map((s) => s.id),
      failures: bundle.failures,
      errors: bundle.errors,
      degraded: bundle.failures.length > 0,
    };
  } catch (e) {
    return {
      items: FALLBACK_VN_NEWS,
      trending: FALLBACK_VN_NEWS,
      available: VN_SOURCES.map((s) => s.id),
      failures: [],
      errors: {},
      degraded: true,
      fatal: e instanceof Error ? e.message : String(e),
    };
  }
}

export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const lang = parseLang(params.lang);
  const sourceFilter = parseSourceFilter(params.source);

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Module 03 · OSINT Stream"
        title="AI News Feed"
        subtitle={
          lang === "en"
            ? "Latest AI / LLM stories from Hacker News, filtered by keyword. Sorted by recency."
            : "Tin tức AI tiếng Việt — tổng hợp 8 nguồn lớn (VnExpress, Tuổi Trẻ, Genk, Tinh Tế, Viblo, ZNews). Sắp xếp theo thời gian."
        }
        statusLabel="LIVE"
        statusTone="cyan"
      />

      <LangToggle current={lang} />

      {lang === "en" ? <EnglishView /> : <VietnameseView sourceFilter={sourceFilter} />}
    </section>
  );
}

async function EnglishView() {
  const { rows, degraded, error } = await loadEnglishNews();
  const totalPoints = rows.reduce((acc, r) => acc + r.points, 0);
  const totalComments = rows.reduce((acc, r) => acc + r.num_comments, 0);
  return (
    <>
      <MetricChips
        items={[
          { label: "stories", value: String(rows.length) },
          { label: "source", value: "hn algolia" },
          { label: "total points", value: formatCompactInt(totalPoints) },
          { label: "total comments", value: formatCompactInt(totalComments) },
        ]}
      />
      {degraded && (
        <DegradedBanner
          headline="hacker news api unavailable — showing curated fallback list"
          error={error}
        />
      )}
      <div className="panel">
        <div className="panel-header">
          <span className="flex items-center gap-2">
            <span className="text-accent-cyan">▌</span>
            <span>signal stream</span>
          </span>
          <span className="label-tag">{rows.length} items</span>
        </div>
        <ul className="divide-y divide-line-soft">
          {rows.map((story, idx) => (
            <li key={story.id} className="px-4 py-3 hover:bg-panel-hover transition-colors">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-fg-dim text-[10px] tabular-nums">
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <a
                  href={story.url ?? `https://news.ycombinator.com/item?id=${story.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[13px] text-fg-strong hover:text-accent-cyan inline-flex items-baseline gap-1.5 group"
                >
                  <span className="text-fg-dim group-hover:text-accent-cyan text-[10px]">↗</span>
                  {story.title}
                </a>
                <span className="text-[10px] uppercase tracking-[0.1em] text-fg-muted ml-auto">
                  {timeAgo(story.created_at)}
                </span>
              </div>
              <div className="mt-1.5 text-[10px] uppercase tracking-[0.1em] text-fg-muted flex flex-wrap items-center gap-x-3 gap-y-1 pl-7">
                <span className="flex items-center gap-1.5">
                  <span className="status-dot status-dot-cyan" />
                  <span className="tabular-nums text-fg-primary">
                    {formatCompactInt(story.points)}
                  </span>
                  <span>points</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="status-dot status-dot-magenta" />
                  <span className="tabular-nums text-fg-primary">
                    {formatCompactInt(story.num_comments)}
                  </span>
                  <span>comments</span>
                </span>
                <span className="text-fg-dim">·</span>
                <a
                  href={`https://news.ycombinator.com/item?id=${story.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-accent-cyan"
                >
                  discuss
                </a>
                <span className="text-fg-dim">·</span>
                <span>by {story.author}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

async function VietnameseView({ sourceFilter }: { sourceFilter: VnSourceId | null }) {
  const { items, trending, available, failures, errors, degraded, fatal } =
    await loadVietnameseNews(sourceFilter);
  const totalAiSignal = items.reduce((acc, it) => acc + it.ai_score, 0);
  const sourceCount = new Set(items.map((it) => it.source_id)).size;
  return (
    <>
      <MetricChips
        items={[
          { label: "stories", value: String(items.length) },
          {
            label: "sources",
            value: `${sourceCount}/${VN_SOURCES.length}`,
          },
          { label: "ai signal", value: formatCompactInt(totalAiSignal) },
          { label: "trending", value: String(trending.length) },
        ]}
      />
      {degraded && (
        <DegradedBanner
          headline={
            fatal
              ? "vn news pipeline unavailable — showing curated fallback list"
              : `${failures.length} of ${VN_SOURCES.length} sources offline — showing remaining sources`
          }
          error={
            fatal ??
            (failures.length > 0
              ? failures.map((f) => `${f}: ${errors[f] ?? "?"}`).join(" · ")
              : undefined)
          }
        />
      )}

      <VnSourceFilter available={available} active={sourceFilter} />

      {trending.length > 0 && sourceFilter === null && (
        <VnNewsList items={trending} panelTitle="trending · ai signal × recency" showRank />
      )}

      <VnNewsList items={items} panelTitle="latest · all sources" activeSource={sourceFilter} />
    </>
  );
}
