import { useEffect, useState } from 'react';
import { LoadingSpinner } from '@/components/loading/Loading';
import { Filter, X } from 'lucide-react';
import type { DashboardFilter, DashboardSchema, Option } from '@/types/dashboard';
import { api } from '@/lib/api';
export function FilterBar({
  datasetId,
  schema,
  filters,
  onChange,
  cross,
  onClearCross,
}: {
  datasetId: string;
  schema: DashboardSchema;
  filters: DashboardFilter[];
  onChange: (f: DashboardFilter[]) => void;
  cross: DashboardFilter | null;
  onClearCross: () => void;
}) {
  const [selected, setSelected] = useState('');
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<Option[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const field = schema.fields.find((f) => f.name === selected);
  const current = filters.find((f) => f.column === selected);
  useEffect(() => {
    setPending(false);
    setError('');
    if (!field || !['categorical', 'boolean'].includes(field.type)) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setPending(true);
      api<{ options: Option[]; truncated: boolean }>(
        `/dashboard/${datasetId}/values?column=${encodeURIComponent(field.name)}&search=${encodeURIComponent(search)}`,
        { signal: controller.signal },
      )
        .then((r) => {
          if (controller.signal.aborted) return;
          setOptions(r.options);
          setTruncated(r.truncated);
          setError('');
        })
        .catch((e) => {
          if (!controller.signal.aborted) setError(e.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setPending(false);
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [datasetId, field, search]);
  function update(patch: Partial<DashboardFilter>) {
    if (!field) return;
    const next = { column: field.name, kind: field.type, ...current, ...patch };
    const active =
      next.values?.length || next.minimum != null || next.maximum != null || next.start || next.end;
    onChange([...filters.filter((f) => f.column !== selected), ...(active ? [next] : [])]);
  }
  return (
    <section className="bi-filters" aria-label="Dashboard filters">
      <div className="bi-filter-top bi-edit-only">
        <strong>
          <Filter size={14} /> Shared filters
        </strong>
        <select
          aria-label="Filter field"
          value={selected}
          onChange={(e) => {
            setSelected(e.target.value);
            setSearch('');
            setOptions([]);
          }}
        >
          <option value="">Choose a field to filter</option>
          {schema.fields.map((f) => (
            <option key={f.name}>{f.name}</option>
          ))}
        </select>
        {(filters.length > 0 || cross) && (
          <button
            className="text-button"
            onClick={() => {
              onChange([]);
              onClearCross();
            }}
          >
            Clear all filters
          </button>
        )}
      </div>
      {field && (
        <div className="bi-filter-editor bi-edit-only">
          <strong>{field.name}</strong>
          {field.type === 'categorical' ? (
            <>
              <input
                aria-label="Search filter values"
                placeholder="Search available values…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                multiple
                aria-label={`Values for ${field.name}`}
                value={(current?.values || []).map((v) => JSON.stringify(v))}
                onChange={(e) =>
                  update({
                    values: Array.from(e.target.selectedOptions).map((o) => JSON.parse(o.value)),
                  })
                }
              >
                {options.map((o) => (
                  <option key={JSON.stringify(o.value)} value={JSON.stringify(o.value)}>
                    {o.label} ({o.count})
                  </option>
                ))}
              </select>
              <span className="caption">
                Ctrl / Cmd to select multiple. Empty selection means all.
                {truncated ? ' Showing 100 matches; search to find more.' : ''}
              </span>
            </>
          ) : field.type === 'boolean' ? (
            <select
              aria-label={`Values for ${field.name}`}
              value={JSON.stringify(current?.values || [])}
              onChange={(e) => update({ values: JSON.parse(e.target.value) })}
            >
              <option value="[]">All</option>
              <option value="[true]">True</option>
              <option value="[false]">False</option>
              <option value="[null]">Missing</option>
            </select>
          ) : field.type === 'numeric' ? (
            <>
              <input
                aria-label={`Minimum ${field.name}`}
                type="number"
                placeholder={String(field.minimum ?? 'Minimum')}
                value={current?.minimum ?? ''}
                onChange={(e) =>
                  update({ minimum: e.target.value === '' ? null : Number(e.target.value) })
                }
              />
              <span>to</span>
              <input
                aria-label={`Maximum ${field.name}`}
                type="number"
                placeholder={String(field.maximum ?? 'Maximum')}
                value={current?.maximum ?? ''}
                onChange={(e) =>
                  update({ maximum: e.target.value === '' ? null : Number(e.target.value) })
                }
              />
            </>
          ) : (
            <>
              <input
                aria-label={`Start ${field.name}`}
                type="date"
                value={current?.start || ''}
                onChange={(e) => update({ start: e.target.value || null })}
              />
              <span>through</span>
              <input
                aria-label={`End ${field.name}`}
                type="date"
                value={current?.end || ''}
                onChange={(e) => update({ end: e.target.value || null })}
              />
            </>
          )}
          {current && (
            <button
              className="text-button"
              onClick={() => onChange(filters.filter((f) => f.column !== selected))}
            >
              Clear filter
            </button>
          )}
          {pending && (
            <span role="status">
              <LoadingSpinner size={13} /> Loading filter values…
            </span>
          )}
          {error && <span role="alert">{error}</span>}
        </div>
      )}
      <div className="bi-active-filters">
        {filters.map((f) => (
          <button
            key={f.column}
            onClick={() => onChange(filters.filter((x) => x.column !== f.column))}
          >
            {f.column}:{' '}
            {f.values?.map((v) => (v === null ? 'Missing' : String(v))).join(', ') ||
              `${f.minimum ?? f.start ?? 'Any'} → ${f.maximum ?? f.end ?? 'Any'}`}
            <X size={12} />
            <span className="sr-only">Clear filter</span>
          </button>
        ))}
        {cross && (
          <button className="bi-cross" onClick={onClearCross}>
            Chart selection · {cross.column}:{' '}
            {cross.values?.map((v) => (v === null ? 'Missing' : String(v))).join(', ')}
            <X size={12} />
          </button>
        )}
        {!filters.length && !cross && (
          <span className="caption">
            All records · Click a bar or slice to cross-filter the dashboard.
          </span>
        )}
      </div>
    </section>
  );
}
