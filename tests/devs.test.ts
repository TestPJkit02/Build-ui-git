import { describe, expect, it } from "vitest";
import {
  aggregateByOwner,
  parseDevSortKey,
  scoreDev,
  selectBots,
  selectDevs,
  sortDevs,
} from "../lib/devs";
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
  });

  it("falls back to score for invalid / missing", () => {
    expect(parseDevSortKey(null)).toBe("score");
    expect(parseDevSortKey(undefined)).toBe("score");
    expect(parseDevSortKey("garbage")).toBe("score");
  });

  it("respects a custom fallback", () => {
    expect(parseDevSortKey(null, "stars")).toBe("stars");
    expect(parseDevSortKey("garbage", "repos")).toBe("repos");
  });
});
