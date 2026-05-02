import { fetchAiNews } from "@/lib/hn";
import { formatCompactInt, timeAgo } from "@/lib/format";
import { FALLBACK_NEWS } from "@/lib/fallback";
import type { NewsStory } from "@/lib/types";

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
  return (
    <section className="max-w-6xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-bold">AI news feed</h1>
      <p className="mt-2 text-slate-600">
        Latest {rows.length} AI / LLM stories from Hacker News, filtered by keyword.
      </p>
      {degraded && (
        <div
          role="alert"
          className="mt-4 border border-amber-200 bg-amber-50 text-amber-900 text-sm rounded-md px-4 py-3"
        >
          Hacker News API unavailable — showing curated fallback list.
          {error && <span className="block text-amber-700 mt-1">({error})</span>}
        </div>
      )}
      <ul className="mt-6 space-y-3">
        {rows.map((story) => (
          <li key={story.id} className="rounded-lg border bg-white px-4 py-3 hover:bg-slate-50">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <a
                href={story.url ?? `https://news.ycombinator.com/item?id=${story.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-base font-medium text-slate-900 hover:underline"
              >
                {story.title}
              </a>
              <span className="text-xs text-slate-500">{timeAgo(story.created_at)}</span>
            </div>
            <div className="mt-1 text-xs text-slate-500 flex flex-wrap gap-x-4">
              <span>▲ {formatCompactInt(story.points)} points</span>
              <span>💬 {formatCompactInt(story.num_comments)} comments</span>
              <a
                href={`https://news.ycombinator.com/item?id=${story.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                discuss
              </a>
              <span>by {story.author}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
