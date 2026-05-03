import { describe, expect, it } from "vitest";
import {
  decodeEntities,
  extractTag,
  parsePubDate,
  parseRssFeed,
  stripHtml,
  truncateExcerpt,
} from "../lib/rss";

describe("decodeEntities", () => {
  it("decodes the standard XML entities", () => {
    expect(decodeEntities("Foo &amp; Bar")).toBe("Foo & Bar");
    expect(decodeEntities("&lt;tag&gt;")).toBe("<tag>");
    expect(decodeEntities("a &quot;b&quot;")).toBe('a "b"');
    expect(decodeEntities("don&apos;t")).toBe("don't");
    expect(decodeEntities("don&#39;t")).toBe("don't");
  });

  it("leaves unknown entities alone", () => {
    expect(decodeEntities("&copy; foo")).toBe("&copy; foo");
  });
});

describe("stripHtml", () => {
  it("removes tags and collapses whitespace", () => {
    expect(stripHtml("<p>hello   <strong>world</strong></p>")).toBe("hello world");
  });

  it("handles nested + self-closing tags", () => {
    expect(stripHtml("<a href='x'><img src='y'/>foo</a>")).toBe("foo");
  });

  it("returns empty string for tag-only input", () => {
    expect(stripHtml("<br/><br/>")).toBe("");
  });
});

describe("truncateExcerpt", () => {
  it("returns input unchanged when shorter than maxLen", () => {
    expect(truncateExcerpt("short", 200)).toBe("short");
  });

  it("truncates on a word boundary and appends an ellipsis", () => {
    const long = "word ".repeat(60);
    const out = truncateExcerpt(long, 50);
    expect(out.length).toBeLessThanOrEqual(51);
    expect(out.endsWith("…")).toBe(true);
    // Should not end mid-word.
    expect(out.replace(/…$/, "").trimEnd().endsWith("word")).toBe(true);
  });
});

describe("extractTag", () => {
  it("extracts CDATA-wrapped content", () => {
    const xml = `<title><![CDATA[Foo & <Bar>]]></title>`;
    expect(extractTag(xml, "title")).toBe("Foo & <Bar>");
  });

  it("extracts plain content with entity decoding", () => {
    const xml = `<title>Foo &amp; Bar</title>`;
    expect(extractTag(xml, "title")).toBe("Foo & Bar");
  });

  it("is case-insensitive on the tag name", () => {
    const xml = `<PubDate>x</PubDate>`;
    expect(extractTag(xml, "pubdate")).toBe("x");
  });

  it("returns null when not present", () => {
    expect(extractTag(`<a/>`, "title")).toBe(null);
  });

  it("ignores attributes on the opening tag", () => {
    const xml = `<link foo="bar">https://x.com</link>`;
    expect(extractTag(xml, "link")).toBe("https://x.com");
  });
});

describe("parsePubDate", () => {
  it("parses RFC 822 with offset", () => {
    const result = parsePubDate("Sun, 03 May 2026 14:58:42 +0700");
    expect(result).not.toBeNull();
    expect(result!.iso).toBe("2026-05-03T07:58:42.000Z");
  });

  it("parses Tuổi Trẻ-style GMT+7 suffix as +0700", () => {
    const result = parsePubDate("Sun, 03 May 2026 19:41:28 GMT+7");
    expect(result).not.toBeNull();
    // 19:41:28 +0700 == 12:41:28 UTC
    expect(result!.iso).toBe("2026-05-03T12:41:28.000Z");
  });

  it("parses naive ISO YYYY-MM-DD HH:mm:ss as UTC", () => {
    const result = parsePubDate("2026-04-09 14:28:10");
    expect(result).not.toBeNull();
    expect(result!.iso).toBe("2026-04-09T14:28:10.000Z");
  });

  it("returns null on garbage input", () => {
    expect(parsePubDate("not a date")).toBe(null);
    expect(parsePubDate("")).toBe(null);
    expect(parsePubDate(null)).toBe(null);
  });

  it("normalizes single-digit GMT offsets to two-digit", () => {
    const result = parsePubDate("Sun, 03 May 2026 19:00:00 GMT+7");
    expect(result!.iso).toBe("2026-05-03T12:00:00.000Z");
  });
});

