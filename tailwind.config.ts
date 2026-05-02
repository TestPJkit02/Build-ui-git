import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx,js,jsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // CSS vars hold space-separated R G B channels so the `<alpha-value>`
        // placeholder works (e.g. `bg-panel/80` → `rgb(12 18 24 / 0.8)`).
        canvas: "rgb(var(--bg-canvas) / <alpha-value>)",
        panel: "rgb(var(--bg-panel) / <alpha-value>)",
        "panel-elev": "rgb(var(--bg-panel-elev) / <alpha-value>)",
        "panel-hover": "rgb(var(--bg-panel-hover) / <alpha-value>)",
        line: "rgb(var(--border-line) / <alpha-value>)",
        "line-soft": "rgb(var(--border-line-soft) / <alpha-value>)",
        "line-strong": "rgb(var(--border-line-strong) / <alpha-value>)",
        "accent-cyan": "rgb(var(--accent-cyan) / <alpha-value>)",
        "accent-cyan-dim": "rgb(var(--accent-cyan-dim) / <alpha-value>)",
        "accent-red": "rgb(var(--accent-red) / <alpha-value>)",
        "accent-amber": "rgb(var(--accent-amber) / <alpha-value>)",
        "accent-green": "rgb(var(--accent-green) / <alpha-value>)",
        "accent-magenta": "rgb(var(--accent-magenta) / <alpha-value>)",
        "accent-blue": "rgb(var(--accent-blue) / <alpha-value>)",
        "fg-primary": "rgb(var(--text-primary) / <alpha-value>)",
        "fg-strong": "rgb(var(--text-strong) / <alpha-value>)",
        "fg-muted": "rgb(var(--text-muted) / <alpha-value>)",
        "fg-dim": "rgb(var(--text-dim) / <alpha-value>)",
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
