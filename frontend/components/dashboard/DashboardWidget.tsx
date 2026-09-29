import { LoadingState } from '@/components/loading/Loading';
import { Copy, Trash2, ArrowUp, ArrowDown, SlidersHorizontal } from 'lucide-react';
import type { Visual, VisualResult } from '@/types/dashboard';
import { format } from '@/lib/api';
import { ChartWidget } from './ChartWidget';
import { TableWidget } from './TableWidget';
export function DashboardWidget({
  visual: v,
  result: r,
  pending,
  error,
  selected,
  onSelect,
  onChange,
  onDuplicate,
  onRemove,
  onMove,
  onCross,
}: {
  visual: Visual;
  result?: VisualResult;
  pending: boolean;
  error: string;
  selected: boolean;
  onSelect: () => void;
  onChange: (p: Partial<Visual>) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onMove: (d: number) => void;
  onCross: (value: string | number | boolean | null) => void;
}) {
  return (
    <section
      className={`bi-widget ${v.type === 'kpi' ? 'bi-kpi' : ''} ${selected ? 'selected' : ''} ${v.width === 2 ? 'bi-wide' : ''}`}
      aria-label={v.title}
      onClick={onSelect}
    >
      <header>
        <h3>{v.title || 'Untitled visual'}</h3>
        <div className="bi-widget-actions bi-edit-only">
          <button title="Edit visual" aria-label={`Edit ${v.title}`} onClick={onSelect}>
            <SlidersHorizontal size={12} />
          </button>
          <button
            aria-label={`Move ${v.title} earlier`}
            onClick={(e) => {
              e.stopPropagation();
              onMove(-1);
            }}
          >
            <ArrowUp size={12} />
          </button>
          <button
            aria-label={`Move ${v.title} later`}
            onClick={(e) => {
              e.stopPropagation();
              onMove(1);
            }}
          >
            <ArrowDown size={12} />
          </button>
          <button
            aria-label={`Duplicate ${v.title}`}
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate();
            }}
          >
            <Copy size={12} />
          </button>
          <button
            aria-label={`Remove ${v.title}`}
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </header>
      {!r ? (
        pending ? (
          <LoadingState kind="widget" announce={false} />
        ) : (
          <div className="bi-no-data">
            {error
              ? 'Unable to load this visual. Use Try again above.'
              : 'Waiting for dashboard data…'}
          </div>
        )
      ) : r.error ? (
        <div className="bi-widget-error" role="alert">
          {r.error}
        </div>
      ) : v.type === 'kpi' ? (
        <div className="bi-kpi-body">
          <strong data-testid="kpi-value">{format(r.value, 3)}</strong>
          <span>
            {v.metric === 'column'
              ? `${v.aggregation} · ${v.y || 'Select a column'}`
              : 'Current filtered dataset'}
          </span>
        </div>
      ) : v.type === 'table' ? (
        <TableWidget visual={v} result={r} onChange={onChange} />
      ) : (
        <ChartWidget visual={v} result={r} onCross={onCross} />
      )}{' '}
      {r?.note && (
        <p className="bi-widget-note" title={r.note}>
          {r.note}
        </p>
      )}
    </section>
  );
}
