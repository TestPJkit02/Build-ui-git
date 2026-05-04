"use client";

import Link from "next/link";
import type { NewsLang } from "@/lib/types";

/**
 * EN/VN language toggle for the `/news` route. Renders as two pill links
 * — one is the *current* language (active), the other links to the
 * counterpart with `?lang=` set. Server Components render the page on
 * the link target, so this is just a navigation surface, not state.
 */
export function LangToggle({ current }: { current: NewsLang }) {
  return (
    <div
      role="tablist"
      aria-label="News language"
      className="inline-flex items-center border border-line"
    >
      <Pill href="/news?lang=en" label="EN · Hacker News" tag="01" active={current === "en"} />
      <Pill href="/news?lang=vn" label="VN · Tin tức" tag="02" active={current === "vn"} />
    </div>
  );
}

function Pill({
  href,
  label,
  tag,
  active,
}: {
  href: string;
  label: string;
  tag: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      role="tab"
      aria-selected={active}
      className={`px-3 py-1.5 inline-flex items-baseline gap-1.5 text-[11px] uppercase tracking-[0.14em] transition-colors ${
        active
          ? "bg-accent-cyan/10 text-accent-cyan"
          : "text-fg-muted hover:text-fg-strong hover:bg-panel-hover"
      }`}
    >
      <span className={`text-[10px] ${active ? "text-accent-cyan" : "text-fg-dim"}`}>{tag}</span>
      <span>{label}</span>
    </Link>
  );
}
