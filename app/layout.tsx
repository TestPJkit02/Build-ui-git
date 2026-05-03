import "./globals.css";
import Link from "next/link";
import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import { Header } from "./components/Header";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AI REPO MONITOR — trending AI repos & news",
  description:
    "Intelligence terminal tracking trending AI repos on GitHub and the latest AI news, ranked by stars, forks and recency.",
};

const HAS_TOKEN = Boolean(process.env.GITHUB_TOKEN);

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jetbrainsMono.variable}>
      <body className="font-mono min-h-screen text-fg-primary text-[13px] leading-relaxed">
        <Header hasToken={HAS_TOKEN} />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">{children}</main>
        <footer className="border-t border-line mt-16 bg-panel/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 text-[10px] tracking-[0.12em] uppercase text-fg-muted flex flex-wrap items-center justify-between gap-2">
            <span>
              <span className="text-fg-dim">▌</span> built with{" "}
              <Link
                href="https://github.com/VibecodekitPJ8/vibecodekit-hybrid-ultra"
                className="text-fg-primary hover:text-accent-cyan"
                target="_blank"
                rel="noopener noreferrer"
              >
                VibecodeKit Hybrid Ultra v0.22.0
              </Link>
            </span>
            <span>
              data:{" "}
              <Link
                href="https://docs.github.com/en/rest/search"
                className="text-fg-primary hover:text-accent-cyan"
                target="_blank"
                rel="noopener noreferrer"
              >
                github search api
              </Link>{" "}
              ·{" "}
              <Link
                href="https://hn.algolia.com/api"
                className="text-fg-primary hover:text-accent-cyan"
                target="_blank"
                rel="noopener noreferrer"
              >
                hacker news
              </Link>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="status-dot status-dot-cyan pulse" />
              terminal active
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
