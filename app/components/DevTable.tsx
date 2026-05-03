"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useTransition } from "react";
import { sortDevs, parseDevSortKey } from "@/lib/devs";
import { formatCompactInt } from "@/lib/format";
import { GITHUB_SEARCH_MAX_RESULTS, LIMIT_PRESETS, clampLimit } from "@/lib/github";
import { countryFlag, countryName } from "@/lib/nationality";
import { parseSortDir } from "@/lib/sort";
import type { DevAggregation, DevSortKey, SortDir } from "@/lib/types";

interface DevTableProps {
  /** Already-aggregated rows (sorted or not — this component re-sorts). */
  rows: DevAggregation[];
  /** Default sort key when `?sort=` is absent. */
  defaultSort: DevSortKey;
  /** Default limit when `?limit=` is absent. */
  defaultLimit: number;
  /**
   * Display label for the `Type` column. `"User / Org"` on `/devs`,
   * `"Bot"` on `/bots`. Bot table also forces every row to show "Bot".
   */
  typeMode: "mixed" | "bot";
}

/**
 * Client-side table for `/devs` and `/bots`. Owns sort + limit URL params.
 *
 * Note: there's no category / minStars / search filter here (unlike the
 * `RepoTable`) — the leaderboard is naturally short (50–200 rows) and a
 * raw sort is sufficient. The `?limit=` param triggers a server refetch
 * because increasing it pulls more upstream repos.
 */
export function DevTable({ rows, defaultSort, defaultLimit, typeMode }: DevTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const sortKey = parseDevSortKey(searchParams.get("sort"), defaultSort);
  const sortDir: SortDir = parseSortDir(searchParams.get("dir"));
  const limit = clampLimit(Number(searchParams.get("limit") ?? defaultLimit), defaultLimit);

  const visible = useMemo(
    () => sortDevs(rows, sortKey, sortDir),
    [rows, sortKey, sortDir],
  );

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

  function onClickHeader(key: DevSortKey) {
    if (sortKey === key) {
      updateParams({ sort: key, dir: sortDir === "desc" ? "asc" : "desc" });
    } else {
      updateParams({ sort: key, dir: "desc" });
    }
  }

  return (
    <div className="space-y-4">
      <div className="panel">
        <div className="panel-header">
          <span className="flex items-center gap-2">
            <span className="text-accent-cyan">▌</span>
            <span>controls</span>
          </span>
          <span className="label-tag">interactive</span>
        </div>
        <div className="px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px]">
          <label className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.12em] text-fg-muted">
              track:
            </span>
            <select
              value={limit}
              onChange={(e) => updateParams({ limit: String(Number(e.target.value)) })}
              className="bg-panel-elev border border-line px-2 py-1 text-fg-strong tabular-nums focus:border-accent-cyan focus:outline-none"
            >
              {LIMIT_PRESETS.map((n) => (
                <option key={n} value={n}>
                  {n === defaultLimit ? `${n} (default)` : n}
                </option>
              ))}
            </select>
            <span className="text-[10px] uppercase tracking-[0.12em] text-fg-dim">
              max {GITHUB_SEARCH_MAX_RESULTS}
            </span>
          </label>
          <button
            type="button"
            onClick={() => updateParams({ sort: null, dir: null })}
            className="ml-auto text-[10px] uppercase tracking-[0.12em] text-fg-muted hover:text-accent-cyan border border-line hover:border-accent-cyan px-2 py-1"
          >
            reset sort
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] uppercase tracking-[0.12em] text-fg-muted px-1">
        <span className="flex items-center gap-2">
          <span className="status-dot status-dot-cyan" />
          showing{" "}
          <span className="text-fg-strong tabular-nums">{visible.length}</span>{" "}
          accounts
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
              <th className="px-3 py-2.5 w-20">Country</th>
              <th className="px-3 py-2.5">Account</th>
              <th className="px-3 py-2.5 w-24">Type</th>
              <DevSortableTh
                label="Repos"
                k="repos"
                active={sortKey}
                dir={sortDir}
                onClick={onClickHeader}
                align="right"
              />
              <DevSortableTh
                label="Stars"
                k="stars"
                active={sortKey}
                dir={sortDir}
                onClick={onClickHeader}
                align="right"
              />
              <DevSortableTh
                label="Forks"
                k="forks"
                active={sortKey}
                dir={sortDir}
                onClick={onClickHeader}
                align="right"
              />
              <th className="px-3 py-2.5">Top Repo</th>
              <DevSortableTh
                label="Score"
                k="score"
                active={sortKey}
                dir={sortDir}
                onClick={onClickHeader}
                align="right"
              />
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-12 text-center text-fg-muted">
                  no accounts to display.
                </td>
              </tr>
            ) : (
              visible.map((row, idx) => (
                <tr
                  key={row.login}
                  className="border-t border-line-soft hover:bg-panel-hover transition-colors"
                >
                  <td className="px-3 py-2 text-fg-dim tabular-nums">
                    {String(idx + 1).padStart(2, "0")}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <DevCountryCell code={row.country} />
                  </td>
                  <td className="px-3 py-2 font-medium">
                    <Link
                      className="text-fg-strong hover:text-accent-cyan inline-flex items-baseline gap-1.5 group"
                      href={row.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <span className="text-fg-dim group-hover:text-accent-cyan text-[10px]">
                        ↗
                      </span>
                      <span>{row.login}</span>
                      {row.name ? (
                        <span className="text-fg-dim text-[10px] hidden sm:inline">
                          · {row.name}
                        </span>
                      ) : null}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <TypeBadge type={typeMode === "bot" ? "Bot" : row.type} />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-fg-strong">
                    {row.repos_count}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-fg-strong">
                    {formatCompactInt(row.total_stars)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-fg-primary">
                    {formatCompactInt(row.total_forks)}
                  </td>
                  <td className="px-3 py-2 text-fg-muted whitespace-nowrap">
                    <Link
                      href={`https://github.com/${row.top_repo}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-accent-cyan"
                    >
                      {row.top_repo}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-accent-cyan">
                    {row.score.toFixed(2)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DevCountryCell({ code }: { code: string | null }) {
  if (!code) return <span className="text-fg-dim">—</span>;
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[12px] tabular-nums text-fg-primary"
      title={countryName(code)}
    >
      <span className="text-base leading-none">{countryFlag(code)}</span>
      <span className="text-fg-muted text-[11px]">{code.toUpperCase()}</span>
    </span>
  );
}

const TYPE_PILL: Record<"User" | "Organization" | "Bot", string> = {
  User: "label-tag",
  Organization: "label-tag label-tag-cyan",
  Bot: "label-tag label-tag-amber",
};

function TypeBadge({ type }: { type: "User" | "Organization" | "Bot" }) {
  const label = type === "Organization" ? "Org" : type;
  return <span className={TYPE_PILL[type]}>{label}</span>;
}

interface DevSortableThProps {
  label: string;
  k: DevSortKey;
  active: DevSortKey;
  dir: SortDir;
  onClick: (k: DevSortKey) => void;
  align?: "left" | "right";
}

function DevSortableTh({ label, k, active, dir, onClick, align = "left" }: DevSortableThProps) {
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
