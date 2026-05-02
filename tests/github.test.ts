import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildAiQuery,
  buildNewRepoQuery,
  clampLimit,
  fetchAiRepos,
  fetchNewlyCreatedRepos,
  GITHUB_SEARCH_MAX_RESULTS,
  LIMIT_PRESETS,
} from "../lib/github";

describe("buildAiQuery", () => {
  it("contains the AI keyword disjunction with in:topics,description qualifier", () => {
    const q = buildAiQuery();
    // Keywords appear as plain disjunction inside parens, NOT as topic:X.
    // GitHub Search API rejects (topic:X OR topic:Y) — that form returns 0
    // results / Validation Failed. See lib/github.ts header comment.
    expect(q).toContain("ai OR llm");
    expect(q).toContain("agents");
    expect(q).toContain("rag");
    expect(q).toContain("in:topics,description");
    expect(q).toContain("stars:>=200");
    expect(q).toContain("pushed:>=");
    expect(q).not.toMatch(/topic:[a-z-]+\s+OR\s+topic:/);
  });

  it("uses an ISO date for the pushed filter", () => {
    const q = buildAiQuery(7);
    expect(q).toMatch(/pushed:>=\d{4}-\d{2}-\d{2}/);
  });
});

describe("buildNewRepoQuery", () => {
  it("targets newly *created* repos with a lower star floor", () => {
    const q = buildNewRepoQuery();
    expect(q).toContain("ai OR llm");
    expect(q).toContain("in:topics,description");
    expect(q).toContain("stars:>=20");
    expect(q).toContain("created:>=");
    // Must NOT use pushed: filter (that's the /repos query).
    expect(q).not.toMatch(/pushed:>=/);
  });

  it("uses an ISO date for the created filter", () => {
    const q = buildNewRepoQuery(7);
    expect(q).toMatch(/created:>=\d{4}-\d{2}-\d{2}/);
  });
});

describe("LIMIT_PRESETS", () => {
  it("contains exactly the SPEC F7 values, ascending", () => {
    expect([...LIMIT_PRESETS]).toEqual([50, 100, 200, 500, 1000]);
  });

  it("max preset equals GITHUB_SEARCH_MAX_RESULTS", () => {
    expect(Math.max(...LIMIT_PRESETS)).toBe(GITHUB_SEARCH_MAX_RESULTS);
  });

  it("guardrail: every page's DEFAULT_LIMIT must appear in LIMIT_PRESETS", async () => {
    // Regression test for the Devin Review finding on PR #9: /new had
    // DEFAULT_LIMIT=30 but LIMIT_PRESETS = [50,100,200,500,1000], causing
    // the <select> to visually default to 50 while the server fetched 30.
    // We grep the literal page source rather than importing the modules,
    // because Next.js page modules carry server-only RSC semantics that
    // can't be evaluated by vitest.
    const fs = await import("node:fs");
    const path = await import("node:path");
    const root = path.resolve(__dirname, "..");
    const files = ["app/page.tsx", "app/new/page.tsx", "app/stats/page.tsx"];
    for (const f of files) {
      const src = fs.readFileSync(path.join(root, f), "utf8");
      const m = src.match(/DEFAULT_LIMIT\s*=\s*(\d+)/);
      expect(m, `${f} missing DEFAULT_LIMIT`).not.toBeNull();
      const n = Number(m![1]);
      expect(LIMIT_PRESETS, `${f} DEFAULT_LIMIT=${n} not in LIMIT_PRESETS`).toContain(n);
    }
  });
});

describe("clampLimit", () => {
  it("returns the default for undefined / NaN / non-positive input", () => {
    expect(clampLimit(undefined, 50)).toBe(50);
    expect(clampLimit(Number.NaN, 50)).toBe(50);
    expect(clampLimit(0, 50)).toBe(50);
    expect(clampLimit(-5, 50)).toBe(50);
  });

  it("caps at GITHUB_SEARCH_MAX_RESULTS", () => {
    expect(clampLimit(99999)).toBe(GITHUB_SEARCH_MAX_RESULTS);
    expect(GITHUB_SEARCH_MAX_RESULTS).toBe(1000);
  });

  it("floors fractional inputs to integers", () => {
    expect(clampLimit(50.7)).toBe(50);
    expect(clampLimit(99.99)).toBe(99);
  });

  it("preserves valid integer inputs", () => {
    expect(clampLimit(50)).toBe(50);
    expect(clampLimit(200)).toBe(200);
    expect(clampLimit(1000)).toBe(1000);
  });
});

