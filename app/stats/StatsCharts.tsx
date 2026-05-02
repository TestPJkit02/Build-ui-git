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

export default function StatsCharts({
  categoryRows,
  cumulative,
}: {
  categoryRows: CategoryRow[];
  cumulative: CumulativeRow[];
}) {
  return (
    <div className="mt-10 grid gap-6 lg:grid-cols-2">
      <div className="rounded-lg border bg-white p-4">
        <h2 className="font-semibold">Stars by category</h2>
        <p className="text-xs text-slate-500 mt-1">Sum of stargazers across tracked repos.</p>
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={categoryRows}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="category" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="stars" fill="#2563eb" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="rounded-lg border bg-white p-4">
        <h2 className="font-semibold">Cumulative stars over update timeline</h2>
        <p className="text-xs text-slate-500 mt-1">
          Each repo contributes its stars on its last-pushed date.
        </p>
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={cumulative}>
              <defs>
                <linearGradient id="grad-stars" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Area type="monotone" dataKey="stars" stroke="#10b981" fill="url(#grad-stars)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
