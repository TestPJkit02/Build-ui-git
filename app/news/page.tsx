import { fetchAiNews } from "@/lib/hn";
import { formatCompactInt, timeAgo } from "@/lib/format";
import { FALLBACK_NEWS } from "@/lib/fallback";
import type { NewsStory } from "@/lib/types";
import { PageHeader, MetricChips, DegradedBanner } from "../components/PagePrimitives";

export const revalidate = 600;

async function loadNews(): Promise<{ rows: NewsStory[]; degraded: boolean; error?: string }> {
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

export default async function NewsPage() {
  const { rows, degraded, error } = await loadNews();
  const totalPoints = rows.reduce((acc, r) => acc + r.points, 0);
  const totalComments = rows.reduce((acc, r) => acc + r.num_comments, 0);
  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Module 03 · OSINT Stream"
        title="AI News Feed"
        subtitle={`Latest ${rows.length} AI / LLM stories from Hacker News, filtered by keyword. Sorted by recency.`}
        statusLabel={degraded ? "DEGRADED" : "LIVE"}
        statusTone={degraded ? "red" : "cyan"}
      />
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
            <li
              key={story.id}
              className="px-4 py-3 hover:bg-panel-hover transition-colors"
            >
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
                  <span className="text-fg-dim group-hover:text-accent-cyan text-[10px]">
                    ↗
                  </span>
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
    </section>
  );
}
