import { describe, expect, it } from "vitest";
import {
  aggregateByContributor,
  aggregateByOwner,
  parseDevSortKey,
  scoreDev,
  selectBots,
  selectDevs,
  sortDevs,
} from "../lib/devs";
import type { Contributor } from "../lib/contributors";
import type { Repo, UserProfile } from "../lib/types";

function makeRepo(partial: {
  id: number;
  full_name: string;
  owner: { login: string; avatar_url?: string };
  stargazers_count?: number;
  forks_count?: number;
  pushed_at?: string;
  created_at?: string;
  description?: string | null;
  topics?: string[];
  language?: string | null;
  html_url?: string;
}): Repo {
  return {
    id: partial.id,
    full_name: partial.full_name,
    html_url: partial.html_url ?? `https://github.com/${partial.full_name}`,
    description: partial.description ?? null,
    stargazers_count: partial.stargazers_count ?? 0,
    forks_count: partial.forks_count ?? 0,
    pushed_at: partial.pushed_at ?? "2026-04-01T00:00:00Z",
    created_at: partial.created_at ?? "2024-01-01T00:00:00Z",
    topics: partial.topics ?? [],
    language: partial.language ?? null,
    owner: {
      login: partial.owner.login,
      avatar_url:
        partial.owner.avatar_url ??
        `https://avatars.githubusercontent.com/u/${partial.id}`,
    },
  };
}

function profile(login: string, overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    login,
    avatar_url: `https://avatars.githubusercontent.com/u/${login}`,
    html_url: `https://github.com/${login}`,
    type: "User",
    name: null,
    company: null,
    location: null,
    country: null,
    public_repos: 0,
    ...overrides,
  };
}

describe("scoreDev", () => {
  it("is monotonic in stars", () => {
    const a = scoreDev({ total_stars: 100, total_forks: 0, repos_count: 1 });
    const b = scoreDev({ total_stars: 1000, total_forks: 0, repos_count: 1 });
    expect(b).toBeGreaterThan(a);
  });

  it("is monotonic in forks", () => {
    const a = scoreDev({ total_stars: 1000, total_forks: 0, repos_count: 1 });
    const b = scoreDev({ total_stars: 1000, total_forks: 1000, repos_count: 1 });
    expect(b).toBeGreaterThan(a);
  });

  it("is monotonic in repos_count", () => {
    const a = scoreDev({ total_stars: 1000, total_forks: 100, repos_count: 1 });
    const b = scoreDev({ total_stars: 1000, total_forks: 100, repos_count: 5 });
    expect(b).toBeGreaterThan(a);
  });

  it("returns 0 for an all-zero input", () => {
    expect(scoreDev({ total_stars: 0, total_forks: 0, repos_count: 0 })).toBe(0);
  });
});

describe("aggregateByOwner", () => {
  it("buckets repos by owner login (case-insensitive)", () => {
    const rows = aggregateByOwner(
      [
        makeRepo({ id: 1, full_name: "openai/whisper", owner: { login: "openai" }, stargazers_count: 70_000, forks_count: 8000 }),
        makeRepo({ id: 2, full_name: "openai/cookbook", owner: { login: "OpenAI" }, stargazers_count: 60_000, forks_count: 9000 }),
        makeRepo({ id: 3, full_name: "ollama/ollama", owner: { login: "ollama" }, stargazers_count: 90_000, forks_count: 7000 }),
      ],
      new Map(),
    );
    expect(rows).toHaveLength(2);
    const openai = rows.find((r) => r.login.toLowerCase() === "openai")!;
    expect(openai.repos_count).toBe(2);
    expect(openai.total_stars).toBe(130_000);
    expect(openai.total_forks).toBe(17_000);
    expect(openai.top_repo).toBe("openai/whisper");
    expect(openai.top_repo_stars).toBe(70_000);
  });

  it("uses profile data when available (login casing, html_url, type, country)", () => {
    const profiles = new Map<string, UserProfile>([
      [
        "ollama",
        profile("ollama", {
          type: "Organization",
          name: "Ollama",
          country: "US",
          html_url: "https://github.com/ollama",
        }),
      ],
    ]);
    const rows = aggregateByOwner(
      [makeRepo({ id: 3, full_name: "ollama/ollama", owner: { login: "ollama" }, stargazers_count: 90_000 })],
      profiles,
    );
    expect(rows[0].login).toBe("ollama");
    expect(rows[0].type).toBe("Organization");
    expect(rows[0].country).toBe("US");
    expect(rows[0].name).toBe("Ollama");
  });

  it("falls back to login + repo avatar when profile is missing", () => {
    const rows = aggregateByOwner(
      [makeRepo({ id: 4, full_name: "comfyanonymous/ComfyUI", owner: { login: "comfyanonymous" }, stargazers_count: 55_000 })],
      new Map(),
    );
    expect(rows[0].login).toBe("comfyanonymous");
    expect(rows[0].country).toBeNull();
    expect(rows[0].type).toBe("User");
    expect(rows[0].html_url).toBe("https://github.com/comfyanonymous");
  });

  it("computes a score for each row", () => {
    const rows = aggregateByOwner(
      [makeRepo({ id: 1, full_name: "a/x", owner: { login: "a" }, stargazers_count: 1024, forks_count: 16 })],
      new Map(),
    );
    expect(rows[0].score).toBeGreaterThan(0);
  });

  it("returns an empty list for empty input", () => {
    expect(aggregateByOwner([], new Map())).toEqual([]);
  });
});

