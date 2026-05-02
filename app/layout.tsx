import "./globals.css";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Repo Tracker — trending AI repos & news",
  description:
    "Dashboard to track trending AI repos on GitHub and the latest AI news, ranked by stars, forks and recency.",
};

const NAV_ITEMS: { href: string; label: string }[] = [
  { href: "/", label: "Repos" },
  { href: "/new", label: "New" },
  { href: "/news", label: "News" },
  { href: "/stats", label: "Stats" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 min-h-screen">
        <header className="border-b bg-white">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link href="/" className="font-bold text-lg">
              AI Repo Tracker
            </Link>
            <nav className="flex gap-6 text-sm">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-slate-600 hover:text-slate-900"
                >
                  {item.label}
                </Link>
              ))}
              <a
                href="https://github.com/TestPJkit02/Build-ui-git"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-600 hover:text-slate-900"
              >
                Source
              </a>
            </nav>
          </div>
        </header>
        <main>{children}</main>
        <footer className="border-t bg-white mt-16">
          <div className="max-w-6xl mx-auto px-6 py-6 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-2">
            <span>
              Built with{" "}
              <a
                href="https://github.com/VibecodekitPJ8/vibecodekit-hybrid-ultra"
                className="underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                VibecodeKit Hybrid Ultra
              </a>
              .
            </span>
            <span>
              Inspired by{" "}
              <a
                href="https://goodailist.com/"
                className="underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                goodailist.com
              </a>
              . Data: GitHub Search API + Hacker News.
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