describe("fetchAiRepos", () => {
  const originalFetch = globalThis.fetch;
  const originalToken = process.env.GITHUB_TOKEN;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalToken === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = originalToken;
  });

  function mockSearchPage(items: object[]) {
    return { ok: true, json: async () => ({ items }) };
  }

  function fakeRepo(i: number) {
    return {
      id: i,
      full_name: `x/y${i}`,
      html_url: `https://x/${i}`,
      description: null,
      stargazers_count: 10,
      forks_count: 1,
      pushed_at: "2025-05-01T00:00:00Z",
      created_at: "2024-01-01T00:00:00Z",
      topics: [],
      language: null,
      owner: { login: "x", avatar_url: "" },
    };
  }

  it("returns items from the search endpoint", async () => {
    const fakeFetch = vi.fn().mockResolvedValue(mockSearchPage([fakeRepo(1)]));
    (globalThis as unknown as { fetch: typeof fetch }).fetch = fakeFetch as unknown as typeof fetch;

    const repos = await fetchAiRepos(5);
    expect(repos).toHaveLength(1);
    expect(repos[0].full_name).toBe("x/y1");
    const [, init] = fakeFetch.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Accept).toBe("application/vnd.github+json");
  });

  it("adds Authorization header when GITHUB_TOKEN is set", async () => {
    process.env.GITHUB_TOKEN = "secret-token";
    const fakeFetch = vi.fn().mockResolvedValue(mockSearchPage([]));
    (globalThis as unknown as { fetch: typeof fetch }).fetch = fakeFetch as unknown as typeof fetch;
    await fetchAiRepos(1);
    const [, init] = fakeFetch.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer secret-token");
  });

  it("throws on non-OK upstream", async () => {
    const fakeFetch = vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({}) });
    (globalThis as unknown as { fetch: typeof fetch }).fetch = fakeFetch as unknown as typeof fetch;
    await expect(fetchAiRepos(1)).rejects.toThrow(/GitHub API failed: 403/);
  });

  it("paginates when limit > 100 and stops when API returns fewer than per_page", async () => {
    // Arrange: page 1 returns 100 items, page 2 returns 50 items (short → stop).
    const page1 = Array.from({ length: 100 }, (_, i) => fakeRepo(i + 1));
    const page2 = Array.from({ length: 50 }, (_, i) => fakeRepo(i + 101));
    const fakeFetch = vi
      .fn()
      .mockResolvedValueOnce(mockSearchPage(page1))
      .mockResolvedValueOnce(mockSearchPage(page2));
    (globalThis as unknown as { fetch: typeof fetch }).fetch = fakeFetch as unknown as typeof fetch;

    const repos = await fetchAiRepos(200);

    expect(fakeFetch).toHaveBeenCalledTimes(2);
    expect(repos).toHaveLength(150);
    // Confirm page 1 url has page=1, page 2 has page=2.
    const url1 = (fakeFetch.mock.calls[0] as [string])[0];
    const url2 = (fakeFetch.mock.calls[1] as [string])[0];
    expect(url1).toContain("page=1");
    expect(url2).toContain("page=2");
    // Per page should be 100 on the first call (limit=200, max 100/page).
    expect(url1).toContain("per_page=100");
  });

  it("clamps limit to GITHUB_SEARCH_MAX_RESULTS (1000)", async () => {
    // Arrange: each page returns exactly 100 items so loop runs full 10 pages.
    const fullPage = Array.from({ length: 100 }, (_, i) => fakeRepo(i));
    const fakeFetch = vi.fn().mockResolvedValue(mockSearchPage(fullPage));
    (globalThis as unknown as { fetch: typeof fetch }).fetch = fakeFetch as unknown as typeof fetch;

    const repos = await fetchAiRepos(99999);

    // Should be exactly 10 pages of 100 each = 1000.
    expect(repos).toHaveLength(GITHUB_SEARCH_MAX_RESULTS);
    expect(fakeFetch).toHaveBeenCalledTimes(10);
  });
});

describe("fetchNewlyCreatedRepos", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("uses the buildNewRepoQuery and includes 'created:>=' in the URL", async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [] }),
    });
    (globalThis as unknown as { fetch: typeof fetch }).fetch = fakeFetch as unknown as typeof fetch;
    await fetchNewlyCreatedRepos(5, 30);
    const [url] = fakeFetch.mock.calls[0] as [string];
    expect(decodeURIComponent(url)).toContain("created:>=");
    expect(decodeURIComponent(url)).not.toContain("pushed:>=");
  });
});
