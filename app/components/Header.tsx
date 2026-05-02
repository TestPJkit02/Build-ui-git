"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV_ITEMS: { href: string; label: string; tag: string }[] = [
  { href: "/", label: "Repos", tag: "01" },
  { href: "/new", label: "New", tag: "02" },
  { href: "/news", label: "News", tag: "03" },
  { href: "/stats", label: "Stats", tag: "04" },
];

// Render the live clock in Indochina Time (UTC+7, Asia/Ho_Chi_Minh).
// `sv-SE` locale formats as `YYYY-MM-DD HH:mm:ss` natively.
const CLOCK_FORMATTER = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Ho_Chi_Minh",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

export function Header({ hasToken }: { hasToken: boolean }) {
  const pathname = usePathname();
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const stamp = now ? `${CLOCK_FORMATTER.format(now)} UTC+7` : "—";

  return (
    <header className="border-b border-line bg-panel/80 backdrop-blur sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-y-3 gap-x-6">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 hover:text-accent-cyan transition-colors"
          >
            <span className="text-accent-cyan text-base">▌</span>
            <span className="text-fg-strong font-semibold tracking-[0.18em] uppercase text-sm">
              AI Repo Monitor
            </span>
          </Link>
          <span className="hidden sm:inline label-tag label-tag-cyan">
            <span className="status-dot status-dot-cyan pulse" />
            terminal v1.0
          </span>
        </div>

        <nav className="order-3 lg:order-2 w-full lg:w-auto flex flex-wrap items-center gap-x-1 gap-y-2 text-xs uppercase tracking-[0.12em]">
          {NAV_ITEMS.map((item) => {
            // Use exact match + segment-aware prefix so `/news` does NOT
            // match `/new` (i.e. `"/news".startsWith("/new")` would be true).
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href ||
                  pathname?.startsWith(item.href + "/") === true;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`group inline-flex items-baseline gap-1.5 px-2.5 py-1.5 border transition-colors ${
                  active
                    ? "border-accent-cyan text-accent-cyan bg-accent-cyan/10"
                    : "border-line text-fg-muted hover:text-fg-strong hover:border-line-strong"
                }`}
              >
                <span
                  className={`text-[10px] ${
                    active ? "text-accent-cyan" : "text-fg-dim"
                  }`}
                >
                  {item.tag}
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}
          <Link
            href="https://github.com/TestPJkit02/Build-ui-git"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-1 px-2.5 py-1.5 border border-line text-fg-muted hover:text-fg-strong hover:border-line-strong inline-flex items-center gap-1.5"
          >
            <span className="text-fg-dim text-[10px]">↗</span> source
          </Link>
        </nav>

        <div className="order-2 lg:order-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.1em] text-fg-muted ml-auto">
          <span className="hidden md:inline-flex label-tag label-tag-green">
            <span className="status-dot status-dot-green" />
            sources 2/2
          </span>
          <span
            className={`hidden md:inline-flex label-tag ${
              hasToken ? "label-tag-cyan" : "label-tag-amber"
            }`}
          >
            <span
              className={`status-dot ${
                hasToken ? "status-dot-cyan" : "status-dot-amber"
              }`}
            />
            token {hasToken ? "ok" : "off"}
          </span>
          <span className="label-tag font-mono-display tabular-nums">
            <span className="status-dot status-dot-dim" />
            <span suppressHydrationWarning>{stamp}</span>
          </span>
        </div>
      </div>
    </header>
  );
}
