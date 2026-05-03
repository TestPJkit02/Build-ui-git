import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchUserProfile,
  fetchUserProfiles,
  indexProfilesByLowercaseLogin,
} from "../lib/users";

type FetchArgs = Parameters<typeof fetch>;

function jsonResponse(body: unknown, init: ResponseInit = { status: 200 }): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "Content-Type": "application/json" },
  });
}

const sampleApiBody = {
  login: "torvalds",
  id: 1024025,
  avatar_url: "https://avatars.githubusercontent.com/u/1024025",
  html_url: "https://github.com/torvalds",
  type: "User",
  name: "Linus Torvalds",
  company: null,
  location: "Portland, USA",
  public_repos: 7,
};

describe("fetchUserProfile", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("hits /users/:login and parses location to country", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      jsonResponse(sampleApiBody),
    );
    const profile = await fetchUserProfile("torvalds");
    expect(profile?.login).toBe("torvalds");
    expect(profile?.country).toBe("US");
    expect(profile?.location).toBe("Portland, USA");
  });

  it("strips the [bot] suffix before calling the API", async () => {
    const f = fetch as unknown as ReturnType<typeof vi.fn>;
    f.mockResolvedValueOnce(
      jsonResponse({ ...sampleApiBody, login: "dependabot", type: "Bot" }),
    );
    await fetchUserProfile("dependabot[bot]");
    const url = (f.mock.calls[0] as FetchArgs)[0] as string;
    expect(url).toBe("https://api.github.com/users/dependabot");
  });

  it("returns null on non-2xx", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      jsonResponse({ message: "Not Found" }, { status: 404 }),
    );
    expect(await fetchUserProfile("ghost")).toBeNull();
  });

  it("returns null when fetch throws", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("network down"),
    );
    expect(await fetchUserProfile("bad")).toBeNull();
  });

  it("returns null for empty login (post-stripping)", async () => {
    expect(await fetchUserProfile("[bot]")).toBeNull();
    // Should have NOT made a network call.
    expect(fetch as unknown as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
  });

  it("includes the GITHUB_TOKEN as Authorization when set", async () => {
    process.env.GITHUB_TOKEN = "test-token";
    const f = fetch as unknown as ReturnType<typeof vi.fn>;
    f.mockResolvedValueOnce(jsonResponse(sampleApiBody));
    await fetchUserProfile("torvalds");
    const init = (f.mock.calls[0] as FetchArgs)[1];
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer test-token",
    });
    delete process.env.GITHUB_TOKEN;
  });

  it("normalises missing optional fields to null / 0", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      jsonResponse({
        login: "minimal",
        id: 1,
        avatar_url: "",
        html_url: "https://github.com/minimal",
        type: "User",
      }),
    );
    const profile = await fetchUserProfile("minimal");
    expect(profile?.name).toBeNull();
    expect(profile?.company).toBeNull();
    expect(profile?.location).toBeNull();
    expect(profile?.country).toBeNull();
    expect(profile?.public_repos).toBe(0);
  });
});

describe("fetchUserProfiles", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("dedupes case-insensitively before fetching", async () => {
    const f = fetch as unknown as ReturnType<typeof vi.fn>;
    f.mockResolvedValue(jsonResponse(sampleApiBody));
    await fetchUserProfiles(["torvalds", "Torvalds", "TORVALDS"]);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("returns a map keyed by the API-returned login", async () => {
    const f = fetch as unknown as ReturnType<typeof vi.fn>;
    f.mockResolvedValueOnce(
      jsonResponse({ ...sampleApiBody, login: "openai" }),
    );
    f.mockResolvedValueOnce(
      jsonResponse({ ...sampleApiBody, login: "ollama" }),
    );
    const out = await fetchUserProfiles(["openai", "ollama"]);
    expect(out.get("openai")?.login).toBe("openai");
    expect(out.get("ollama")?.login).toBe("ollama");
  });

  it("skips logins whose fetch fails", async () => {
    const f = fetch as unknown as ReturnType<typeof vi.fn>;
    f.mockResolvedValueOnce(jsonResponse({ message: "rate limit" }, { status: 403 }));
    f.mockResolvedValueOnce(jsonResponse({ ...sampleApiBody, login: "ollama" }));
    const out = await fetchUserProfiles(["ghost", "ollama"]);
    expect(out.has("ghost")).toBe(false);
    expect(out.get("ollama")?.login).toBe("ollama");
  });

  it("returns an empty map for empty input", async () => {
    const out = await fetchUserProfiles([]);
    expect(out.size).toBe(0);
  });
});

describe("indexProfilesByLowercaseLogin", () => {
  it("indexes the map with lowercased keys", () => {
    const input = new Map([
      ["OpenAI", { login: "OpenAI" } as never],
      ["ollama", { login: "ollama" } as never],
    ]);
    const out = indexProfilesByLowercaseLogin(input);
    expect(out.get("openai")).toBeDefined();
    expect(out.get("ollama")).toBeDefined();
  });
});
