"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Category } from "@/lib/types";

interface CategoryRow {
  category: Category;
  repos: number;
  stars: number;
}

interface CumulativeRow {
  date: string;
  stars: number;
}

const PALETTE = {
  cyan: "#36e6d8",
  green: "#4ade80",
  amber: "#f4c54f",
  red: "#ff4d6d",
  magenta: "#ff5fb3",
  blue: "#60a5fa",
  panel: "#0c1218",
  line: "#1a2530",
  text: "#cfd8dc",
  muted: "#6b7d8c",
} as const;

const TICK_STYLE = {
  fontFamily:
    "var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: 10,
  fill: PALETTE.muted,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
} as const;

const TOOLTIP_STYLE = {
  backgroundColor: PALETTE.panel,
  border: `1px solid ${PALETTE.line}`,
  borderRadius: 4,
  color: PALETTE.text,
  fontFamily:
    "var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: 11,
  padding: "6px 10px",
} as const;

export default function StatsCharts({
  categoryRows,
  cumulative,
}: {
  categoryRows: CategoryRow[];
  cumulative: CumulativeRow[];
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="panel">
        <div className="panel-header">
          <span className="flex items-center gap-2">
            <span className="status-dot status-dot-cyan" />
            <span>stars by category</span>
          </span>
          <span className="label-tag">stargazers sum</span>
        </div>
        <div className="px-4 pt-3 pb-4">
          <p className="text-[10px] uppercase tracking-[0.1em] text-fg-muted mb-3">
            sum of stargazers across tracked repos.
          </p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={categoryRows}
                margin={{ top: 6, right: 6, left: -6, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="2 4"
                  stroke={PALETTE.line}
                  vertical={false}
                />
                <XAxis
                  dataKey="category"
                  tick={TICK_STYLE}
                  tickLine={false}
                  axisLine={{ stroke: PALETTE.line }}
                />
                <YAxis
                  tick={TICK_STYLE}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  cursor={{ fill: PALETTE.line, opacity: 0.4 }}
                  labelStyle={{ color: PALETTE.muted }}
                  itemStyle={{ color: PALETTE.cyan }}
                />
                <Bar dataKey="stars" fill={PALETTE.cyan} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      <div className="panel">
        <div className="panel-header">
          <span className="flex items-center gap-2">
            <span className="status-dot status-dot-green" />
            <span>cumulative stars · update timeline</span>
          </span>
          <span className="label-tag">timeseries</span>
        </div>
        <div className="px-4 pt-3 pb-4">
          <p className="text-[10px] uppercase tracking-[0.1em] text-fg-muted mb-3">
            each repo contributes its stars on its last-pushed date.
          </p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={cumulative}
                margin={{ top: 6, right: 6, left: -6, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="grad-stars" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={PALETTE.green} stopOpacity={0.45} />
                    <stop offset="95%" stopColor={PALETTE.green} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="2 4"
                  stroke={PALETTE.line}
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tick={TICK_STYLE}
                  tickLine={false}
                  axisLine={{ stroke: PALETTE.line }}
                />
                <YAxis
                  tick={TICK_STYLE}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  cursor={{ stroke: PALETTE.cyan, strokeOpacity: 0.5 }}
                  labelStyle={{ color: PALETTE.muted }}
                  itemStyle={{ color: PALETTE.green }}
                />
                <Area
                  type="monotone"
                  dataKey="stars"
                  stroke={PALETTE.green}
                  strokeWidth={1.5}
                  fill="url(#grad-stars)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
