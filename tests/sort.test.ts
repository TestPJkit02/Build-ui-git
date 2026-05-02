import { describe, expect, it } from "vitest";
import { parseSortDir, parseSortKey, sortRepos } from "../lib/sort";
import type { RankedRepo } from "../lib/types";

const base: RankedRepo = {
  id: 0,
  full_name: "owner/repo",
  html_url: "https://example.com",
  description: null,
  stargazers_count: 0,
  forks_count: 0,
  pushed_at: "2025-01-01T00:00:00Z",
  created_at: "2024-01-01T00:00:00Z",
  topics: [],
  language: null,
  owner: { login: "owner", avatar_url: "" },
  category: "Other",
  score: 0,
  trend_score: 0,
};

describe("parseSortKey", () => {
  it("returns valid keys unchanged", () => {
    expect(parseSortKey("stars", "score")).toBe("stars");
    expect(parseSortKey("forks", "score")).toBe("forks");
    expect(parseSortKey("trend_score", "score")).toBe("trend_score");
    expect(parseSortKey("updated", "score")).toBe("updated");
    expect(parseSortKey("created", "score")).toBe("created");
  });

  it("falls back for unknown / null input", () => {
    expect(parseSortKey(null, "score")).toBe("score");
    expect(parseSortKey(undefined, "score")).toBe("score");
    expect(parseSortKey("malicious; DROP TABLE", "score")).toBe("score");
    expect(parseSortKey("", "score")).toBe("score");
  });
});

describe("parseSortDir", () => {
  it("returns asc only on exact 'asc'", () => {
    expect(parseSortDir("asc")).toBe("asc");
  });

  it("falls back to desc otherwise", () => {
    expect(parseSortDir("desc")).toBe("desc");
    expect(parseSortDir("")).toBe("desc");
    expect(parseSortDir(null)).toBe("desc");
    expect(parseSortDir("random")).toBe("desc");
  });
});

describe("sortRepos", () => {
  function r(name: string, overrides: Partial<RankedRepo>): RankedRepo {
    return { ...base, full_name: name, ...overrides };
  }

  it("sorts by stars desc by default", () => {
    const repos = [
      r("a/low", { stargazers_count: 10 }),
      r("b/high", { stargazers_count: 1000 }),
      r("c/mid", { stargazers_count: 100 }),
    ];
    const sorted = sortRepos(repos, "stars", "desc");
    expect(sorted.map((x) => x.full_name)).toEqual(["b/high", "c/mid", "a/low"]);
  });

  it("sorts by stars asc when dir=asc", () => {
    const repos = [
      r("a/high", { stargazers_count: 1000 }),
      r("b/low", { stargazers_count: 10 }),
    ];
    expect(sortRepos(repos, "stars", "asc").map((x) => x.full_name)).toEqual([
      "b/low",
      "a/high",
    ]);
  });

  it("sorts by forks", () => {
    const repos = [
      r("a/lowfork", { forks_count: 1 }),
      r("b/highfork", { forks_count: 999 }),
    ];
    expect(sortRepos(repos, "forks", "desc")[0].full_name).toBe("b/highfork");
  });

  it("sorts by score", () => {
    const repos = [r("a", { score: 1 }), r("b", { score: 5 })];
    expect(sortRepos(repos, "score", "desc")[0].full_name).toBe("b");
  });

  it("sorts by trend_score, treating undefined as 0", () => {
    const repos = [
      r("a/none", { trend_score: undefined }),
      r("b/high", { trend_score: 100 }),
      r("c/low", { trend_score: 1 }),
    ];
    const sorted = sortRepos(repos, "trend_score", "desc");
    expect(sorted.map((x) => x.full_name)).toEqual(["b/high", "c/low", "a/none"]);
  });

  it("sorts by updated (pushed_at) timestamp", () => {
    const repos = [
      r("a/old", { pushed_at: "2020-01-01T00:00:00Z" }),
      r("b/new", { pushed_at: "2026-04-01T00:00:00Z" }),
    ];
    expect(sortRepos(repos, "updated", "desc")[0].full_name).toBe("b/new");
  });

  it("sorts by created (created_at) timestamp", () => {
    const repos = [
      r("a/old", { created_at: "2018-01-01T00:00:00Z" }),
      r("b/new", { created_at: "2026-04-01T00:00:00Z" }),
    ];
    expect(sortRepos(repos, "created", "desc")[0].full_name).toBe("b/new");
  });

  it("breaks ties by full_name asc (stable / deterministic)", () => {
    const repos = [
      r("z/tie", { stargazers_count: 100 }),
      r("a/tie", { stargazers_count: 100 }),
    ];
    expect(sortRepos(repos, "stars", "desc")[0].full_name).toBe("a/tie");
  });

  it("does not mutate input", () => {
    const repos = [r("a", { stargazers_count: 1 }), r("b", { stargazers_count: 2 })];
    const before = repos.map((x) => x.full_name);
    sortRepos(repos, "stars", "desc");
    expect(repos.map((x) => x.full_name)).toEqual(before);
  });

  it("treats invalid timestamps as epoch 0", () => {
    const repos = [
      r("a/bad", { pushed_at: "not-a-date" }),
      r("b/ok", { pushed_at: "2026-04-01T00:00:00Z" }),
    ];
    expect(sortRepos(repos, "updated", "desc")[0].full_name).toBe("b/ok");
  });
});
