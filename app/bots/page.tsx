import { fetchAiRepos, clampLimit } from "@/lib/github";
import { FALLBACK_REPOS } from "@/lib/fallback";
import { fetchUserProfiles } from "@/lib/users";
import {
  fetchContributorsForRepos,
  type Contributor,
} from "@/lib/contributors";
import { aggregateByContributor, selectBots } from "@/lib/devs";
import { isBotLogin } from "@/lib/bots";
import { formatCompactInt } from "@/lib/format";
import type { Repo, UserProfile } from "@/lib/types";
import { DevTable } from "../components/DevTable";
import { PageHeader, MetricChips, DegradedBanner } from "../components/PagePrimitives";

export const revalidate = 600;

const DEFAULT_LIMIT = 200;

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

interface LoadResult {
  repos: Repo[];
  contributors: Contributor[];
  profiles: Map<string, UserProfile>;
  degraded: boolean;
  error?: string;
}

/**
 * Bot leaderboard data flow:
 *
 *  1. Fetch trending AI repos (same source as `/`, `/new`, `/devs`).
 *  2. For each tracked repo, fetch up to 50 contributors. Bots like
 *     `dependabot[bot]` and `github-actions[bot]` routinely sit in the top
 *     5 of high-velocity repos.
 *  3. Filter contributors to those that look like bots (suffix heuristic
 *     applied *before* the profile fetch so we never burn API calls on
 *     human contributors).
 *  4. Fetch user profiles only for the bot candidates — much cheaper than
 *     fetching profiles for every contributor of every repo.
 *  5. Aggregate by login, score, render.
 *
 * This is a deliberately different pipeline from `/devs` (which aggregates
 * by repo *owner*) because GitHub does not let bots own repos — they only
 * appear as contributors. See `lib/contributors.ts` for the API client.
 */
async function loadBots(limit: number): Promise<LoadResult> {
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

  let contributors: Contributor[] = [];
  try {
    contributors = await fetchContributorsForRepos(repos);
  } catch {
    contributors = [];
  }

  // Pre-filter to bot candidates so the profile fetch in step 4 stays cheap.
  // The defensive Organization guard in `isBot()` (lib/bots.ts) ensures that
  // any login that *does* turn out to be an Organization is still excluded
  // even after this initial heuristic match.
  const botCandidates = contributors.filter((c) => isBotLogin(c.login));

  let profiles: Map<string, UserProfile>;
  try {
    profiles = await fetchUserProfiles(
      Array.from(new Set(botCandidates.map((c) => c.login))),
    );
  } catch {
    profiles = new Map();
  }

  return { repos, contributors: botCandidates, profiles, degraded, error };
}

export default async function BotsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const limitParam = Array.isArray(params.limit) ? params.limit[0] : params.limit;
  const limit = clampLimit(Number(limitParam), DEFAULT_LIMIT);

  const { repos, contributors, profiles, degraded, error } = await loadBots(limit);
  const allContributors = aggregateByContributor(contributors, profiles);
  // The Organization guard inside `isBot()` discards any login whose profile
  // turned out to be an org (e.g. `vercel`) even though the suffix matched.
  const bots = selectBots(allContributors, profiles);

  const totalBots = bots.length;
  const totalRepos = repos.length;
  const totalCommits = bots.reduce((acc, d) => acc + d.total_contributions, 0);
  const totalStars = bots.reduce((acc, d) => acc + d.total_stars, 0);

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Module 05 · Automata"
        title="Bot Leaderboard"
        subtitle={
          <>
            Service / app accounts (CI bots, dependency upgraders, code-quality
            bots) that contribute commits to trending AI repos. Detected via
            GitHub&apos;s{" "}
            <span className="text-accent-cyan">type === &quot;Bot&quot;</span>{" "}
            field plus a username heuristic ([bot] suffix, -bot, known service
            accounts), with a defensive guard that never classifies live
            Organizations as bots.
          </>
        }
        statusLabel={degraded ? "DEGRADED" : "LIVE"}
        statusTone={degraded ? "red" : "cyan"}
      />
      <MetricChips
        items={[
          { label: "bots", value: String(totalBots) },
          { label: "tracked repos", value: String(totalRepos) },
          { label: "commits", value: formatCompactInt(totalCommits) },
          { label: "reach (stars)", value: formatCompactInt(totalStars) },
        ]}
      />
      {degraded && (
        <DegradedBanner
          headline="github search api unavailable — bot leaderboard reflects curated fallback list"
          error={error}
        />
      )}
      <DevTable
        rows={bots}
        defaultSort="contributions"
        defaultLimit={DEFAULT_LIMIT}
        typeMode="bot"
        showContributions
      />
    </section>
  );
}
