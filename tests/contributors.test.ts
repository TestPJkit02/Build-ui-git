import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchContributorsForRepo,
  fetchContributorsForRepos,
} from "../lib/contributors";
import type { Repo } from "../lib/types";

function makeRepo(partial: Partial<Repo> & { full_name: string }): Repo {
  const [owner] = partial.full_name.split("/");
  const base: Repo = {
    id: 1,
    full_name: partial.full_name,
    html_url: `https://github.com/${partial.full_name}`,
    description: null,
    stargazers_count: 1000,
    forks_count: 100,
    pushed_at: "2026-01-01T00:00:00Z",
    created_at: "2024-01-01T00:00:00Z",
    topics: [],
    language: null,
    owner: {
      login: owner,
      avatar_url: `https://avatars.githubusercontent.com/${owner}`,
    },
  };
  return { ...base, ...partial };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchContributorsForRepo", () => {
  it("returns contributors annotated with source repo metadata", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse([
        {
          login: "alice",
          avatar_url: "https://avatars.githubusercontent.com/alice",
          html_url: "https://github.com/alice",
          contributions: 312,
          type: "User",
        },
        {
          login: "dependabot[bot]",
          avatar_url: "https://avatars.githubusercontent.com/in/29110",
          html_url: "https://github.com/apps/dependabot",
          contributions: 28,
          type: "Bot",
        },
      ]),
    );

    const repo = makeRepo({
      full_name: "acme/widget",
      stargazers_count: 5000,
      forks_count: 250,
    });

    const result = await fetchContributorsForRepo(repo);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      login: "alice",
      contributions: 312,
      source_repo: "acme/widget",
      source_repo_stars: 5000,
      source_repo_forks: 250,
    });
    expect(result[1].login).toBe("dependabot[bot]");
  });

  it("returns [] on 404", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: "Not Found" }, 404));
    const result = await fetchContributorsForRepo(makeRepo({ full_name: "x/y" }));
    expect(result).toEqual([]);
  });

  it("returns [] on network error", async () => {
    fetchMock.mockRejectedValueOnce(new Error("ECONNRESET"));
    const result = await fetchContributorsForRepo(makeRepo({ full_name: "x/y" }));
    expect(result).toEqual([]);
  });

  it("returns [] when API returns a non-array body (e.g. abuse-detection map)", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: "secondary rate limit" }));
    const result = await fetchContributorsForRepo(makeRepo({ full_name: "x/y" }));
    expect(result).toEqual([]);
  });

  it("includes Authorization header when GITHUB_TOKEN is set", async () => {
    process.env.GITHUB_TOKEN = "test-token-123";
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    await fetchContributorsForRepo(makeRepo({ full_name: "x/y" }));
    const [, init] = fetchMock.mock.calls[0];
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer test-token-123");
    delete process.env.GITHUB_TOKEN;
  });

  it("uses ?per_page=50 by default", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    await fetchContributorsForRepo(makeRepo({ full_name: "x/y" }));
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("per_page=50");
  });
});

describe("fetchContributorsForRepos", () => {
  it("flattens contributors across all repos", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse([
          {
            login: "alice",
            avatar_url: "",
            html_url: "https://github.com/alice",
            contributions: 100,
            type: "User",
          },
        ]),
      )
      .mockResolvedValueOnce(
        jsonResponse([
          {
            login: "alice",
            avatar_url: "",
            html_url: "https://github.com/alice",
            contributions: 50,
            type: "User",
          },
          {
            login: "bob",
            avatar_url: "",
            html_url: "https://github.com/bob",
            contributions: 25,
            type: "User",
          },
        ]),
      );

    const repos = [
      makeRepo({ full_name: "x/repo1" }),
      makeRepo({ full_name: "x/repo2" }),
    ];

    const result = await fetchContributorsForRepos(repos);

    expect(result).toHaveLength(3);
    expect(result.map((c) => `${c.login}@${c.source_repo}`).sort()).toEqual([
      "alice@x/repo1",
      "alice@x/repo2",
      "bob@x/repo2",
    ]);
  });

  it("survives partial failures (one repo errors, others succeed)", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse([
          {
            login: "alice",
            avatar_url: "",
            html_url: "https://github.com/alice",
            contributions: 100,
            type: "User",
          },
        ]),
      )
      .mockRejectedValueOnce(new Error("ETIMEDOUT"));

    const result = await fetchContributorsForRepos([
      makeRepo({ full_name: "x/r1" }),
      makeRepo({ full_name: "x/r2" }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].login).toBe("alice");
  });

  it("returns [] for empty input without making any fetch", async () => {
    const result = await fetchContributorsForRepos([]);
    expect(result).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