describe("sortDevs", () => {
  const sample = [
    { login: "alpha", total_stars: 100, total_forks: 50, repos_count: 1, score: 1 },
    { login: "beta", total_stars: 1000, total_forks: 10, repos_count: 5, score: 9 },
    { login: "gamma", total_stars: 500, total_forks: 80, repos_count: 2, score: 5 },
  ];

  function asAggs(arr: typeof sample) {
    return arr.map((a) => ({
      ...a,
      avatar_url: "",
      html_url: "",
      type: "User" as const,
      name: null,
      country: null,
      total_contributions: 0,
      top_repo: "",
      top_repo_stars: 0,
    }));
  }

  it("sorts by score desc by default", () => {
    const out = sortDevs(asAggs(sample), "score", "desc");
    expect(out.map((r) => r.login)).toEqual(["beta", "gamma", "alpha"]);
  });

  it("sorts by stars asc", () => {
    const out = sortDevs(asAggs(sample), "stars", "asc");
    expect(out.map((r) => r.login)).toEqual(["alpha", "gamma", "beta"]);
  });

  it("sorts by forks desc", () => {
    const out = sortDevs(asAggs(sample), "forks", "desc");
    expect(out.map((r) => r.login)).toEqual(["gamma", "alpha", "beta"]);
  });

  it("sorts by repos desc", () => {
    const out = sortDevs(asAggs(sample), "repos", "desc");
    expect(out.map((r) => r.login)).toEqual(["beta", "gamma", "alpha"]);
  });

  it("breaks ties by login alphabetic", () => {
    const tied = asAggs([
      { login: "z", total_stars: 100, total_forks: 0, repos_count: 1, score: 1 },
      { login: "a", total_stars: 100, total_forks: 0, repos_count: 1, score: 1 },
    ]);
    const out = sortDevs(tied, "score", "desc");
    expect(out.map((r) => r.login)).toEqual(["a", "z"]);
  });

  it("returns a new array (does not mutate input)", () => {
    const input = asAggs(sample);
    const before = input.map((r) => r.login).join(",");
    sortDevs(input, "stars", "desc");
    expect(input.map((r) => r.login).join(",")).toBe(before);
  });
});

describe("selectDevs / selectBots", () => {
  function fakeRows() {
    return [
      { login: "ollama", type: "User" as const },
      { login: "dependabot[bot]", type: "User" as const },
      { login: "tensorflower-gardener", type: "User" as const },
    ].map((row) => ({
      login: row.login,
      avatar_url: "",
      html_url: "",
      type: row.type,
      name: null,
      country: null,
      repos_count: 1,
      total_stars: 0,
      total_forks: 0,
      total_contributions: 0,
      top_repo: "",
      top_repo_stars: 0,
      score: 0,
    }));
  }

  it("partitions the rows into devs and bots", () => {
    const profiles = new Map<string, UserProfile>([
      ["dependabot", profile("dependabot[bot]", { type: "Bot" })],
    ]);
    const rows = fakeRows();
    const devs = selectDevs(rows, profiles);
    const bots = selectBots(rows, profiles);
    expect(devs.map((d) => d.login).sort()).toEqual(["ollama"]);
    expect(bots.map((d) => d.login).sort()).toEqual([
      "dependabot[bot]",
      "tensorflower-gardener",
    ]);
  });
});

