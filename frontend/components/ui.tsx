import type { ReactNode } from 'react';
import type { Row, Profile, Insight } from '@/types';
import { format } from '@/lib/api';
import { Rows3, Columns3, CircleDashed, Copy, ArrowUpRight, Sparkles, Info } from 'lucide-react';
export function Panel({
  title,
  subtitle,
  action,
  children,
  className = '',
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-head">
        <div>
          <h3>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
export function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="notice">
      <Info size={17} />
      <div>{children}</div>
    </div>
  );
}
export function Stats({ p }: { p: Profile }) {
  return (
    <div className="stats-grid">
      {[
        {
          label: 'Total rows',
          value: p.rows,
          detail: 'Observations in your dataset',
          icon: Rows3,
        },
        {
          label: 'Columns',
          value: p.columns_count,
          detail: `${p.numeric_columns.length} numeric · ${p.categorical_columns.length} categorical`,
          icon: Columns3,
        },
        {
          label: 'Missing values',
          value: p.missing_values,
          detail: `${format(p.missing_percentage)}% of all cells`,
          icon: CircleDashed,
        },
        {
          label: 'Duplicate rows',
          value: p.duplicates,
          detail: p.duplicates ? 'Review before removing' : 'No repeated rows detected',
          icon: Copy,
        },
      ].map((c, i) => (
        <div className={`stat-card ${i >= 2 && c.value > 0 ? 'stat-attention' : ''}`} key={c.label}>
          <div className="stat-top">
            <span>{c.label}</span>
            <c.icon size={17} />
          </div>
          <strong>{format(c.value, 0)}</strong>
          <div className={`stat-detail ${i === 2 && p.missing_values ? 'amber' : ''}`}>
            {c.detail}
          </div>
        </div>
      ))}
    </div>
  );
}
export function DataTable({
  rows,
  columns,
  limit = 10,
}: {
  rows: Row[];
  columns?: string[];
  limit?: number;
}) {
  const names = columns || Object.keys(rows[0] || {});
  return rows.length ? (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th className="row-index">#</th>
            {names.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, limit).map((r, i) => (
            <tr key={i}>
              <td className="row-index">{i + 1}</td>
              {names.map((c) => (
                <td key={c}>
                  {r[c] == null ? (
                    <span className="null" aria-label="Missing value">NULL</span>
                  ) : typeof r[c] === 'number' ? (
                    format(r[c] as number, 3)
                  ) : (
                    String(r[c])
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <p className="empty-small">No rows to display.</p>
  );
}
export function Insights({ items, limit = 5 }: { items: Insight[]; limit?: number }) {
  return (
    <div className="insight-list">
      {items.slice(0, limit).map((x, i) => (
        <div className="insight" key={i}>
          <span className={`insight-icon ${x.level}`}>
            <Sparkles size={15} />
          </span>
          <div>
            <h4>{x.title}</h4>
            <p>{x.detail}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
export function Quality({ p, onReview }: { p: Profile; onReview?: () => void }) {
  const score = p.quality.score;
  return (
    <Panel
      title="Data quality"
      subtitle="A clearer picture of your data"
      action={<span className="tag">Heuristic score</span>}
    >
      <div className="quality-body">
        <div
          className="score-ring"
          role="meter"
          aria-label="Data quality heuristic score"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={score}
          style={{
            background: `conic-gradient(var(${score >= 90 ? '--success' : score >= 70 ? '--warning' : '--danger'}) ${score}%, var(--soft) 0)`,
          }}
        >
          <div>
            <strong>{format(score)}</strong>
            <span>out of 100</span>
          </div>
        </div>
        <div className="quality-text">
          <span className={`badge ${score >= 90 ? 'green' : score >= 70 ? 'orange' : 'red'}`}>
            {score >= 90 ? 'Looking healthy' : score >= 70 ? 'Room to improve' : 'Needs attention'}
          </span>
          <p>
            {p.missing_values || p.duplicates
              ? 'A few thoughtful decisions can improve your dataset.'
              : 'The basic checks found few issues. Always review context.'}
          </p>
          {onReview && (
            <button className="text-button" onClick={onReview}>
              Review data quality <ArrowUpRight size={14} />
            </button>
          )}
        </div>
      </div>
      <div className="quality-footer">Project-defined heuristic, not an industry standard. No automatic changes.</div>
    </Panel>
  );
}
