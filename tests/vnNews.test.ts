import { describe, expect, it } from "vitest";
import {
  canonicalUrl,
  dedupByUrl,
  fetchVnNewsBundle,
  mapWithConcurrency,
  parseSourceFeed,
  rankTrending,
  shortHash,
  sortByRecency,
  trendScore,
} from "../lib/vnNews";
import type { VnNewsItem } from "../lib/types";
import type { VnSourceMeta } from "../lib/vnSources";

const VNE_META: VnSourceMeta = {
  id: "vne-khcn",
  name: "VnExpress · KHCN",
  url: "https://vnexpress.net/rss/khoa-hoc-cong-nghe.rss",
  weight: 3,
  requires_ai_filter: false,
  max_items: 50,
};

const TINHTE_META: VnSourceMeta = {
  id: "tinhte",
  name: "Tinh Tế",
  url: "https://feeds.feedburner.com/tinhte",
  weight: 2,
  requires_ai_filter: true,
  max_items: 30,
};

function buildXml(
  items: { title: string; link: string; pubDate: string; desc?: string }[],
): string {
  return `<rss><channel>${items
    .map(
      (it) => `
<item>
  <title>${it.title}</title>
  <link>${it.link}</link>
  <pubDate>${it.pubDate}</pubDate>
  ${it.desc ? `<description><![CDATA[${it.desc}]]></description>` : ""}
</item>`,
    )
    .join("")}</channel></rss>`;
}

describe("canonicalUrl", () => {
  it("strips utm_* params and lowercases host", () => {
    expect(canonicalUrl("HTTPS://Example.COM/x?utm_source=feed&utm_medium=rss&id=1")).toBe(
      "https://example.com/x?id=1",
    );
  });

  it("strips fbclid", () => {
    expect(canonicalUrl("https://example.com/x?fbclid=abc")).toBe("https://example.com/x");
  });

  it("removes trailing slash on non-root paths", () => {
    expect(canonicalUrl("https://example.com/foo/")).toBe("https://example.com/foo");
  });

  it("preserves the root slash", () => {
    expect(canonicalUrl("https://example.com/")).toBe("https://example.com/");
  });

  it("returns input unchanged on parse failure", () => {
    expect(canonicalUrl("not a url")).toBe("not a url");
  });
});

describe("shortHash", () => {
  it("is deterministic", () => {
    expect(shortHash("abc")).toBe(shortHash("abc"));
  });
  it("differs for different inputs", () => {
    expect(shortHash("abc")).not.toBe(shortHash("abd"));
  });
});

describe("parseSourceFeed", () => {
  it("normalizes items and sets ai_score", () => {
    const xml = buildXml([
      {
        title: "OpenAI ra mắt mô hình mới",
        link: "https://vnexpress.net/openai-ra-mat-mo-hinh-moi-1.html",
        pubDate: "Sun, 03 May 2026 14:58:42 +0700",
        desc: "<p>Trí tuệ nhân tạo và học máy</p>",
      },
    ]);
    const items = parseSourceFeed(VNE_META, xml);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("OpenAI ra mắt mô hình mới");
    expect(items[0].source_id).toBe("vne-khcn");
    expect(items[0].source_name).toBe("VnExpress · KHCN");
    expect(items[0].url).toBe("https://vnexpress.net/openai-ra-mat-mo-hinh-moi-1.html");
    expect(items[0].excerpt).toBe("Trí tuệ nhân tạo và học máy");
    expect(items[0].ai_score).toBeGreaterThanOrEqual(2); // openai + trí tuệ nhân tạo + học máy
  });

  it("filters non-AI items when source.requires_ai_filter is true", () => {
    const xml = buildXml([
      {
        title: "Đánh giá iPhone 16 Pro Max",
        link: "https://tinhte.vn/iphone.html",
        pubDate: "Sun, 03 May 2026 14:58:42 +0700",
      },
      {
        title: "ChatGPT có gì mới trong 2026",
        link: "https://tinhte.vn/chatgpt.html",
        pubDate: "Sun, 03 May 2026 14:58:42 +0700",
      },
    ]);
    const items = parseSourceFeed(TINHTE_META, xml);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("ChatGPT có gì mới trong 2026");
  });

  it("keeps every item when requires_ai_filter is false", () => {
    const xml = buildXml([
      {
        title: "Đánh giá iPhone 16 Pro Max — chip mới và camera tele",
        link: "https://vnexpress.net/iphone.html",
        pubDate: "Sun, 03 May 2026 14:58:42 +0700",
      },
    ]);
    const items = parseSourceFeed(VNE_META, xml);
    expect(items).toHaveLength(1);
    expect(items[0].ai_score).toBe(0);
  });

  it("respects max_items per source", () => {
    const meta: VnSourceMeta = { ...VNE_META, max_items: 2 };
    const xml = buildXml(
      Array.from({ length: 5 }, (_, i) => ({
        title: `Story ${i}`,
        link: `https://example.com/${i}`,
        pubDate: "Sun, 03 May 2026 14:58:42 +0700",
      })),
    );
    expect(parseSourceFeed(meta, xml)).toHaveLength(2);
  });
});

