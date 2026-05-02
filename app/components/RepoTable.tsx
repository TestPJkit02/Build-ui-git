"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useTransition } from "react";
import { filterRepos, parseCategoryList, parseMinStars } from "@/lib/filter";
import { formatCompactInt, timeAgo } from "@/lib/format";
import { GITHUB_SEARCH_MAX_RESULTS, LIMIT_PRESETS, clampLimit } from "@/lib/github";
import { parseSortDir, parseSortKey, sortRepos } from "@/lib/sort";
import type { Category, RankedRepo, SortDir, SortKey } from "@/lib/types";

const ALL_CATEGORIES: Category[] = [
  "LLM",
  "Agents",
  "RAG",
  "Vision",
  "Audio",
  "Image",
  "Tooling",
  "Other",
];

/** Status-dot color used for category indicators on rows + filter pills. */
const CATEGORY_DOT: Record<Category, string> = {
  LLM: "status-dot-cyan",
  Agents: "status-dot-magenta",
  RAG: "status-dot-amber",
  Vision: "status-dot-green",
  Audio: "status-dot-red",
  Image: "status-dot-magenta",
  Tooling: "status-dot-cyan",
  Other: "status-dot-dim",
};

interface RepoTableProps {
  rows: RankedRepo[];
  /** Default sort key applied when `?sort=` is missing. */
  defaultSort: SortKey;
  /** Whether the table should expose the trend_score column (true on /new). */
  showTrend?: boolean;
  /** Whether the table should expose a `created_at` column (true on /new). */
  showCreated?: boolean;
  /** The default limit applied when `?limit=` is missing. */
  defaultLimit: number;
}

/**
 * Client-side table wrapper that owns sort + filter + limit UI for both
 * `/` and `/new`.
 *
 * State source-of-truth is the URL search-params: `?sort`, `?dir`,
 * `?category`, `?minStars`, `?q`, `?limit`. Server pages read the same
 * params for SSR. Filter / sort UI calls `router.replace(...)` to update
 * params without losing scroll position.
 *
 * The `?limit=N` change triggers a full server round-trip (refetches more
 * repos from GitHub); the other params operate purely on the data already
 * shipped from the server, so they are instant.
 */
