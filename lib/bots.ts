import type { UserProfile } from "./types";

/**
 * Hard-coded list of well-known service / bot accounts that GitHub's Users
 * API may not flag as `type === "Bot"` (because they're regular User accounts
 * acting as automation hooks). Lowercased for case-insensitive matching.
 */
const KNOWN_BOT_LOGINS: ReadonlySet<string> = new Set([
  "dependabot",
  "renovate-bot",
  "renovatebot",
  "github-actions",
  "stale",
  "mergify",
  "imgbot",
  "pre-commit-ci",
  "codecov-commenter",
  "codecov-io",
  "snyk-bot",
  "deepsource-autofix",
  "allcontributors",
  "release-please",
  "actions-user",
  "tensorflower-gardener", // TF's internal sync bot
  "torchbearer-ci-bot",
  "googleapis-publisher",
  "vercel",
]);

/**
 * Heuristic bot detection from a username alone.
 *
 * Returns true when:
 *  - login ends with `[bot]` (GitHub's canonical app suffix), OR
 *  - login ends with `-bot` (common community convention), OR
 *  - login (case-insensitive) is in the `KNOWN_BOT_LOGINS` allow-list above.
 *
 * This is the *fallback* signal — primary signal is `UserProfile.type ===
 * "Bot"` (see `isBot` below).
 */
export function isBotLogin(login: string): boolean {
  if (!login) return false;
  const lower = login.toLowerCase();
  if (lower.endsWith("[bot]")) return true;
  if (lower.endsWith("-bot")) return true;
  if (KNOWN_BOT_LOGINS.has(lower)) return true;
  return false;
}

/**
 * Decide whether an aggregated owner is a bot.
 *
 * Combines the GitHub Users API `type` field (authoritative when available)
 * with a username heuristic for service accounts that GitHub still flags as
 * `User`. If no profile was fetched at all, fall back to the heuristic.
 */
export function isBot(login: string, profile: UserProfile | undefined): boolean {
  if (profile?.type === "Bot") return true;
  return isBotLogin(login);
}