describe("parseRssFeed", () => {
  it("extracts items from a minimal RSS 2.0 body", () => {
    const xml = `
<rss version="2.0">
  <channel>
    <title>Test</title>
    <item>
      <title>First</title>
      <link>https://example.com/a</link>
      <pubDate>Sun, 03 May 2026 14:58:42 +0700</pubDate>
      <description>Hello world</description>
    </item>
    <item>
      <title>Second</title>
      <link>https://example.com/b</link>
      <pubDate>Sat, 02 May 2026 10:00:00 +0700</pubDate>
    </item>
  </channel>
</rss>`;
    const items = parseRssFeed(xml);
    expect(items).toHaveLength(2);
    expect(items[0].title).toBe("First");
    expect(items[0].link).toBe("https://example.com/a");
    expect(items[0].description).toBe("Hello world");
    expect(items[1].title).toBe("Second");
    expect(items[1].description).toBe(null);
  });

  it("handles CDATA-wrapped values in any field", () => {
    const xml = `
<rss><channel><item>
  <title><![CDATA[Foo & <Bar>]]></title>
  <link><![CDATA[https://example.com/a?x=1&y=2]]></link>
  <pubDate>Sun, 03 May 2026 14:58:42 +0700</pubDate>
  <description><![CDATA[<p>Hello <strong>world</strong></p>]]></description>
</item></channel></rss>`;
    const items = parseRssFeed(xml);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Foo & <Bar>");
    expect(items[0].link).toBe("https://example.com/a?x=1&y=2");
    expect(items[0].description).toBe("Hello world");
  });

  it("drops items missing required fields (title or link)", () => {
    const xml = `
<rss><channel>
  <item>
    <link>https://example.com/a</link>
    <pubDate>Sun, 03 May 2026 14:58:42 +0700</pubDate>
  </item>
  <item>
    <title>OK</title>
    <link>https://example.com/b</link>
    <pubDate>Sun, 03 May 2026 14:58:42 +0700</pubDate>
  </item>
</channel></rss>`;
    const items = parseRssFeed(xml);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("OK");
  });

  it("drops items with unparseable pubDate", () => {
    const xml = `
<rss><channel>
  <item>
    <title>Bad date</title>
    <link>https://example.com/a</link>
    <pubDate>nonsense</pubDate>
  </item>
</channel></rss>`;
    const items = parseRssFeed(xml);
    expect(items).toHaveLength(0);
  });

  it("returns empty array when feed has no items", () => {
    expect(parseRssFeed(`<rss><channel><title>x</title></channel></rss>`)).toEqual([]);
  });

  it("truncates long descriptions and strips HTML", () => {
    const xml = `
<rss><channel><item>
  <title>X</title>
  <link>https://example.com/x</link>
  <pubDate>Sun, 03 May 2026 14:58:42 +0700</pubDate>
  <description><![CDATA[${"<p>foo bar baz</p>".repeat(50)}]]></description>
</item></channel></rss>`;
    const items = parseRssFeed(xml);
    expect(items[0].description).not.toBeNull();
    expect(items[0].description!.length).toBeLessThanOrEqual(201);
    expect(items[0].description!.endsWith("…")).toBe(true);
    // Should not contain any tag chars
    expect(items[0].description!.includes("<")).toBe(false);
  });

  it("preserves item order from the feed", () => {
    const xml = `
<rss><channel>
  <item>
    <title>Newer</title>
    <link>https://example.com/1</link>
    <pubDate>Sun, 03 May 2026 14:58:42 +0700</pubDate>
  </item>
  <item>
    <title>Older</title>
    <link>https://example.com/2</link>
    <pubDate>Sat, 02 May 2026 10:00:00 +0700</pubDate>
  </item>
</channel></rss>`;
    const items = parseRssFeed(xml);
    expect(items[0].title).toBe("Newer");
    expect(items[1].title).toBe("Older");
  });
});
