import { describe, expect, it } from "vitest";
import { formatCompactInt, timeAgo } from "../lib/format";

const NOW = new Date("2025-05-01T12:00:00Z");

describe("formatCompactInt", () => {
  it("returns the integer part for n < 1000", () => {
    expect(formatCompactInt(0)).toBe("0");
    expect(formatCompactInt(999)).toBe("999");
    expect(formatCompactInt(123)).toBe("123");
  });

  it("formats thousands with k", () => {
    expect(formatCompactInt(1000)).toBe("1k");
    expect(formatCompactInt(1234)).toBe("1.2k");
    expect(formatCompactInt(15000)).toBe("15k");
  });

  it("formats millions with M", () => {
    expect(formatCompactInt(1_000_000)).toBe("1M");
    expect(formatCompactInt(1_500_000)).toBe("1.5M");
  });

  it("formats billions with B", () => {
    expect(formatCompactInt(2_000_000_000)).toBe("2B");
  });

  it("handles non-finite input", () => {
    expect(formatCompactInt(Number.NaN)).toBe("0");
    expect(formatCompactInt(Number.POSITIVE_INFINITY)).toBe("0");
  });
});

describe("timeAgo", () => {
  it("seconds bucket", () => {
    const t = new Date(NOW.getTime() - 5 * 1000).toISOString();
    expect(timeAgo(t, NOW)).toBe("5s ago");
  });

  it("minutes bucket", () => {
    const t = new Date(NOW.getTime() - 5 * 60 * 1000).toISOString();
    expect(timeAgo(t, NOW)).toBe("5m ago");
  });

  it("hours bucket", () => {
    const t = new Date(NOW.getTime() - 3 * 3600 * 1000).toISOString();
    expect(timeAgo(t, NOW)).toBe("3h ago");
  });

  it("days bucket", () => {
    const t = new Date(NOW.getTime() - 5 * 86400 * 1000).toISOString();
    expect(timeAgo(t, NOW)).toBe("5d ago");
  });

  it("months bucket", () => {
    const t = new Date(NOW.getTime() - 60 * 86400 * 1000).toISOString();
    expect(timeAgo(t, NOW)).toBe("2mo ago");
  });

  it("years bucket", () => {
    const t = new Date(NOW.getTime() - 800 * 86400 * 1000).toISOString();
    expect(timeAgo(t, NOW)).toBe("2y ago");
  });

  it("returns dash for invalid date", () => {
    expect(timeAgo("not-a-date", NOW)).toBe("—");
  });
});
