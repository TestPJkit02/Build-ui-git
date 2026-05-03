import type { UserProfile } from "./types";

/**
 * Hard-coded list of well-known service / bot accounts that GitHub's Users
 * API may not flag as `type === "Bot"` (because they're regular User accounts
 * acting as automation hooks). Lowercased for case-insensitive matching.
 *
 * IMPORTANT: do NOT add login slugs that are also live GitHub Organizations
 * (e.g. `vercel`, `mergify`, `codecov`, `dependabot-org`). Their automation
 * counterparts already use the `[bot]` suffix (`vercel[bot]`,
 * `mergify[bot]`, `dependabot[bot]`) which `isBotLogin()` catches via the
 * `endsWith("[bot]")` check. Listing the org slug here would pull the org's
 * own (human-owned) repos into `/bots`. The defensive guard in `isBot()`
 * also returns `false` for any login whose profile reports
 * `type === "Organization"`, but that only fires when we have a profile.
 */
const KNOWN_BOT_LOGINS: ReadonlySet<string> = new Set([
  "tensorflower-gardener",
  "torchbearer-ci-bot",
  "googleapis-publisher",
  "actions-user",
  "stale",
  "imgbot",
  "pre-commit-ci",
  "codecov-commenter",
  "deepsource-autofix",
  "allcontributors",
  "release-please",
  "snyk-bot",
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
 * `User`. Organizations are never treated as bots — even if a name happens
 * to match the heuristic, an Organization profile takes precedence. If no
 * profile was fetched at all, fall back to the login heuristic.
 */
export function isBot(login: string, profile: UserProfile | undefined): boolean {
  if (profile?.type === "Bot") return true;
  if (profile?.type === "Organization") return false;
  return isBotLogin(login);
}
