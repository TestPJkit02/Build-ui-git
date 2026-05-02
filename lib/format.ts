/**
 * Compact integer formatter: 1234 -> "1.2k", 1_500_000 -> "1.5M".
 * Always returns a string, never throws.
 */
export function formatCompactInt(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const abs = Math.abs(n);
  if (abs < 1000) return String(Math.trunc(n));
  if (abs < 1_000_000) {
    const v = n / 1000;
    return trimZero(v) + "k";
  }
  if (abs < 1_000_000_000) {
    const v = n / 1_000_000;
    return trimZero(v) + "M";
  }
  return trimZero(n / 1_000_000_000) + "B";
}

function trimZero(n: number): string {
  return n.toFixed(1).replace(/\.0$/, "");
}

/**
 * Human-friendly relative time, e.g. "3h ago", "5d ago", "2mo ago".
 * Returns "—" for invalid input.
 */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "—";
  const diffSec = Math.max(0, Math.round((now.getTime() - t) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  const diffMo = Math.round(diffDay / 30);
  if (diffMo < 12) return `${diffMo}mo ago`;
  const diffYr = Math.round(diffMo / 12);
  return `${diffYr}y ago`;
}
