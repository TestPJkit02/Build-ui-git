import { fetchAiRepos, clampLimit } from "@/lib/github";
import { FALLBACK_REPOS } from "@/lib/fallback";
import { fetchUserProfiles } from "@/lib/users";
import { aggregateByOwner, selectDevs } from "@/lib/devs";
import { formatCompactInt } from "@/lib/format";
import type { DevAggregation, Repo, UserProfile } from "@/lib/types";
import { DevTable } from "../components/DevTable";
import { PageHeader, MetricChips, DegradedBanner } from "../components/PagePrimitives";

export const revalidate = 600;

const DEFAULT_LIMIT = 200;

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

interface LoadResult {
  repos: Repo[];
  profiles: Map<string, UserProfile>;
  degraded: boolean;
  error?: string;
}

/**
 * Pull the trending AI repos and the matching owner profiles.
 *
 * If the GitHub Search API is unavailable we fall back to the curated repo
 * list AND skip the profile fetch — there's no point fanning out to the
 * Users API when the underlying search itself is degraded. The page still
 * renders a `DEGRADED` banner.
 */
async function loadAccounts(limit: number): Promise<LoadResult> {
  let repos: Repo[];
  let degraded = false;
  let error: string | undefined;

  try {
    repos = await fetchAiRepos(limit);
    if (repos.length === 0) {
      repos = FALLBACK_REPOS;
      degraded = true;
    }
  } catch (e) {
    repos = FALLBACK_REPOS;
    degraded = true;
    error = e instanceof Error ? e.message : String(e);
  }

  let profiles: Map<string, UserProfile>;
  try {
    profiles = await fetchUserProfiles(repos.map((r) => r.owner.login));
  } catch {
    profiles = new Map();
  }

  return { repos, profiles, degraded, error };
}

export default async function DevsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const limitParam = Array.isArray(params.limit) ? params.limit[0] : params.limit;
  const limit = clampLimit(Number(limitParam), DEFAULT_LIMIT);

  const { repos, profiles, degraded, error } = await loadAccounts(limit);
  const allOwners: DevAggregation[] = aggregateByOwner(repos, profiles);
  const devs = selectDevs(allOwners, profiles);

  const totalAccounts = devs.length;
  const totalRepos = devs.reduce((acc, d) => acc + d.repos_count, 0);
  const totalStars = devs.reduce((acc, d) => acc + d.total_stars, 0);
  const countryCount = new Set(
    devs.map((d) => d.country).filter((c): c is string => Boolean(c)),
  ).size;

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Module 04 · Operators"
        title="Developer Leaderboard"
        subtitle={
          <>
            GitHub accounts (users + organizations) that own the trending AI
            repos. Ranked by composite{" "}
            <span className="text-accent-cyan">score</span> = log₂(stars+1)·0.6
            + log₂(forks+1)·0.3 + log₂(repos+1)·0.1. Country derived from the
            owner&apos;s public profile location.
          </>
        }
        statusLabel={degraded ? "DEGRADED" : "LIVE"}
        statusTone={degraded ? "red" : "cyan"}
      />
      <MetricChips
        items={[
          { label: "accounts", value: String(totalAccounts) },
          { label: "tracked repos", value: String(totalRepos) },
          { label: "total stars", value: formatCompactInt(totalStars) },
          { label: "countries", value: String(countryCount) },
        ]}
      />
      {degraded && (
        <DegradedBanner
          headline="github search api unavailable — leaderboard reflects curated fallback list"
          error={error}
        />
      )}
      <DevTable
        rows={devs}
        defaultSort="score"
        defaultLimit={DEFAULT_LIMIT}
        typeMode="mixed"
      />
    </section>
  );
}