describe("dedupByUrl", () => {
  function fakeItem(url: string, title = "x"): VnNewsItem {
    return {
      id: shortHash(url),
      source_id: "vne-khcn",
      source_name: "VnExpress",
      title,
      url,
      pub_date: "2026-05-03T07:58:42.000Z",
      pub_date_ts: Date.parse("2026-05-03T07:58:42.000Z"),
      excerpt: null,
      ai_score: 0,
    };
  }

  it("removes later occurrences of the same URL", () => {
    const out = dedupByUrl([
      fakeItem("https://example.com/a", "first"),
      fakeItem("https://example.com/b"),
      fakeItem("https://example.com/a", "duplicate"),
    ]);
    expect(out).toHaveLength(2);
    expect(out[0].title).toBe("first");
    expect(out[1].url).toBe("https://example.com/b");
  });

  it("does not deduplicate distinct URLs that look similar", () => {
    const out = dedupByUrl([
      fakeItem("https://example.com/a"),
      fakeItem("https://example.com/a?x=1"),
    ]);
    expect(out).toHaveLength(2);
  });
});

describe("sortByRecency", () => {
  it("returns items newest-first without mutating input", () => {
    const a: VnNewsItem = {
      id: "a",
      source_id: "vne-khcn",
      source_name: "x",
      title: "a",
      url: "https://x/a",
      pub_date: "",
      pub_date_ts: 1000,
      excerpt: null,
      ai_score: 0,
    };
    const b = { ...a, id: "b", url: "https://x/b", pub_date_ts: 3000 };
    const c = { ...a, id: "c", url: "https://x/c", pub_date_ts: 2000 };
    const input = [a, b, c];
    const out = sortByRecency(input);
    expect(out.map((x) => x.id)).toEqual(["b", "c", "a"]);
    // input untouched
    expect(input.map((x) => x.id)).toEqual(["a", "b", "c"]);
  });
});

describe("trendScore + rankTrending", () => {
  const NOW = Date.parse("2026-05-03T12:00:00.000Z");

  function it_(id: string, ageHours: number, ai_score: number): VnNewsItem {
    const ts = NOW - ageHours * 3600 * 1000;
    return {
      id,
      source_id: "vne-khcn",
      source_name: "x",
      title: id,
      url: `https://x/${id}`,
      pub_date: new Date(ts).toISOString(),
      pub_date_ts: ts,
      excerpt: null,
      ai_score,
    };
  }

  it("trendScore decays linearly to zero over a week", () => {
    const fresh = it_("fresh", 0, 3);
    const halfWeek = it_("halfweek", 24 * 3.5, 3);
    const old = it_("old", 24 * 7, 3);
    expect(trendScore(fresh, NOW)).toBe(3);
    expect(trendScore(halfWeek, NOW)).toBeCloseTo(1.5, 5);
    expect(trendScore(old, NOW)).toBe(0);
  });

  it("rankTrending excludes ai_score=0 items", () => {
    const items = [it_("a", 1, 0), it_("b", 2, 5), it_("c", 3, 1)];
    const out = rankTrending(items, 5, NOW);
    expect(out.map((x) => x.id)).toEqual(["b", "c"]);
  });

  it("rankTrending breaks ties by recency", () => {
    const items = [
      it_("older", 5, 2),
      it_("newer", 1, 2),
    ];
    const out = rankTrending(items, 5, NOW);
    expect(out[0].id).toBe("newer");
  });

  it("rankTrending caps result at n", () => {
    const items = Array.from({ length: 10 }, (_, i) => it_(`x${i}`, i, 3));
    expect(rankTrending(items, 3, NOW)).toHaveLength(3);
  });
});

describe("mapWithConcurrency", () => {
  it("processes all items and preserves order", async () => {
    const out = await mapWithConcurrency([1, 2, 3, 4, 5], async (n) => n * 2, 2);
    expect(out).toEqual([2, 4, 6, 8, 10]);
  });

  it("respects the concurrency cap", async () => {
    let inflight = 0;
    let peak = 0;
    await mapWithConcurrency(
      Array.from({ length: 10 }),
      async () => {
        inflight++;
        peak = Math.max(peak, inflight);
        await new Promise((r) => setTimeout(r, 10));
        inflight--;
      },
      3,
    );
    expect(peak).toBeLessThanOrEqual(3);
  });
});