describe("parseDevSortKey", () => {
  it("returns the parsed key when valid", () => {
    expect(parseDevSortKey("score")).toBe("score");
    expect(parseDevSortKey("stars")).toBe("stars");
    expect(parseDevSortKey("forks")).toBe("forks");
    expect(parseDevSortKey("repos")).toBe("repos");
    expect(parseDevSortKey("contributions")).toBe("contributions");
  });

  it("falls back to score for invalid / missing", () => {
    expect(parseDevSortKey(null)).toBe("score");
    expect(parseDevSortKey(undefined)).toBe("score");
    expect(parseDevSortKey("garbage")).toBe("score");
  });

  it("respects a custom fallback", () => {
    expect(parseDevSortKey(null, "stars")).toBe("stars");
    expect(parseDevSortKey("garbage", "repos")).toBe("repos");
    expect(parseDevSortKey(null, "contributions")).toBe("contributions");
  });
});

function makeContributor(
  partial: Partial<Contributor> & { login: string; source_repo: string },
): Contributor {
  return {
    login: partial.login,
    avatar_url: partial.avatar_url ?? `https://avatars.githubusercontent.com/${partial.login}`,
    html_url: partial.html_url ?? `https://github.com/${partial.login.replace(/\[bot\]$/, "")}`,
    contributions: partial.contributions ?? 1,
    source_repo: partial.source_repo,
    source_repo_stars: partial.source_repo_stars ?? 0,
    source_repo_forks: partial.source_repo_forks ?? 0,
  };
}

