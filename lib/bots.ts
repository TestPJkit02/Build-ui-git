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
 * Decide whether an aggregated owner / contributor is a bot.
 *
 * Resolution order (highest priority first):
 *
 *  1. Login ending in `[bot]` — GitHub's canonical App marker. This is
 *     authoritative even if the profile we fetched (after stripping the
 *     `[bot]` suffix to satisfy the Users API URL) reports
 *     `type === "Organization"`, because the suffix-stripped login refers
 *     to the *parent org* of the App (e.g. `vercel[bot]` strips to
 *     `vercel`, which IS the Vercel Inc. Organization).
 *  2. Profile `type === "Bot"` — authoritative when the GitHub Users API
 *     flags the account explicitly.
 *  3. Profile `type === "Organization"` — never a bot. This guards
 *     against a heuristic match on an org slug (e.g. `snyk-bot` if
 *     someone happened to name their org that for branding).
 *  4. Fallback: the login heuristic (`-bot` suffix or known service-acct).
 */
export function isBot(login: string, profile: UserProfile | undefined): boolean {
  if (login.toLowerCase().endsWith("[bot]")) return true;
  if (profile?.type === "Bot") return true;
  if (profile?.type === "Organization") return false;
  return isBotLogin(login);
}
