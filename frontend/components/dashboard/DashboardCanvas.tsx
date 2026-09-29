import { LayoutDashboard, Plus } from 'lucide-react';
import type { Visual, DashboardResult } from '@/types/dashboard';
import { DashboardWidget } from './DashboardWidget';
export function DashboardCanvas({
  visuals,
  result,
  pending,
  error,
  selected,
  onSelect,
  onChange,
  onDuplicate,
  onRemove,
  onMove,
  onCross,
  onAdd,
}: {
  visuals: Visual[];
  result: DashboardResult | null;
  pending: boolean;
  error: string;
  selected: string;
  onSelect: (id: string) => void;
  onChange: (id: string, p: Partial<Visual>) => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, d: number) => void;
  onCross: (v: Visual, value: string | number | boolean | null) => void;
  onAdd: () => void;
}) {
  if (!visuals.length)
    return (
      <div className="bi-empty">
        <LayoutDashboard size={32} />
        <h3>Your canvas, your questions.</h3>
        <p>Generate a dashboard from this dataset, or start with one visual.</p>
        <button className="button" onClick={onAdd}>
          <Plus size={15} /> Add your first visual
        </button>
      </div>
    );
  return (
    <div className="bi-canvas">
      {visuals.map((v) => (
        <DashboardWidget
          key={v.id}
          visual={v}
          result={result?.results[v.id]}
          pending={pending}
          error={error}
          selected={selected === v.id}
          onSelect={() => onSelect(v.id)}
          onChange={(p) => onChange(v.id, p)}
          onDuplicate={() => onDuplicate(v.id)}
          onRemove={() => onRemove(v.id)}
          onMove={(d) => onMove(v.id, d)}
          onCross={(value) => onCross(v, value)}
        />
      ))}
    </div>
  );
}
