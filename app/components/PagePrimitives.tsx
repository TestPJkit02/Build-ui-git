import type { ReactNode } from "react";

type Tone = "cyan" | "red" | "amber" | "green";

const TONE_LABEL: Record<Tone, string> = {
  cyan: "label-tag-cyan",
  red: "label-tag-red",
  amber: "label-tag-amber",
  green: "label-tag-green",
};

const TONE_DOT: Record<Tone, string> = {
  cyan: "status-dot-cyan",
  red: "status-dot-red",
  amber: "status-dot-amber",
  green: "status-dot-green",
};

export interface PageHeaderProps {
  eyebrow: string;
  title: string;
  subtitle?: ReactNode;
  statusLabel?: string;
  statusTone?: Tone;
  rightSlot?: ReactNode;
}

/** Standard terminal-style page header used across `/`, `/new`, `/news`, `/stats`. */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  statusLabel,
  statusTone = "cyan",
  rightSlot,
}: PageHeaderProps) {
  return (
    <header className="panel">
      <div className="panel-header">
        <span className="flex items-center gap-2">
          <span className="text-accent-cyan">▌</span>
          <span className="tracking-[0.16em]">{eyebrow}</span>
        </span>
        {statusLabel ? (
          <span
            className={`label-tag ${TONE_LABEL[statusTone]} flex items-center gap-1.5`}
          >
            <span className={`status-dot ${TONE_DOT[statusTone]} pulse`} />
            {statusLabel}
          </span>
        ) : null}
      </div>
      <div className="px-4 sm:px-5 py-5 flex flex-wrap items-start gap-4 justify-between">
        <div className="space-y-2 max-w-3xl">
          <h1 className="text-fg-strong text-xl sm:text-2xl font-semibold tracking-[0.04em] uppercase">
            {title}
          </h1>
          {subtitle ? (
            <p className="text-fg-muted text-[12px] tracking-[0.02em] leading-relaxed">
              {subtitle}
            </p>
          ) : null}
        </div>
        {rightSlot ? (
          <div className="text-[11px] text-fg-muted">{rightSlot}</div>
        ) : null}
      </div>
    </header>
  );
}

export interface MetricChipsProps {
  items: { label: string; value: string }[];
}

/** Row of small metric chips below the page header (TRACKED, WINDOW, ...). */
export function MetricChips({ items }: MetricChipsProps) {
  return (
    <ul className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {items.map((it) => (
        <li
          key={it.label}
          className="panel px-3 py-2 flex items-baseline justify-between gap-3"
        >
          <span className="text-[10px] uppercase tracking-[0.12em] text-fg-muted">
            {it.label}
          </span>
          <span className="text-fg-strong font-mono-display text-sm tabular-nums">
            {it.value}
          </span>
        </li>
      ))}
    </ul>
  );
}

export interface DegradedBannerProps {
  headline: string;
  error?: string;
}

/** Red-tinted alert banner used when fallback data is in use. */
export function DegradedBanner({ headline, error }: DegradedBannerProps) {
  return (
    <div role="alert" className="panel border-l-2 border-l-accent-red">
      <div className="px-4 py-3 flex flex-wrap items-start gap-3 text-[12px]">
        <span className="label-tag label-tag-red flex items-center gap-1.5">
          <span className="status-dot status-dot-red pulse" />
          degraded
        </span>
        <div className="flex-1 min-w-[12rem]">
          <p className="uppercase tracking-[0.06em] text-accent-red">{headline}</p>
          {error ? (
            <p className="mt-1 text-fg-muted text-[11px] truncate">({error})</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
