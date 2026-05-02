import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx,js,jsx,mdx}"],
  theme: {
    extend: {
      colors: {
        canvas: "var(--bg-canvas)",
        panel: "var(--bg-panel)",
        "panel-elev": "var(--bg-panel-elev)",
        "panel-hover": "var(--bg-panel-hover)",
        line: "var(--border-line)",
        "line-soft": "var(--border-line-soft)",
        "line-strong": "var(--border-line-strong)",
        "accent-cyan": "var(--accent-cyan)",
        "accent-cyan-dim": "var(--accent-cyan-dim)",
        "accent-red": "var(--accent-red)",
        "accent-amber": "var(--accent-amber)",
        "accent-green": "var(--accent-green)",
        "accent-magenta": "var(--accent-magenta)",
        "accent-blue": "var(--accent-blue)",
        "fg-primary": "var(--text-primary)",
        "fg-strong": "var(--text-strong)",
        "fg-muted": "var(--text-muted)",
        "fg-dim": "var(--text-dim)",
      },
      fontFamily: {
        mono: [
          "var(--font-jetbrains-mono)",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
      },
    },
  },
  plugins: [],
};
export default config;
