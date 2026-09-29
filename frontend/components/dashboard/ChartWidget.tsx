'use client';
import { chartColors, chartTooltipStyle } from '@/lib/chart-theme';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import type { Visual, VisualResult, Point } from '@/types/dashboard';
const colors = chartColors;
export function ChartWidget({
  visual: v,
  result: r,
  onCross,
}: {
  visual: Visual;
  result: VisualResult;
  onCross: (value: string | number | boolean | null) => void;
}) {
  const points = r.points || [];
  if (!points.length)
    return <div className="bi-no-data">No observed values for this selection.</div>;
  function clicked(item: unknown) {
    const p = (item as { payload?: Point })?.payload || (item as Point);
    if (r.cross_filterable && p && 'key' in p) onCross(p.key ?? null);
  }
  const axes = (
    <>
      <CartesianGrid strokeDasharray="3 4" stroke="var(--border)" vertical={false} />
      <XAxis
        dataKey="label"
        tick={{ fontSize: 10, fill: 'var(--muted)' }}
        axisLine={false}
        tickLine={false}
        minTickGap={12}
      />
      <YAxis
        tick={{ fontSize: 10, fill: 'var(--muted)' }}
        axisLine={false}
        tickLine={false}
        width={48}
      />
      <Tooltip
        contentStyle={chartTooltipStyle}
      />
    </>
  );
  let chart;
  if (v.type === 'pie' || v.type === 'donut')
    chart = (
      <PieChart>
        <Pie
          data={points}
          dataKey="value"
          nameKey="label"
          innerRadius={v.type === 'donut' ? '48%' : 0}
          outerRadius="80%"
          paddingAngle={2}
          isAnimationActive={false}
          onClick={clicked}
          style={{ cursor: 'pointer' }}
        >
          {points.map((_, i) => (
            <Cell key={i} fill={colors[i % colors.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={chartTooltipStyle} />
      </PieChart>
    );
  else if (v.type === 'scatter')
    chart = (
      <ScatterChart margin={{ left: 5, right: 15, bottom: 15 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 4" />
        <XAxis type="number" dataKey="x" name={v.x || 'X'} tick={{ fontSize: 10, fill: 'var(--muted)' }} />
        <YAxis type="number" dataKey="y" name={v.y || 'Y'} tick={{ fontSize: 10, fill: 'var(--muted)' }} width={55} />
        <Tooltip contentStyle={chartTooltipStyle} cursor={{ strokeDasharray: '3 3' }} />
        <Scatter data={points} fill={colors[0]} fillOpacity={0.65} isAnimationActive={false} />
      </ScatterChart>
    );
  else if (v.type === 'horizontal')
    chart = (
      <BarChart data={points} layout="vertical" margin={{ right: 16, left: 15 }}>
        <CartesianGrid stroke="var(--border)" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--muted)' }} />
        <YAxis type="category" dataKey="label" width={90} tick={{ fontSize: 10, fill: 'var(--muted)' }} />
        <Tooltip contentStyle={chartTooltipStyle} />
        <Bar
          dataKey="value"
          fill={colors[0]}
          radius={[0, 3, 3, 0]}
          isAnimationActive={false}
          onClick={clicked}
          cursor="pointer"
        />
      </BarChart>
    );
  else if (v.type === 'line')
    chart = (
      <LineChart data={points} margin={{ right: 15, bottom: 10 }}>
        {axes}
        <Line
          type="linear"
          dataKey="value"
          stroke={colors[0]}
          strokeWidth={2}
          dot={{ r: 3 }}
          isAnimationActive={false}
        />
      </LineChart>
    );
  else if (v.type === 'area')
    chart = (
      <AreaChart data={points} margin={{ right: 15, bottom: 10 }}>
        {axes}
        <Area
          type="linear"
          dataKey="value"
          stroke={colors[0]}
          fill={colors[0]}
          fillOpacity={0.14}
          isAnimationActive={false}
        />
      </AreaChart>
    );
  else
    chart = (
      <BarChart data={points} margin={{ right: 15, bottom: 10 }}>
        {axes}
        <Bar
          dataKey="value"
          fill={colors[0]}
          maxBarSize={44}
          radius={[3, 3, 0, 0]}
          isAnimationActive={false}
          onClick={clicked}
          cursor={r.cross_filterable ? 'pointer' : undefined}
        />
      </BarChart>
    );
  return (
    <>
      <div className="bi-chart" style={{ height: v.height }} role="img" aria-label={v.title}>
        <ResponsiveContainer width="100%" height="100%">
          {chart}
        </ResponsiveContainer>
      </div>
      {r.cross_filterable && (
        <div className="bi-category-buttons" aria-label={`Cross-filter ${v.title}`}>
          {points.map((p, i) => (
            <button
              key={i}
              title={`Filter ${v.x} to ${p.label}`}
              onClick={() => onCross(p.key ?? null)}
            >
              <i
                style={{
                  background:
                    colors[v.type === 'pie' || v.type === 'donut' ? i % colors.length : 0],
                }}
              />
              {p.label}
              <span>{p.value?.toLocaleString(undefined, { maximumFractionDigits: 3 }) ?? '—'}</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
