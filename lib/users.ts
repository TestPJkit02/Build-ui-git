import { locationToCountry } from "./nationality";
import type { UserProfile } from "./types";

const USERS_URL = "https://api.github.com/users";

/** Concurrent profile fetches per `fetchUserProfiles` call. */
const PROFILE_CONCURRENCY = 8;

/** Revalidation window in seconds (matches `lib/github.ts`). */
const REVALIDATE_SECONDS = 600;

interface GitHubUserResponse {
  login: string;
  id: number;
  avatar_url: string;
  html_url: string;
  type: "User" | "Organization" | "Bot";
  name: string | null;
  company: string | null;
  location: string | null;
  public_repos: number;
}

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/**
 * Strip GitHub's `[bot]` suffix from a login (e.g. `dependabot[bot]` →
 * `dependabot`). The Users API endpoint returns 404 for the bracketed form.
 */
function normalizeLogin(login: string): string {
  return login.replace(/\[bot\]$/i, "");
}

/**
 * Fetch a single user / organization profile from GitHub.
 *
 * Returns `null` on any 4xx/5xx response or on network error so the caller
 * can render the page even when individual profiles are missing (private
 * users, deleted accounts, rate-limit hiccups). The response is cached via
 * Next's `fetch` for `REVALIDATE_SECONDS` so subsequent renders hit the
 * cache.
 */
export async function fetchUserProfile(
  login: string,
): Promise<UserProfile | null> {
  const safeLogin = normalizeLogin(login);
  if (!safeLogin) return null;
  const url = `${USERS_URL}/${encodeURIComponent(safeLogin)}`;
  try {
    const res = await fetch(url, {
      headers: buildHeaders(),
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as GitHubUserResponse;
    const country = locationToCountry(data.location);
    return {
      login: data.login,
      avatar_url: data.avatar_url,
      html_url: data.html_url,
      type: data.type,
      name: data.name ?? null,
      company: data.company ?? null,
      location: data.location ?? null,
      country,
      public_repos: data.public_repos ?? 0,
    };
  } catch {
    return null;
  }
}

/**
 * Fetch many user profiles in parallel with a bounded concurrency.
 *
 * The returned `Map` is keyed by `login` (case-sensitive — same as the GitHub
 * API). Logins that fail to fetch are simply absent from the map; callers
 * should treat missing entries as "country unknown".
 *
 * Logins are deduplicated case-insensitively before fetching to minimize
 * requests for the common case where the same owner appears in many repos.
 */
export async function fetchUserProfiles(
  logins: string[],
): Promise<Map<string, UserProfile>> {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const login of logins) {
    const key = login.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(login);
  }

  const result = new Map<string, UserProfile>();
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < unique.length) {
      const i = cursor++;
      const login = unique[i];
      const profile = await fetchUserProfile(login);
      if (profile) result.set(profile.login, profile);
    }
  }

  const workers = Array.from(
    { length: Math.min(PROFILE_CONCURRENCY, unique.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return result;
}

/**
 * Index a `UserProfile` map by lowercase login for case-insensitive lookups.
 * GitHub treats logins as case-insensitive on the URL but preserves the
 * original casing in payloads — using a separate index avoids surprises.
 */
export function indexProfilesByLowercaseLogin(
  profiles: Map<string, UserProfile>,
): Map<string, UserProfile> {
  const out = new Map<string, UserProfile>();
  for (const profile of profiles.values()) {
    out.set(profile.login.toLowerCase(), profile);
  }
  return out;
}