export function RepoTable({
  rows,
  defaultSort,
  showTrend = false,
  showCreated = false,
  defaultLimit,
}: RepoTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const sortKey = parseSortKey(searchParams.get("sort"), defaultSort);
  const sortDir: SortDir = parseSortDir(searchParams.get("dir"));
  const categories = parseCategoryList(searchParams.get("category"));
  const minStars = parseMinStars(searchParams.get("minStars"));
  const query = searchParams.get("q") ?? "";
  const limit = clampLimit(Number(searchParams.get("limit") ?? defaultLimit), defaultLimit);

  const visible = useMemo(() => {
    const filtered = filterRepos(rows, { categories, minStars, query });
    return sortRepos(filtered, sortKey, sortDir);
  }, [rows, categories, minStars, query, sortKey, sortDir]);

  function updateParams(patch: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    startTransition(() => {
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    });
  }

  function onClickHeader(key: SortKey) {
    if (sortKey === key) {
      updateParams({ sort: key, dir: sortDir === "desc" ? "asc" : "desc" });
    } else {
      updateParams({ sort: key, dir: "desc" });
    }
  }

  function toggleCategory(cat: Category) {
    const next = new Set(categories);
    if (next.has(cat)) next.delete(cat);
    else next.add(cat);
    updateParams({ category: next.size === 0 ? null : Array.from(next).join(",") });
  }

  return (
    <div className="space-y-4">
      <FilterBar
        categories={categories}
        minStars={minStars}
        query={query}
        limit={limit}
        defaultLimit={defaultLimit}
        onToggleCategory={toggleCategory}
        onMinStars={(v) => updateParams({ minStars: v > 0 ? String(v) : null })}
        onQuery={(v) => updateParams({ q: v.trim() === "" ? null : v.trim() })}
        onLimit={(v) => updateParams({ limit: String(v) })}
        onReset={() =>
          updateParams({ category: null, minStars: null, q: null, sort: null, dir: null })
        }
      />
      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] uppercase tracking-[0.12em] text-fg-muted px-1">
        <span className="flex items-center gap-2">
          <span className="status-dot status-dot-cyan" />
          showing{" "}
          <span className="text-fg-strong tabular-nums">{visible.length}</span>{" "}
          / <span className="tabular-nums">{rows.length}</span> fetched
          {isPending && (
            <span className="text-accent-amber animate-pulse">· updating</span>
          )}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-fg-dim">sort</span>
          <span className="text-accent-cyan">{sortKey}</span>
          <span className="text-fg-dim">·</span>
          <span>{sortDir}</span>
        </span>
      </div>
      <div className="panel overflow-x-auto">
        <table className="min-w-full text-[12px]">
          <thead className="text-fg-muted text-left uppercase tracking-[0.1em] text-[10px]">
            <tr className="border-b border-line">
              <th className="px-3 py-2.5 w-10">#</th>
              <th className="px-3 py-2.5">Repo</th>
              <SortableTh
                label="Stars"
                k="stars"
                active={sortKey}
                dir={sortDir}
                onClick={onClickHeader}
                align="right"
              />
              <SortableTh
                label="Forks"
                k="forks"
                active={sortKey}
                dir={sortDir}
                onClick={onClickHeader}
                align="right"
              />
              {showTrend ? (
                <SortableTh
                  label="Trend"
                  k="trend_score"
                  active={sortKey}
                  dir={sortDir}
                  onClick={onClickHeader}
                  align="right"
                />
              ) : (
                <SortableTh
                  label="Score"
                  k="score"
                  active={sortKey}
                  dir={sortDir}
                  onClick={onClickHeader}
                  align="right"
                />
              )}
              <th className="px-3 py-2.5">Category</th>
              <th className="px-3 py-2.5">Description</th>
              <SortableTh
                label="Updated"
                k="updated"
                active={sortKey}
                dir={sortDir}
                onClick={onClickHeader}
              />
              {showCreated ? (
                <SortableTh
                  label="Created"
                  k="created"
                  active={sortKey}
                  dir={sortDir}
                  onClick={onClickHeader}
                />
              ) : null}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td
                  colSpan={showCreated ? 9 : 8}
                  className="px-3 py-12 text-center text-fg-muted"
                >
                  no repos match the current filters.
                  <button
                    type="button"
                    onClick={() =>
                      updateParams({
                        category: null,
                        minStars: null,
                        q: null,
                        sort: null,
                        dir: null,
                      })
                    }
                    className="ml-2 text-accent-cyan hover:underline"
                  >
                    reset filters
                  </button>
                </td>
              </tr>
            ) : (
              visible.map((repo, idx) => (
                <tr
                  key={repo.id}
                  className="border-t border-line-soft hover:bg-panel-hover transition-colors"
                >
                  <td className="px-3 py-2 text-fg-dim tabular-nums">
                    {String(idx + 1).padStart(2, "0")}
                  </td>
                  <td className="px-3 py-2 font-medium">
                    <Link
                      className="text-fg-strong hover:text-accent-cyan inline-flex items-baseline gap-1.5 group"
                      href={repo.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <span className="text-fg-dim group-hover:text-accent-cyan text-[10px]">
                        ↗
                      </span>
                      {repo.full_name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-fg-strong">
                    {formatCompactInt(repo.stargazers_count)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-fg-primary">
                    {formatCompactInt(repo.forks_count)}
                  </td>
                  {showTrend ? (
                    <td className="px-3 py-2 text-right tabular-nums text-accent-cyan">
                      {(repo.trend_score ?? 0).toFixed(1)}
                    </td>
                  ) : (
                    <td className="px-3 py-2 text-right tabular-nums text-accent-cyan">
                      {repo.score.toFixed(2)}
                    </td>
                  )}
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1.5 border border-line px-1.5 py-0.5 text-[10px] uppercase tracking-[0.1em] text-fg-muted bg-panel-elev">
                      <span
                        className={`status-dot ${CATEGORY_DOT[repo.category]}`}
                      />
                      {repo.category}
                    </span>
                  </td>
                  <td className="px-3 py-2 max-w-md truncate text-fg-muted">
                    {repo.description ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-fg-muted whitespace-nowrap text-[11px]">
                    {timeAgo(repo.pushed_at)}
                  </td>
                  {showCreated ? (
                    <td className="px-3 py-2 text-fg-muted whitespace-nowrap text-[11px]">
                      {timeAgo(repo.created_at)}
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface SortableThProps {
  label: string;
  k: SortKey;
  active: SortKey;
  dir: SortDir;
  onClick: (k: SortKey) => void;
  align?: "left" | "right";
}

function SortableTh({ label, k, active, dir, onClick, align = "left" }: SortableThProps) {
  const isActive = active === k;
  const arrow = isActive ? (dir === "desc" ? "▾" : "▴") : "·";
  return (
    <th
      className={`px-3 py-2.5 cursor-pointer select-none transition-colors ${
        align === "right" ? "text-right" : ""
      } ${isActive ? "text-accent-cyan" : "hover:text-fg-strong"}`}
      onClick={() => onClick(k)}
    >
      <span className="inline-flex items-baseline gap-1">
        {label}
        <span
          className={`text-[10px] ${
            isActive ? "text-accent-cyan" : "text-fg-dim"
          }`}
        >
          {arrow}
        </span>
      </span>
    </th>
  );
}

interface FilterBarProps {
  categories: Category[];
  minStars: number;
  query: string;
  limit: number;
  defaultLimit: number;
  onToggleCategory: (c: Category) => void;
  onMinStars: (n: number) => void;
  onQuery: (s: string) => void;
  onLimit: (n: number) => void;
  onReset: () => void;
}

function FilterBar({
  categories,
  minStars,
  query,
  limit,
  defaultLimit,
  onToggleCategory,
  onMinStars,
  onQuery,
  onLimit,
  onReset,
}: FilterBarProps) {
  return (
    <div className="panel">
      <div className="panel-header">
        <span className="flex items-center gap-2">
          <span className="text-accent-cyan">▌</span>
          <span>filter &amp; sort</span>
        </span>
        <span className="label-tag">interactive</span>
      </div>
      <div className="px-4 py-3 space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <label className="text-[10px] uppercase tracking-[0.12em] text-fg-muted mr-1">
            category:
          </label>
          {ALL_CATEGORIES.map((cat) => {
            const active = categories.includes(cat);
            return (
              <button
                key={cat}
                type="button"
                onClick={() => onToggleCategory(cat)}
                className={`inline-flex items-center gap-1.5 border px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] transition-colors ${
                  active
                    ? "border-accent-cyan text-accent-cyan bg-accent-cyan/10"
                    : "border-line text-fg-muted hover:text-fg-strong hover:border-line-strong"
                }`}
              >
                <span className={`status-dot ${CATEGORY_DOT[cat]}`} />
                {cat}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px]">
          <label className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.12em] text-fg-muted">
              min stars:
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              step={100}
              value={minStars || ""}
              placeholder="0"
              onChange={(e) => onMinStars(Number(e.target.value))}
              className="w-24 bg-panel-elev border border-line px-2 py-1 text-fg-strong tabular-nums focus:border-accent-cyan focus:outline-none placeholder:text-fg-dim"
            />
          </label>
          <label className="flex items-center gap-2 flex-1 min-w-[180px]">
            <span className="text-[10px] uppercase tracking-[0.12em] text-fg-muted">
              search:
            </span>
            <input
              type="search"
              value={query}
              placeholder="repo name or description"
              onChange={(e) => onQuery(e.target.value)}
              className="flex-1 bg-panel-elev border border-line px-2 py-1 text-fg-strong focus:border-accent-cyan focus:outline-none placeholder:text-fg-dim"
            />
          </label>
          <label className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.12em] text-fg-muted">
              track:
            </span>
            <select
              value={limit}
              onChange={(e) => onLimit(Number(e.target.value))}
              className="bg-panel-elev border border-line px-2 py-1 text-fg-strong focus:border-accent-cyan focus:outline-none"
            >
              {LIMIT_PRESETS.map((n) => (
                <option key={n} value={n}>
                  {n}
                  {n === defaultLimit ? " (default)" : ""}
                </option>
              ))}
            </select>
            <span className="text-[10px] text-fg-dim uppercase tracking-[0.1em]">
              max {GITHUB_SEARCH_MAX_RESULTS}
            </span>
          </label>
          <button
            type="button"
            onClick={onReset}
            className="ml-auto text-[10px] uppercase tracking-[0.12em] text-fg-muted hover:text-accent-red border border-line hover:border-accent-red px-2 py-1 transition-colors"
          >
            reset
          </button>
        </div>
      </div>
    </div>
  );
}
