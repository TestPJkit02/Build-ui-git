import { describe, expect, it } from "vitest";
import { rankRepos, recencyFactor, repoScore } from "../lib/rank";
import type { Repo } from "../lib/types";

const baseRepo: Repo = {
  id: 1,
  full_name: "owner/repo",
  html_url: "https://example.com",
  description: null,
  stargazers_count: 0,
  forks_count: 0,
  pushed_at: new Date().toISOString(),
  created_at: "2024-01-01T00:00:00Z",
  topics: [],
  language: null,
  owner: { login: "owner", avatar_url: "" },
};

const NOW = new Date("2025-05-01T00:00:00Z");

describe("recencyFactor", () => {
  it("returns 1 for repos pushed today", () => {
    expect(recencyFactor(NOW.toISOString(), NOW)).toBe(1);
  });

  it("returns 1 for repos pushed within the fresh window (7d)", () => {
    const six = new Date(NOW.getTime() - 6 * 86400 * 1000).toISOString();
    expect(recencyFactor(six, NOW)).toBe(1);
  });

  it("returns 0 for repos older than the stale window (90d)", () => {
    const old = new Date(NOW.getTime() - 200 * 86400 * 1000).toISOString();
    expect(recencyFactor(old, NOW)).toBe(0);
  });

  it("decays linearly between fresh and stale", () => {
    // halfway between 7 and 90 days ~ 48.5d ago -> ~ 0.5
    const mid = new Date(NOW.getTime() - 48.5 * 86400 * 1000).toISOString();
    const v = recencyFactor(mid, NOW);
    expect(v).toBeGreaterThan(0.45);
    expect(v).toBeLessThan(0.55);
  });

  it("returns 0 for invalid date strings", () => {
    expect(recencyFactor("not-a-date", NOW)).toBe(0);
  });
});

describe("repoScore", () => {
  it("treats negative counts as zero", () => {
    const score = repoScore(
      { stargazers_count: -10, forks_count: -5, pushed_at: NOW.toISOString() },
      NOW,
    );
    // negatives -> 0 stars/forks, full recency -> 0.2
    expect(score).toBeCloseTo(0.2, 5);
  });

  it("monotonically increases with stars", () => {
    const a = repoScore({ stargazers_count: 100, forks_count: 0, pushed_at: NOW.toISOString() }, NOW);
    const b = repoScore({ stargazers_count: 1000, forks_count: 0, pushed_at: NOW.toISOString() }, NOW);
    expect(b).toBeGreaterThan(a);
  });

  it("ranks fresher repo above stale even with same stars", () => {
    const fresh = repoScore({ stargazers_count: 1000, forks_count: 100, pushed_at: NOW.toISOString() }, NOW);
    const staleDate = new Date(NOW.getTime() - 200 * 86400 * 1000).toISOString();
    const stale = repoScore({ stargazers_count: 1000, forks_count: 100, pushed_at: staleDate }, NOW);
    expect(fresh).toBeGreaterThan(stale);
  });
});

describe("rankRepos", () => {
  it("sorts descending by score and attaches the score field", () => {
    const repos: Repo[] = [
      { ...baseRepo, id: 1, full_name: "a/low", stargazers_count: 10, forks_count: 1, pushed_at: NOW.toISOString() },
      { ...baseRepo, id: 2, full_name: "b/high", stargazers_count: 10000, forks_count: 1000, pushed_at: NOW.toISOString() },
      { ...baseRepo, id: 3, full_name: "c/mid", stargazers_count: 500, forks_count: 50, pushed_at: NOW.toISOString() },
    ];
    const ranked = rankRepos(repos, NOW);
    expect(ranked[0].full_name).toBe("b/high");
    expect(ranked[1].full_name).toBe("c/mid");
    expect(ranked[2].full_name).toBe("a/low");
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });

  it("breaks ties by stars then full_name", () => {
    const repos: Repo[] = [
      { ...baseRepo, id: 1, full_name: "z/same", stargazers_count: 100, forks_count: 10, pushed_at: NOW.toISOString() },
      { ...baseRepo, id: 2, full_name: "a/same", stargazers_count: 100, forks_count: 10, pushed_at: NOW.toISOString() },
    ];
    const ranked = rankRepos(repos, NOW);
    expect(ranked[0].full_name).toBe("a/same");
  });

  it("does not mutate input array", () => {
    const repos: Repo[] = [
      { ...baseRepo, id: 1, full_name: "a/x", stargazers_count: 10, forks_count: 0, pushed_at: NOW.toISOString() },
      { ...baseRepo, id: 2, full_name: "b/y", stargazers_count: 100, forks_count: 0, pushed_at: NOW.toISOString() },
    ];
    const before = repos.map((r) => r.full_name);
    rankRepos(repos, NOW);
    expect(repos.map((r) => r.full_name)).toEqual(before);
  });
});
