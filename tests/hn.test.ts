import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAiNews, hitToStory, isAiTitle } from "../lib/hn";

describe("isAiTitle", () => {
  it("matches whole-word AI", () => {
    expect(isAiTitle("AI is changing software")).toBe(true);
    expect(isAiTitle("Brain rain again")).toBe(false);
    expect(isAiTitle("Apple announces M5 chip")).toBe(false);
  });

  it("matches LLM and GPT and Claude", () => {
    expect(isAiTitle("New LLM benchmark released")).toBe(true);
    expect(isAiTitle("GPT-5 rumored for launch")).toBe(true);
    expect(isAiTitle("Claude 4 first impressions")).toBe(true);
  });

  it("matches multi-word keywords", () => {
    expect(isAiTitle("My favorite machine learning libs")).toBe(true);
    expect(isAiTitle("A primer on deep learning")).toBe(true);
  });

  it("matches anthropic / openai / gemini regardless of case", () => {
    expect(isAiTitle("OpenAI launches new model")).toBe(true);
    expect(isAiTitle("anthropic publishes paper")).toBe(true);
    expect(isAiTitle("Gemini 2.0 first look")).toBe(true);
  });

  it("returns false for unrelated titles", () => {
    expect(isAiTitle("Postgres tips for 2025")).toBe(false);
    expect(isAiTitle("Ten things every JS dev should know")).toBe(false);
  });
});

describe("hitToStory", () => {
  it("maps a complete hit", () => {
    const story = hitToStory({
      objectID: "1",
      title: "AI launches",
      url: "https://x",
      points: 10,
      num_comments: 2,
      author: "alice",
      created_at: "2025-05-01T00:00:00Z",
    });
    expect(story).not.toBeNull();
    expect(story!.id).toBe("1");
    expect(story!.points).toBe(10);
    expect(story!.source).toBe("hackernews");
  });

  it("treats missing points/comments as 0", () => {
    const story = hitToStory({
      objectID: "1",
      title: "AI launches",
      url: null,
      points: null,
      num_comments: null,
      author: "alice",
      created_at: "2025-05-01T00:00:00Z",
    });
    expect(story!.points).toBe(0);
    expect(story!.num_comments).toBe(0);
  });

  it("returns null for missing title", () => {
    const story = hitToStory({
      objectID: "1",
      title: null,
      url: null,
      points: 1,
      num_comments: 1,
      author: "x",
      created_at: "2025-05-01T00:00:00Z",
    });
    expect(story).toBeNull();
  });
});

describe("fetchAiNews", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns AI-only stories from the HN payload", async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        hits: [
          {
            objectID: "1",
            title: "OpenAI announces o4",
            url: "https://x",
            points: 100,
            num_comments: 20,
            author: "a",
            created_at: "2025-05-01T00:00:00Z",
          },
          {
            objectID: "2",
            title: "Postgres performance tricks",
            url: "https://y",
            points: 80,
            num_comments: 10,
            author: "b",
            created_at: "2025-05-01T00:00:00Z",
          },
          {
            objectID: "3",
            title: null,
            url: null,
            points: 1,
            num_comments: 0,
            author: "c",
            created_at: "2025-05-01T00:00:00Z",
          },
        ],
      }),
    });
    // assign without breaking type-narrowing in callers
    (globalThis as unknown as { fetch: typeof fetch }).fetch = fakeFetch as unknown as typeof fetch;

    const stories = await fetchAiNews(10);
    expect(stories).toHaveLength(1);
    expect(stories[0].id).toBe("1");
  });

  it("throws when the upstream returns non-OK", async () => {
    const fakeFetch = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    (globalThis as unknown as { fetch: typeof fetch }).fetch = fakeFetch as unknown as typeof fetch;
    await expect(fetchAiNews(5)).rejects.toThrow(/HN API failed: 500/);
  });

  it("respects the limit", async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        hits: Array.from({ length: 5 }, (_, i) => ({
          objectID: String(i),
          title: `LLM update ${i}`,
          url: "https://x",
          points: i,
          num_comments: i,
          author: "x",
          created_at: "2025-05-01T00:00:00Z",
        })),
      }),
    });
    (globalThis as unknown as { fetch: typeof fetch }).fetch = fakeFetch as unknown as typeof fetch;
    const stories = await fetchAiNews(2);
    expect(stories).toHaveLength(2);
  });
});

describe("isAiTitle (integration with hits)", () => {
  beforeEach(() => {
    // no-op placeholder so coverage hits this describe block
  });

  it("does not match the substring 'ai' inside other words", () => {
    expect(isAiTitle("Sailing tutorial")).toBe(false);
    expect(isAiTitle("Detained rain")).toBe(false);
  });
});
