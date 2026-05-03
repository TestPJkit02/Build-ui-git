import { clampLimit, fetchNewlyCreatedRepos } from "@/lib/github";
import { rankRepoTrend } from "@/lib/rank";
import { classifyCategory } from "@/lib/category";
import { FALLBACK_REPOS } from "@/lib/fallback";
import { formatCompactInt } from "@/lib/format";
import { fetchUserProfiles } from "@/lib/users";
import type { RankedRepo } from "@/lib/types";
import { RepoTable } from "../components/RepoTable";
import { PageHeader, MetricChips, DegradedBanner } from "../components/PagePrimitives";

/**
 * Same shape as the helper in `app/page.tsx` — duplicated locally to keep
 * each route self-contained. Building a country map from a list of repos:
 * fetch each unique owner profile and parse their `location` to ISO-2.
 */
async function loadCountryMap(rows: RankedRepo[]): Promise<Map<string, string | null>> {
  try {
    const logins = rows.map((r) => r.owner.login);
    const profiles = await fetchUserProfiles(logins);
    const out = new Map<string, string | null>();
    for (const p of profiles.values()) {
      out.set(p.login.toLowerCase(), p.country);
    }
    return out;
  } catch {
    return new Map();
  }
}

export const revalidate = 600;

// Must be one of LIMIT_PRESETS in lib/github.ts (50, 100, 200, 500, 1000).
// Earlier value of 30 made the <select> visually default to "50" (the
// first option) while the actual fetched limit was 30 — confusing mismatch
// caught by Devin Review on PR #9. Aligning with SPEC F7 default.
const DEFAULT_LIMIT = 50;
const DAYS_WINDOW = 60;

async function loadNewRepos(
  limit: number,
): Promise<{ rows: RankedRepo[]; degraded: boolean; error?: string }> {
  let raw;
  let degraded = false;
  let error: string | undefined;
  try {
    raw = await fetchNewlyCreatedRepos(limit, DAYS_WINDOW);
    if (raw.length === 0) {
      raw = FALLBACK_REPOS;
      degraded = true;
    }
  } catch (e) {
    raw = FALLBACK_REPOS;
    degraded = true;
    error = e instanceof Error ? e.message : String(e);
  }
  const ranked = rankRepoTrend(raw).map((r) => ({
    ...r,
    category: classifyCategory({ topics: r.topics, description: r.description }),
  }));
  return { rows: ranked, degraded, error };
}

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function NewPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const limitParam = Array.isArray(params.limit) ? params.limit[0] : params.limit;
  const limit = clampLimit(Number(limitParam), DEFAULT_LIMIT);

  const { rows, degraded, error } = await loadNewRepos(limit);
  const countryByLogin = await loadCountryMap(rows);
  const totalStars = rows.reduce((acc, r) => acc + r.stargazers_count, 0);
  const topTrend = rows.reduce((acc, r) => Math.max(acc, r.trend_score ?? 0), 0);

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Module 02 · Newly Published"
        title="Newly Published AI Repos"
        subtitle={
          <>
            Repos created in the last {DAYS_WINDOW} days, ranked by{" "}
            <span className="text-accent-cyan">trend score</span> (stars per day
            since creation). Highlights young projects gaining traction quickly.
          </>
        }
        statusLabel={degraded ? "DEGRADED" : "LIVE"}
        statusTone={degraded ? "red" : "cyan"}
      />
      <MetricChips
        items={[
          { label: "tracked", value: String(rows.length) },
          { label: "window", value: `${DAYS_WINDOW}d created` },
          { label: "total stars", value: formatCompactInt(totalStars) },
          { label: "top trend", value: topTrend.toFixed(1) },
        ]}
      />
      {degraded && (
        <DegradedBanner
          headline="github search api unavailable — fallback rows reflect curated repos' original creation date, not real-time trend"
          error={error}
        />
      )}
      <RepoTable
        rows={rows}
        defaultSort="trend_score"
        defaultLimit={DEFAULT_LIMIT}
        showTrend
        showCreated
        countryByLogin={countryByLogin}
      />
    </section>
  );
}
