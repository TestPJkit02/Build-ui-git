import { describe, expect, it } from "vitest";
import { filterRepos, parseCategoryList, parseMinStars } from "../lib/filter";
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
};

describe("parseCategoryList", () => {
  it("parses comma-separated valid categories", () => {
    expect(parseCategoryList("LLM,Agents")).toEqual(["LLM", "Agents"]);
  });

  it("trims whitespace and dedupes", () => {
    expect(parseCategoryList(" LLM , Agents , LLM ")).toEqual(["LLM", "Agents"]);
  });

  it("drops unknown tokens silently", () => {
    expect(parseCategoryList("LLM,Foo,Agents,Bar")).toEqual(["LLM", "Agents"]);
  });

  it("returns [] for empty / null / undefined", () => {
    expect(parseCategoryList(null)).toEqual([]);
    expect(parseCategoryList(undefined)).toEqual([]);
    expect(parseCategoryList("")).toEqual([]);
  });
});

describe("parseMinStars", () => {
  it("parses non-negative integers", () => {
    expect(parseMinStars("100")).toBe(100);
    expect(parseMinStars("0")).toBe(0);
  });

  it("returns 0 for invalid / negative input", () => {
    expect(parseMinStars(null)).toBe(0);
    expect(parseMinStars(undefined)).toBe(0);
    expect(parseMinStars("")).toBe(0);
    expect(parseMinStars("not-a-number")).toBe(0);
    expect(parseMinStars("-50")).toBe(0);
  });

  it("floors via parseInt for fractional", () => {
    expect(parseMinStars("100.7")).toBe(100);
  });
});

describe("filterRepos", () => {
  function r(name: string, overrides: Partial<RankedRepo>): RankedRepo {
    return { ...base, full_name: name, ...overrides };
  }

  const repos: RankedRepo[] = [
    r("ai/llm-app", { category: "LLM", stargazers_count: 5000, description: "an LLM app" }),
    r("vision/yolo-X", { category: "Vision", stargazers_count: 50, description: "object detection" }),
    r("rag/embeddings", { category: "RAG", stargazers_count: 200, description: null }),
    r("agents/autogpt", { category: "Agents", stargazers_count: 10000, description: "agentic AI" }),
  ];

  it("passes through when filter is empty", () => {
    const out = filterRepos(repos, { categories: [], minStars: 0, query: "" });
    expect(out).toHaveLength(4);
  });

  it("filters by category set", () => {
    const out = filterRepos(repos, { categories: ["LLM", "Agents"], minStars: 0, query: "" });
    expect(out.map((r) => r.full_name).sort()).toEqual(["agents/autogpt", "ai/llm-app"]);
  });

  it("filters by minStars threshold", () => {
    const out = filterRepos(repos, { categories: [], minStars: 1000, query: "" });
    expect(out.map((r) => r.full_name).sort()).toEqual(["agents/autogpt", "ai/llm-app"]);
  });

  it("filters by case-insensitive text on full_name", () => {
    const out = filterRepos(repos, { categories: [], minStars: 0, query: "YOLO" });
    expect(out.map((r) => r.full_name)).toEqual(["vision/yolo-X"]);
  });

  it("filters by case-insensitive text on description", () => {
    const out = filterRepos(repos, { categories: [], minStars: 0, query: "agentic" });
    expect(out.map((r) => r.full_name)).toEqual(["agents/autogpt"]);
  });

  it("treats null description as empty string when matching", () => {
    const out = filterRepos(repos, { categories: [], minStars: 0, query: "embeddings" });
    expect(out.map((r) => r.full_name)).toEqual(["rag/embeddings"]);
  });

  it("composes filters with AND semantics", () => {
    const out = filterRepos(repos, {
      categories: ["LLM", "Agents"],
      minStars: 8000,
      query: "",
    });
    expect(out.map((r) => r.full_name)).toEqual(["agents/autogpt"]);
  });

  it("ignores leading/trailing whitespace in query", () => {
    const out = filterRepos(repos, { categories: [], minStars: 0, query: "  YOLO  " });
    expect(out).toHaveLength(1);
  });

  it("does not mutate input", () => {
    const before = repos.map((r) => r.full_name);
    filterRepos(repos, { categories: ["LLM"], minStars: 0, query: "" });
    expect(repos.map((r) => r.full_name)).toEqual(before);
  });
});