describe("fetchVnNewsBundle (integration with mocked fetch)", () => {
  function makeFetch(map: Record<string, { ok?: boolean; status?: number; body?: string }>): typeof fetch {
    return (async (url: RequestInfo | URL) => {
      const key = url.toString();
      const entry = map[key];
      if (!entry) {
        return { ok: false, status: 404, text: async () => "" } as Response;
      }
      const ok = entry.ok ?? true;
      const status = entry.status ?? (ok ? 200 : 500);
      return {
        ok,
        status,
        text: async () => entry.body ?? "",
      } as Response;
    }) as typeof fetch;
  }

  it("aggregates items across sources, dedups, and reports failures", async () => {
    const NOW = Date.parse("2026-05-03T12:00:00.000Z");
    const sharedUrl = "https://shared.example.com/story";
    const fetchFn = makeFetch({
      "https://vnexpress.net/rss/khoa-hoc-cong-nghe.rss": {
        body: buildXml([
          {
            title: "OpenAI launches new model",
            link: "https://vnexpress.net/a-1.html",
            pubDate: "Sun, 03 May 2026 11:00:00 +0700",
          },
          {
            title: "Shared cross-post — first",
            link: sharedUrl,
            pubDate: "Sun, 03 May 2026 10:00:00 +0700",
          },
        ]),
      },
      "https://tuoitre.vn/rss/nhip-song-so.rss": {
        body: buildXml([
          {
            title: "Anthropic news on Tuoi Tre",
            link: "https://tuoitre.vn/b-2.html",
            pubDate: "Sun, 03 May 2026 09:30:00 GMT+7",
          },
          {
            title: "Shared cross-post — second source",
            link: sharedUrl,
            pubDate: "Sun, 03 May 2026 09:00:00 GMT+7",
          },
        ]),
      },
      "https://genk.vn/rss/ai.rss": { ok: false, status: 503 },
      "https://feeds.feedburner.com/tinhte": {
        body: buildXml([
          {
            title: "Đánh giá iPhone 16 — màu titan mới",
            link: "https://tinhte.vn/c.html",
            pubDate: "Sun, 03 May 2026 08:00:00 +0700",
          },
          {
            title: "Tinh Tế ChatGPT story (AI)",
            link: "https://tinhte.vn/d.html",
            pubDate: "Sun, 03 May 2026 11:30:00 +0700",
            desc: "ChatGPT cập nhật mới nhất",
          },
        ]),
      },
      "https://viblo.asia/rss/tags/artificial-intelligence.rss": { ok: false, status: 500 },
      "https://viblo.asia/rss/tags/deep-learning.rss": { ok: false, status: 500 },
      "https://viblo.asia/rss/tags/machine-learning.rss": { ok: false, status: 500 },
      "https://znews.vn/rss/cong-nghe.rss": { ok: false, status: 500 },
    });

    const bundle = await fetchVnNewsBundle({ fetchFn, now: NOW, trendingTake: 3 });

    // 2 (vne) + 2 (tuoitre) + 1 (tinhte AI-only) - 1 dedup of shared = 4
    expect(bundle.items).toHaveLength(4);
    // Newest first — Tinh Tế ChatGPT story is at 11:30 +07, beats VNE 11:00 and Tuoi Tre 09:30.
    expect(bundle.items[0].title).toBe("Tinh Tế ChatGPT story (AI)");
    expect(bundle.items[1].title).toBe("OpenAI launches new model");
    // Shared kept the first occurrence (vne)
    const shared = bundle.items.find((it) => it.url === sharedUrl);
    expect(shared!.source_id).toBe("vne-khcn");
    // Failures bubble up
    expect(bundle.failures).toContain("genk-ai");
    expect(bundle.failures).toContain("viblo-ai");
    // Tinh Tế ai-filter actually filtered the camera review
    const tinhteItems = bundle.items.filter((it) => it.source_id === "tinhte");
    expect(tinhteItems).toHaveLength(1);
    expect(tinhteItems[0].title).toContain("ChatGPT");
    // Trending capped at 3 and only AI-relevant
    expect(bundle.trending.length).toBeLessThanOrEqual(3);
    expect(bundle.trending.every((it) => it.ai_score > 0)).toBe(true);
  });

  it("respects the optional sources filter", async () => {
    const fetchFn = makeFetch({
      "https://vnexpress.net/rss/khoa-hoc-cong-nghe.rss": {
        body: buildXml([
          {
            title: "OpenAI",
            link: "https://vnexpress.net/x.html",
            pubDate: "Sun, 03 May 2026 11:00:00 +0700",
          },
        ]),
      },
    });
    const bundle = await fetchVnNewsBundle({
      fetchFn,
      sources: ["vne-khcn"],
      now: Date.parse("2026-05-03T12:00:00.000Z"),
    });
    expect(bundle.items).toHaveLength(1);
    expect(bundle.failures).toEqual([]); // Only vne-khcn was probed and it succeeded
  });

  it("flags 'no items parsed' as a failure", async () => {
    const fetchFn = makeFetch({
      "https://vnexpress.net/rss/khoa-hoc-cong-nghe.rss": {
        body: `<rss><channel></channel></rss>`,
      },
    });
    const bundle = await fetchVnNewsBundle({
      fetchFn,
      sources: ["vne-khcn"],
      now: Date.parse("2026-05-03T12:00:00.000Z"),
    });
    expect(bundle.failures).toContain("vne-khcn");
    expect(bundle.errors["vne-khcn"]).toBe("no items parsed");
  });
});
