import { Hash, CalendarDays, ToggleLeft, Text, Database } from 'lucide-react';
import type { Field, Visual } from '@/types/dashboard';
const groups = [
  { type: 'numeric', name: 'Numeric', icon: Hash },
  { type: 'categorical', name: 'Categorical', icon: Text },
  { type: 'datetime', name: 'Datetime', icon: CalendarDays },
  { type: 'boolean', name: 'Boolean', icon: ToggleLeft },
];
export function FieldsPanel({
  fields,
  selected,
  target,
  onTarget,
  onSelect,
}: {
  fields: Field[];
  selected?: Visual;
  target: 'x' | 'y';
  onTarget: (t: 'x' | 'y') => void;
  onSelect: (name: string) => void;
}) {
  return (
    <aside className="bi-side bi-fields">
      <div className="bi-panel-title">
        <Database size={15} />
        <h3>Dataset fields</h3>
        <span>{fields.length}</span>
      </div>
      <div className="bi-field-target">
        <span>Click a field to assign</span>
        <div>
          {(['x', 'y'] as const).map((t) => (
            <button
              key={t}
              aria-pressed={target === t}
              className={target === t ? 'selected' : ''}
              onClick={() => onTarget(t)}
            >
              {t === 'x' ? 'X / category' : 'Y / measure'}
            </button>
          ))}
        </div>
      </div>
      {groups.map((g) => (
        <div className="bi-field-group" key={g.type}>
          <h4>
            <g.icon size={12} />
            {g.name}
            <span>{fields.filter((f) => f.type === g.type).length}</span>
          </h4>
          {fields
            .filter((f) => f.type === g.type)
            .map((f) => (
              <button
                key={f.name}
                disabled={!selected}
                className={selected?.[target] === f.name ? 'selected' : ''}
                title={`${f.name} · ${f.unique} unique · ${f.missing} missing`}
                onClick={() => onSelect(f.name)}
              >
                <g.icon size={13} />
                <span>{f.name}</span>
              </button>
            ))}
        </div>
      ))}
    </aside>
  );
}
