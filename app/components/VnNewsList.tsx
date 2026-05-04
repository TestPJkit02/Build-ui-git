import Link from "next/link";
import { formatCompactInt, timeAgo } from "@/lib/format";
import type { VnNewsItem, VnSourceId } from "@/lib/types";
import { VN_SOURCES } from "@/lib/vnSources";

const WEIGHT_TO_TONE: Record<1 | 2 | 3, string> = {
  3: "label-tag-cyan",
  2: "label-tag-amber",
  1: "label-tag",
};

function sourcePillClass(id: VnSourceId): string {
  const meta = VN_SOURCES.find((s) => s.id === id);
  return meta ? WEIGHT_TO_TONE[meta.weight] : "label-tag";
}

interface VnNewsListProps {
  items: VnNewsItem[];
  /** Optional title for the panel header (default: "signal stream"). */
  panelTitle?: string;
  /** When true, prefix each row with a rank index (used by Trending). */
  showRank?: boolean;
  /** Currently-active source filter (for cell highlighting). */
  activeSource?: VnSourceId | null;
}

export function VnNewsList({
  items,
  panelTitle = "signal stream",
  showRank = false,
  activeSource = null,
}: VnNewsListProps) {
  return (
    <div className="panel">
      <div className="panel-header">
        <span className="flex items-center gap-2">
          <span className="text-accent-cyan">▌</span>
          <span>{panelTitle}</span>
        </span>
        <span className="label-tag">{items.length} items</span>
      </div>
      {items.length === 0 ? (
        <div className="px-4 py-6 text-[12px] text-fg-muted">
          No items match the current filter.
        </div>
      ) : (
        <ul className="divide-y divide-line-soft">
          {items.map((item, idx) => (
            <li
              key={item.id}
              className={`px-4 py-3 hover:bg-panel-hover transition-colors ${
                activeSource && item.source_id === activeSource ? "bg-panel-hover" : ""
              }`}
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                {showRank && (
                  <span className="text-fg-dim text-[10px] tabular-nums">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                )}
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[13px] text-fg-strong hover:text-accent-cyan inline-flex items-baseline gap-1.5 group max-w-full break-words"
                >
                  <span className="text-fg-dim group-hover:text-accent-cyan text-[10px]">↗</span>
                  {item.title}
                </a>
                <span className="text-[10px] uppercase tracking-[0.1em] text-fg-muted ml-auto">
                  {timeAgo(item.pub_date)}
                </span>
              </div>
              {item.excerpt && (
                <p className={`mt-1 text-[11px] leading-relaxed text-fg-muted ${showRank ? "pl-7" : ""}`}>
                  {item.excerpt}
                </p>
              )}
              <div
                className={`mt-1.5 text-[10px] uppercase tracking-[0.1em] text-fg-muted flex flex-wrap items-center gap-x-3 gap-y-1 ${
                  showRank ? "pl-7" : ""
                }`}
              >
                <Link
                  href={`/news?lang=vn&source=${item.source_id}`}
                  className={`label-tag ${sourcePillClass(item.source_id)} hover:opacity-90`}
                >
                  {item.source_name}
                </Link>
                {item.ai_score > 0 && (
                  <span className="flex items-center gap-1.5">
                    <span className="status-dot status-dot-magenta" />
                    <span className="tabular-nums text-fg-primary">{formatCompactInt(item.ai_score)}</span>
                    <span>ai signal</span>
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Source-filter pills row. Renders one pill per known source plus an
 * "all" pill. Each pill is a Link to `?source=<id>` so this stays a
 * Server Component (no client-side state).
 */
export function VnSourceFilter({
  available,
  active,
}: {
  available: readonly VnSourceId[];
  active: VnSourceId | null;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[10px] uppercase tracking-[0.14em] text-fg-muted">filter:</span>
      <Link
        href="/news?lang=vn"
        className={`label-tag ${active === null ? "label-tag-cyan" : ""} hover:opacity-90`}
        aria-current={active === null ? "page" : undefined}
      >
        all sources
      </Link>
      {VN_SOURCES.filter((s) => available.includes(s.id)).map((s) => (
        <Link
          key={s.id}
          href={`/news?lang=vn&source=${s.id}`}
          className={`label-tag ${active === s.id ? sourcePillClass(s.id) : ""} hover:opacity-90`}
          aria-current={active === s.id ? "page" : undefined}
        >
          {s.name}
        </Link>
      ))}
    </div>
  );
}
