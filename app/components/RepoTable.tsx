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
      <div className="text-xs text-slate-500 flex items-center justify-between">
        <span>
          Showing <strong>{visible.length}</strong> of {rows.length} fetched repos
          {isPending && <span className="ml-2 text-slate-400">(updating…)</span>}
        </span>
        <span>
          Sort: {sortKey} ({sortDir})
        </span>
      </div>
      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-left">
            <tr>
              <th className="px-3 py-2 w-10">#</th>
              <th className="px-3 py-2">Repo</th>
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
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Description</th>
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
                  className="px-3 py-12 text-center text-slate-500"
                >
                  No repos match the current filters.
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
                    className="ml-2 text-blue-600 hover:underline"
                  >
                    Reset filters
                  </button>
                </td>
              </tr>
            ) : (
              visible.map((repo, idx) => (
                <tr key={repo.id} className="border-t hover:bg-slate-50">
                  <td className="px-3 py-2 text-slate-400">{idx + 1}</td>
                  <td className="px-3 py-2 font-medium">
                    <Link
                      className="text-blue-600 hover:underline"
                      href={repo.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {repo.full_name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatCompactInt(repo.stargazers_count)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatCompactInt(repo.forks_count)}
                  </td>
                  {showTrend ? (
                    <td className="px-3 py-2 text-right tabular-nums text-emerald-700">
                      {(repo.trend_score ?? 0).toFixed(1)}
                    </td>
                  ) : (
                    <td className="px-3 py-2 text-right tabular-nums text-emerald-700">
                      {repo.score.toFixed(2)}
                    </td>
                  )}
                  <td className="px-3 py-2">
                    <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs">
                      {repo.category}
                    </span>
                  </td>
                  <td className="px-3 py-2 max-w-md truncate text-slate-600">
                    {repo.description ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-slate-500 whitespace-nowrap">
                    {timeAgo(repo.pushed_at)}
                  </td>
                  {showCreated ? (
                    <td className="px-3 py-2 text-slate-500 whitespace-nowrap">
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
  const arrow = isActive ? (dir === "desc" ? "▾" : "▴") : "";
  return (
    <th
      className={`px-3 py-2 cursor-pointer select-none hover:text-slate-900 ${
        align === "right" ? "text-right" : ""
      } ${isActive ? "text-slate-900 font-semibold" : ""}`}
      onClick={() => onClick(k)}
    >
      {label}
      {arrow ? <span className="ml-1 text-slate-400">{arrow}</span> : null}
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
    <div className="rounded-lg border bg-white p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs font-medium text-slate-600 mr-2">Category:</label>
        {ALL_CATEGORIES.map((cat) => {
          const active = categories.includes(cat);
          return (
            <button
              key={cat}
              type="button"
              onClick={() => onToggleCategory(cat)}
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs ring-1 transition-colors ${
                active
                  ? "bg-blue-600 text-white ring-blue-600"
                  : "bg-white text-slate-700 ring-slate-200 hover:ring-slate-400"
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-600">Min stars:</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={100}
            value={minStars || ""}
            placeholder="0"
            onChange={(e) => onMinStars(Number(e.target.value))}
            className="w-24 rounded-md border border-slate-200 px-2 py-1 text-sm"
          />
        </label>
        <label className="flex items-center gap-2 flex-1 min-w-[180px]">
          <span className="text-xs font-medium text-slate-600">Search:</span>
          <input
            type="search"
            value={query}
            placeholder="repo name or description"
            onChange={(e) => onQuery(e.target.value)}
            className="flex-1 rounded-md border border-slate-200 px-2 py-1 text-sm"
          />
        </label>
        <label className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-600">Track:</span>
          <select
            value={limit}
            onChange={(e) => onLimit(Number(e.target.value))}
            className="rounded-md border border-slate-200 px-2 py-1 text-sm"
          >
            {LIMIT_PRESETS.map((n) => (
              <option key={n} value={n}>
                {n}
                {n === defaultLimit ? " (default)" : ""}
              </option>
            ))}
          </select>
          <span className="text-xs text-slate-400">
            (max {GITHUB_SEARCH_MAX_RESULTS})
          </span>
        </label>
        <button
          type="button"
          onClick={onReset}
          className="ml-auto text-xs text-slate-500 underline hover:text-slate-900"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
