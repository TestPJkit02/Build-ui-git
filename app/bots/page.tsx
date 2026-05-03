import { fetchAiRepos, clampLimit } from "@/lib/github";
import { FALLBACK_REPOS } from "@/lib/fallback";
import { fetchUserProfiles } from "@/lib/users";
import { aggregateByOwner, selectBots } from "@/lib/devs";
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

/** See `app/devs/page.tsx` — same shape, kept local for cohesion. */
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

export default async function BotsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const limitParam = Array.isArray(params.limit) ? params.limit[0] : params.limit;
  const limit = clampLimit(Number(limitParam), DEFAULT_LIMIT);

  const { repos, profiles, degraded, error } = await loadAccounts(limit);
  const allOwners: DevAggregation[] = aggregateByOwner(repos, profiles);
  const bots = selectBots(allOwners, profiles);

  const totalAccounts = bots.length;
  const totalRepos = bots.reduce((acc, d) => acc + d.repos_count, 0);
  const totalStars = bots.reduce((acc, d) => acc + d.total_stars, 0);
  const totalForks = bots.reduce((acc, d) => acc + d.total_forks, 0);

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Module 05 · Automata"
        title="Bot Leaderboard"
        subtitle={
          <>
            Service / app accounts (CI bots, dependency upgraders, code-quality
            bots) that show up as owners of trending AI repos. Detected via
            GitHub&apos;s{" "}
            <span className="text-accent-cyan">type === &quot;Bot&quot;</span>{" "}
            field plus a username heuristic ([bot] suffix, -bot, known service
            accounts).
          </>
        }
        statusLabel={degraded ? "DEGRADED" : "LIVE"}
        statusTone={degraded ? "red" : "amber"}
      />
      <MetricChips
        items={[
          { label: "bots", value: String(totalAccounts) },
          { label: "tracked repos", value: String(totalRepos) },
          { label: "total stars", value: formatCompactInt(totalStars) },
          { label: "total forks", value: formatCompactInt(totalForks) },
        ]}
      />
      {degraded && (
        <DegradedBanner
          headline="github search api unavailable — bot leaderboard reflects curated fallback list (likely 0 bots)"
          error={error}
        />
      )}
      <DevTable
        rows={bots}
        defaultSort="score"
        defaultLimit={DEFAULT_LIMIT}
        typeMode="bot"
      />
    </section>
  );
}
