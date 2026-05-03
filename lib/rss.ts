/**
 * Minimal RSS 2.0 parser for the VN-news aggregator.
 *
 * Avoids adding a runtime XML dependency: every VN source we ingest emits
 * a stable RSS 2.0 shape (`<rss><channel><item>{title,link,pubDate,description,guid}</item></channel></rss>`)
 * and the surface area of edge cases is small enough to handle with focused
 * extraction. The trade-off is documented in the test fixtures — every
 * shape we have to handle has a fixture committed alongside.
 *
 * Notable quirks the parser handles:
 *   - CDATA-wrapped values:           `<title><![CDATA[Foo & Bar]]></title>`
 *   - Bare entities in #PCDATA:       `<title>Foo &amp; Bar</title>`
 *   - Whitespace around tag content:  `<title>\n  Foo  </title>`
 *   - Multiple pubDate spellings:     `pubDate`, `pubdate`, `pub_date`
 *   - Two pubDate formats observed:
 *       * RFC 822:                    `Sun, 03 May 2026 14:58:42 +0700`
 *       * Tuổi Trẻ "GMT+7" suffix:    `Sun, 03 May 2026 19:41:28 GMT+7`
 *       * Viblo ISO-ish:              `2026-04-09 14:28:10`
 *
 * Pure: no fetch, no DOM.
 */

export interface RssItem {
  title: string;
  link: string;
  pub_date_iso: string;   // normalized ISO 8601
  pub_date_ts: number;    // unix-ms
  description: string | null; // plain text, HTML stripped, max 200 chars
  guid: string | null;
}

const ITEM_RE = /<item[\s>][\s\S]*?<\/item>/gi;

/**
 * Extract a single tag's text content (CDATA-aware). Returns null if not
 * found. Greedy through `</tagName>`.
 */
export function extractTag(itemXml: string, tagName: string): string | null {
  // Try CDATA-wrapped form first.
  const cdataRe = new RegExp(
    `<${tagName}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tagName}>`,
    "i",
  );
  const cdataMatch = cdataRe.exec(itemXml);
  if (cdataMatch) return cdataMatch[1];

  // Plain form.
  const plainRe = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, "i");
  const plainMatch = plainRe.exec(itemXml);
  if (plainMatch) return decodeEntities(plainMatch[1]);

  return null;
}

/**
 * Decode the small set of XML entities we expect in unwrapped #PCDATA.
 * Other tag-style entities (`&copy;` etc.) are left as-is — RSS feeds
 * mostly use named entities for `&amp;` / `&lt;` / `&gt;` only.
 */
export function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'");
}

/** Strip HTML tags and collapse whitespace. */
export function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parse a pubDate string into ISO + unix-ms.
 *
 * Accepts:
 *   - RFC 822: `Sun, 03 May 2026 14:58:42 +0700`     (Date constructor handles)
 *   - GMT±N suffix: `Sun, 03 May 2026 19:41:28 GMT+7` (rewrite to RFC 822)
 *   - Naive ISO: `2026-04-09 14:28:10`               (treat as UTC)
 *
 * Returns `null` on unparseable input rather than throwing — caller decides
 * whether to drop the item.
 */
export function parsePubDate(raw: string | null): { iso: string; ts: number } | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // GMT±N → ±N00 (RFC 822). Tuổi Trẻ does this.
  const gmtMatch = /^(.+?)\s+GMT([+-])(\d{1,2})\s*$/i.exec(trimmed);
  let candidate = trimmed;
  if (gmtMatch) {
    const sign = gmtMatch[2];
    const hours = gmtMatch[3].padStart(2, "0");
    candidate = `${gmtMatch[1]} ${sign}${hours}00`;
  }

  // Naive ISO `YYYY-MM-DD HH:mm:ss` → treat as UTC by appending Z.
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}$/.test(candidate)) {
    candidate = candidate.replace(" ", "T") + "Z";
  }

  const ts = Date.parse(candidate);
  if (Number.isNaN(ts)) return null;
  return { iso: new Date(ts).toISOString(), ts };
}

/**
 * Truncate a plain-text excerpt to `maxLen` chars on a word boundary.
 * Adds `…` when truncated.
 */
export function truncateExcerpt(s: string, maxLen = 200): string {
  if (s.length <= maxLen) return s;
  // Cut at last whitespace before maxLen.
  const cut = s.slice(0, maxLen);
  const lastWs = cut.lastIndexOf(" ");
  const safe = lastWs > maxLen - 40 ? cut.slice(0, lastWs) : cut;
  return safe.trimEnd() + "…";
}

/**
 * Parse an RSS 2.0 feed body into a list of items. Items missing a
 * required field (title, link, pubDate) are dropped. Order matches feed.
 */
export function parseRssFeed(xml: string): RssItem[] {
  const out: RssItem[] = [];
  const matches = xml.match(ITEM_RE);
  if (!matches) return out;
  for (const block of matches) {
    const title = extractTag(block, "title");
    const link = extractTag(block, "link");
    const pubDateRaw = extractTag(block, "pubDate") ?? extractTag(block, "pubdate");
    const desc = extractTag(block, "description");
    const guid = extractTag(block, "guid");
    if (!title || !link) continue;
    const pubDate = parsePubDate(pubDateRaw);
    if (!pubDate) continue;
    let excerpt: string | null = null;
    if (desc) {
      const stripped = stripHtml(desc);
      excerpt = stripped ? truncateExcerpt(stripped) : null;
    }
    out.push({
      title: title.trim(),
      link: link.trim(),
      pub_date_iso: pubDate.iso,
      pub_date_ts: pubDate.ts,
      description: excerpt,
      guid: guid ? guid.trim() : null,
    });
  }
  return out;
}
