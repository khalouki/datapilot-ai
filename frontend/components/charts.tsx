'use client';
import { chartColors, chartTooltipStyle } from '@/lib/chart-theme';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ScatterChart,
  Scatter,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import type { Row, Correlation } from '@/types';
import { format } from '@/lib/api';
const purple = chartColors[0];
export function Bars({
  data,
  x = 'bin',
  y = 'count',
  horizontal = false,
}: {
  data: object[];
  x?: string;
  y?: string;
  horizontal?: boolean;
}) {
  if (!data.length) return <p className="empty-small">No observed values to chart.</p>;
  return (
    <div className="chart" role="img" aria-label={`Bar chart of ${y} by ${x}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout={horizontal ? 'vertical' : 'horizontal'}
          margin={{ left: horizontal ? 30 : 0, right: 20, bottom: 10 }}
        >
          <CartesianGrid strokeDasharray="3 4" vertical={false} stroke="var(--border)" />
          <XAxis
            type={horizontal ? 'number' : 'category'}
            dataKey={horizontal ? undefined : x}
            tick={{ fontSize: 10, fill: 'var(--muted)' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            type={horizontal ? 'category' : 'number'}
            dataKey={horizontal ? x : undefined}
            width={horizontal ? 110 : 40}
            tick={{ fontSize: 11, fill: 'var(--muted)' }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={chartTooltipStyle}
          />
          <Bar
            isAnimationActive={false}
            dataKey={y}
            fill={purple}
            radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
            maxBarSize={36}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
export function ScatterPlot({ data, x, y }: { data: Row[]; x: string; y: string }) {
  const valid = data.filter((r) => r[x] != null && r[y] != null);
  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ bottom: 18, right: 20 }}>
          <CartesianGrid strokeDasharray="3 4" stroke="var(--border)" />
          <XAxis
            type="number"
            dataKey={x}
            name={x}
            tick={{ fontSize: 11, fill: 'var(--muted)' }}
            label={{ value: x, position: 'insideBottom', offset: -12 }}
          />
          <YAxis type="number" dataKey={y} name={y} tick={{ fontSize: 11, fill: 'var(--muted)' }} width={65} />
          <Tooltip contentStyle={chartTooltipStyle} cursor={{ strokeDasharray: '3 3' }} />
          <Scatter isAnimationActive={false} data={valid} fill={purple} fillOpacity={0.6} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
export function LearningCurve({ data }: { data: object[] }) {
  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 4" stroke="var(--border)" />
          <XAxis dataKey="rows" tick={{ fontSize: 11, fill: 'var(--muted)' }} />
          <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} />
          <Tooltip contentStyle={chartTooltipStyle} />
          <Legend />
          <Line isAnimationActive={false} dataKey="training" stroke={purple} strokeWidth={2} />
          <Line isAnimationActive={false} dataKey="validation" stroke={chartColors[3]} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
export function Heatmap({ data }: { data: Correlation }) {
  if (!data.columns.length)
    return <p className="empty-small">Add numeric columns to calculate correlations.</p>;
  return (
    <div className="table-scroll">
      <table className="heatmap">
        <thead>
          <tr>
            <th></th>
            {data.columns.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.columns.map((c, i) => (
            <tr key={c}>
              <th>{c}</th>
              {data.matrix[i].map((v, j) => (
                <td
                  key={j}
                  title={`${c} / ${data.columns[j]}: ${v ?? 'undefined'}`}
                  style={{
                    background:
                      v == null
                        ? 'var(--soft)'
                        : v >= 0
                          ? `rgba(99,102,241,${0.08 + Math.abs(v) * 0.8})`
                          : `rgba(16,185,129,${0.08 + Math.abs(v) * 0.8})`,
                    color: v != null && Math.abs(v) > 0.7 ? 'white' : 'var(--text)',
                  }}
                >
                  {v == null ? '—' : v.toFixed(2)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="caption">Emerald: negative · Indigo: positive · —: undefined</p>
    </div>
  );
}
export function BoxPlot({ box }: { box: Record<string, number> }) {
  const span = box.max - box.min || 1;
  const px = (v: number) => 40 + ((v - box.min) / span) * 520;
  return (
    <div className="boxplot">
      <svg
        viewBox="0 0 600 125"
        role="img"
        aria-label={`Box plot: median ${format(box.median)}, first quartile ${format(box.q1)}, third quartile ${format(box.q3)}`}
      >
        <line
          x1={px(box.lower)}
          x2={px(box.upper)}
          y1="48"
          y2="48"
          stroke={purple}
          strokeWidth="2"
        />
        {[box.lower, box.upper].map((v, i) => (
          <line key={i} x1={px(v)} x2={px(v)} y1="31" y2="65" stroke={purple} strokeWidth="2" />
        ))}
        <rect
          x={px(box.q1)}
          y="23"
          width={Math.max(2, px(box.q3) - px(box.q1))}
          height="50"
          rx="4"
          fill="var(--purple-soft)"
          stroke={purple}
        />
        <line
          x1={px(box.median)}
          x2={px(box.median)}
          y1="23"
          y2="73"
          stroke={purple}
          strokeWidth="3"
        />
        {[box.min, box.max].map((v, i) => (
          <text key={i} x={px(v)} y="106" textAnchor="middle" fill="var(--muted)" fontSize="12">
            {format(v)}
          </text>
        ))}
      </svg>
      <p className="caption">
        Q1 {format(box.q1)} · Median {format(box.median)} · Q3 {format(box.q3)}. Whiskers end at
        observations within 1.5 × IQR.
      </p>
    </div>
  );
}