describe("aggregateByContributor", () => {
  it("buckets contributors by login (case-insensitive) and sums contributions/stars/forks", () => {
    const rows = aggregateByContributor(
      [
        makeContributor({
          login: "dependabot[bot]",
          source_repo: "openai/whisper",
          contributions: 50,
          source_repo_stars: 70_000,
          source_repo_forks: 8000,
        }),
        makeContributor({
          login: "Dependabot[bot]",
          source_repo: "openai/cookbook",
          contributions: 30,
          source_repo_stars: 60_000,
          source_repo_forks: 9000,
        }),
        makeContributor({
          login: "alice",
          source_repo: "openai/whisper",
          contributions: 200,
          source_repo_stars: 70_000,
          source_repo_forks: 8000,
        }),
      ],
      new Map(),
    );

    expect(rows).toHaveLength(2);
    const bot = rows.find((r) => r.login.toLowerCase() === "dependabot[bot]")!;
    expect(bot.repos_count).toBe(2);
    expect(bot.total_contributions).toBe(80);
    expect(bot.total_stars).toBe(130_000);
    expect(bot.total_forks).toBe(17_000);
    expect(bot.top_repo).toBe("openai/whisper");
    expect(bot.top_repo_stars).toBe(70_000);
  });

  it("populates type/name from the profile even when the profile is keyed by the suffix-stripped login (real GitHub Users API behavior)", () => {
    // `fetchUserProfiles` strips the `[bot]` suffix before calling the GitHub
    // Users API (the bracketed form 404s), and stores the resulting profile
    // keyed by the API-returned login (e.g. `dependabot`, NOT `dependabot[bot]`).
    // The contributor row, however, retains the full `dependabot[bot]` login.
    // `aggregateByContributor` must reconcile these two forms.
    const profiles = new Map<string, UserProfile>([
      [
        "dependabot", // <-- API-returned login (stripped)
        {
          login: "dependabot",
          avatar_url: "",
          html_url: "https://github.com/apps/dependabot",
          type: "Bot",
          name: "Dependabot",
          company: null,
          location: "Germany",
          country: "DE",
          public_repos: 0,
        },
      ],
    ]);
    const rows = aggregateByContributor(
      [
        makeContributor({
          login: "dependabot[bot]", // <-- contributor login (full, with suffix)
          source_repo: "openai/whisper",
          contributions: 50,
        }),
      ],
      profiles,
    );
    expect(rows[0].type).toBe("Bot");
    expect(rows[0].name).toBe("Dependabot");
    expect(rows[0].country).toBe("DE");
    // Even with the profile found and `profile.login === 'dependabot'`, the
    // rendered `row.login` must keep the original `[bot]` suffix.
    expect(rows[0].login).toBe("dependabot[bot]");
  });

  it("preserves the full `[bot]` suffix on the rendered login when the profile IS found", () => {
    // Adversarial: this is the case Devin Review flagged on PR #19. The profile
    // for `dependabot` exists (GitHub returns it as `login: 'dependabot'` after
    // suffix stripping), but the contributor row's `login` was `dependabot[bot]`.
    // The previous code `login: profile?.login ?? login` would silently drop the
    // suffix when the profile was found, contradicting the explicit invariant.
    const profiles = new Map<string, UserProfile>([
      [
        "dependabot",
        {
          login: "dependabot",
          avatar_url: "https://github.com/apps/dependabot.png",
          html_url: "https://github.com/apps/dependabot",
          type: "Bot",
          name: "Dependabot",
          company: null,
          location: "United States of America",
          country: "US",
          public_repos: 0,
        },
      ],
    ]);
    const rows = aggregateByContributor(
      [
        makeContributor({
          login: "dependabot[bot]",
          source_repo: "openai/whisper",
          contributions: 50,
        }),
      ],
      profiles,
    );
    expect(rows[0].login).toBe("dependabot[bot]");
    // Profile-derived fields still reach the row.
    expect(rows[0].country).toBe("US");
    expect(rows[0].type).toBe("Bot");
  });

  it("preserves the full `[bot]` suffix on the rendered login when the profile is MISSING (fallback path)", () => {
    // Most `[bot]` accounts (e.g. `github-actions`, `renovate`) 404 on the
    // Users API even after stripping, so the profile is missing. The original
    // login must still flow through to the rendered row.
    const rows = aggregateByContributor(
      [
        makeContributor({
          login: "dependabot[bot]",
          source_repo: "openai/whisper",
          contributions: 50,
        }),
      ],
      new Map(),
    );
    expect(rows[0].login).toBe("dependabot[bot]");
  });

  it("falls back to contributor metadata when profile is missing", () => {
    const rows = aggregateByContributor(
      [
        makeContributor({
          login: "github-actions[bot]",
          source_repo: "x/y",
          avatar_url: "https://example.com/gh-actions.png",
          html_url: "https://github.com/apps/github-actions",
        }),
      ],
      new Map(),
    );
    expect(rows[0].avatar_url).toBe("https://example.com/gh-actions.png");
    expect(rows[0].html_url).toBe("https://github.com/apps/github-actions");
    expect(rows[0].type).toBe("User");
    expect(rows[0].country).toBeNull();
  });

  it("computes a score for each row", () => {
    const rows = aggregateByContributor(
      [
        makeContributor({
          login: "x",
          source_repo: "a/b",
          contributions: 10,
          source_repo_stars: 1024,
          source_repo_forks: 16,
        }),
      ],
      new Map(),
    );
    expect(rows[0].score).toBeGreaterThan(0);
  });

  it("returns an empty list for empty input", () => {
    expect(aggregateByContributor([], new Map())).toEqual([]);
  });

  it("tracks top_repo as the source_repo with the highest stars seen", () => {
    const rows = aggregateByContributor(
      [
        makeContributor({
          login: "alice",
          source_repo: "x/small",
          source_repo_stars: 100,
        }),
        makeContributor({
          login: "alice",
          source_repo: "x/big",
          source_repo_stars: 50_000,
        }),
        makeContributor({
          login: "alice",
          source_repo: "x/medium",
          source_repo_stars: 5_000,
        }),
      ],
      new Map(),
    );
    expect(rows[0].top_repo).toBe("x/big");
    expect(rows[0].top_repo_stars).toBe(50_000);
  });
});
