import { afterEach, describe, expect, it, vi } from "vitest";
import { buildAiQuery, fetchAiRepos } from "../lib/github";

describe("buildAiQuery", () => {
  it("contains the AI topic disjunction", () => {
    const q = buildAiQuery();
    expect(q).toContain("topic:ai");
    expect(q).toContain("topic:llm");
    expect(q).toContain("topic:agents");
    expect(q).toContain("stars:>=200");
  });

  it("uses an ISO date for the pushed filter", () => {
    const q = buildAiQuery(7);
    expect(q).toMatch(/pushed:>=\d{4}-\d{2}-\d{2}/);
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

  it("returns items from the search endpoint", async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            id: 1,
            full_name: "x/y",
            html_url: "https://x",
            description: null,
            stargazers_count: 10,
            forks_count: 1,
            pushed_at: "2025-05-01T00:00:00Z",
            created_at: "2024-01-01T00:00:00Z",
            topics: [],
            language: null,
            owner: { login: "x", avatar_url: "" },
          },
        ],
      }),
    });
    (globalThis as unknown as { fetch: typeof fetch }).fetch = fakeFetch as unknown as typeof fetch;

    const repos = await fetchAiRepos(5);
    expect(repos).toHaveLength(1);
    expect(repos[0].full_name).toBe("x/y");
    // verify we sent expected headers
    const [, init] = fakeFetch.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Accept).toBe("application/vnd.github+json");
  });

  it("adds Authorization header when GITHUB_TOKEN is set", async () => {
    process.env.GITHUB_TOKEN = "secret-token";
    const fakeFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [] }) });
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
});
