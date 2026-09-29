import type { DashboardSchema, Visual, VisualType, Aggregation } from '@/types/dashboard';
import { aggregationNames, typeNames, visualTypes } from '@/lib/dashboard/dashboardConfig';
import { recommend } from '@/lib/dashboard/chartRecommendations';
import { SlidersHorizontal, Sparkles } from 'lucide-react';
export function VisualConfigPanel({
  visual: v,
  schema,
  onChange,
}: {
  visual?: Visual;
  schema: DashboardSchema;
  onChange: (patch: Partial<Visual>) => void;
}) {
  const numeric = schema.fields.filter((f) => f.type === 'numeric');
  if (!v)
    return (
      <aside className="bi-side bi-settings">
        <div className="bi-panel-title">
          <SlidersHorizontal size={15} />
          <h3>Configuration</h3>
        </div>
        <p className="bi-empty-small">Select a visual to edit, or add one to your canvas.</p>
      </aside>
    );
  const grouped = !['kpi', 'table', 'scatter', 'histogram'].includes(v.type);
  const suggestions = recommend(
    schema.fields.find((f) => f.name === v.x),
    schema.fields.find((f) => f.name === v.y),
  );
  const measureFields =
    v.aggregation === 'count' || v.aggregation === 'distinct' ? schema.fields : numeric;
  return (
    <aside className="bi-side bi-settings">
      <div className="bi-panel-title">
        <SlidersHorizontal size={15} />
        <h3>Configuration</h3>
      </div>
      <div className="bi-settings-body">
        <label>
          Title
          <input
            maxLength={160}
            value={v.title}
            onChange={(e) => onChange({ title: e.target.value })}
          />
        </label>
        <label>
          Visual type
          <select value={v.type} onChange={(e) => onChange({ type: e.target.value as VisualType })}>
            {visualTypes.map((t) => (
              <option key={t} value={t}>
                {typeNames[t]}
              </option>
            ))}
          </select>
        </label>
        {v.type === 'kpi' && (
          <label>
            KPI metric
            <select
              value={v.metric}
              onChange={(e) => onChange({ metric: e.target.value as Visual['metric'] })}
            >
              {Object.entries({
                rows: 'Total Rows',
                columns: 'Total Columns',
                missing: 'Missing Values',
                duplicates: 'Duplicate Rows',
                column: 'Column aggregation',
              }).map(([key, name]) => (
                <option key={key} value={key}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        )}
        {v.type !== 'kpi' && v.type !== 'table' && (
          <label>
            X-axis / category
            <select value={v.x || ''} onChange={(e) => onChange({ x: e.target.value || null })}>
              <option value="">Select a field</option>
              {schema.fields.map((f) => (
                <option key={f.name} value={f.name}>
                  {f.name} · {f.type}
                </option>
              ))}
            </select>
          </label>
        )}
        {(grouped || (v.type === 'kpi' && v.metric === 'column')) && (
          <label>
            Aggregation
            <select
              value={v.aggregation}
              onChange={(e) => onChange({ aggregation: e.target.value as Aggregation })}
            >
              {Object.entries(aggregationNames).map(([key, name]) => (
                <option key={key} value={key}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        )}
        {(grouped || v.type === 'scatter' || (v.type === 'kpi' && v.metric === 'column')) && (
          <label>
            {v.type === 'kpi' ? 'KPI column' : 'Y-axis / measure'}
            <select value={v.y || ''} onChange={(e) => onChange({ y: e.target.value || null })}>
              <option value="">
                {grouped && v.aggregation === 'count'
                  ? 'Count records (no measure)'
                  : 'Select a field'}
              </option>
              {(v.type === 'scatter' ? numeric : measureFields).map((f) => (
                <option key={f.name}>{f.name}</option>
              ))}
            </select>
          </label>
        )}
        {grouped && (
          <>
            <label>
              Sort
              <select
                value={v.sort}
                onChange={(e) => onChange({ sort: e.target.value as Visual['sort'] })}
              >
                <option value="value_desc">Value · highest first</option>
                <option value="value_asc">Value · lowest first</option>
                <option value="label_asc">X · ascending</option>
                <option value="label_desc">X · descending</option>
              </select>
            </label>
            <label>
              Limit / Top N (1–50)
              <input
                type="number"
                min={1}
                max={50}
                value={v.limit}
                onChange={(e) =>
                  onChange({ limit: Math.max(1, Math.min(50, Number(e.target.value))) })
                }
              />
            </label>
            {schema.fields.find((f) => f.name === v.x)?.type === 'datetime' && (
              <label>
                Date grouping
                <select
                  value={v.time_bucket}
                  onChange={(e) =>
                    onChange({ time_bucket: e.target.value as Visual['time_bucket'] })
                  }
                >
                  {['none', 'day', 'month', 'year'].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
            )}
          </>
        )}
        {v.type === 'histogram' && (
          <label>
            Histogram bins (2–40)
            <input
              type="number"
              min={2}
              max={40}
              value={v.bins}
              onChange={(e) =>
                onChange({ bins: Math.max(2, Math.min(40, Number(e.target.value))) })
              }
            />
          </label>
        )}
        {v.type === 'table' && (
          <fieldset>
            <legend>Table columns</legend>
            {schema.fields.map((f) => (
              <label className="bi-check" key={f.name}>
                <input
                  type="checkbox"
                  checked={v.columns.includes(f.name)}
                  onChange={() =>
                    onChange({
                      columns: v.columns.includes(f.name)
                        ? v.columns.filter((c) => c !== f.name)
                        : [...v.columns, f.name],
                      page: 1,
                      sort_column: null,
                    })
                  }
                />
                {f.name}
              </label>
            ))}
          </fieldset>
        )}
        <div className="bi-setting-row">
          <label>
            Width
            <select
              value={v.width}
              onChange={(e) => onChange({ width: Number(e.target.value) as 1 | 2 })}
            >
              <option value={1}>Half canvas</option>
              <option value={2}>Full canvas</option>
            </select>
          </label>
          <label>
            Height
            <select
              value={v.height}
              onChange={(e) => onChange({ height: Number(e.target.value) as 240 | 340 })}
            >
              <option value={240}>Compact</option>
              <option value={340}>Tall</option>
            </select>
          </label>
        </div>
        {!['kpi', 'table'].includes(v.type) && suggestions.length > 0 && (
          <div className="bi-suggestions">
            <h4>
              <Sparkles size={13} /> Suggested visuals
            </h4>
            {suggestions.map((s) => (
              <div key={s.type}>
                <button className="text-button" onClick={() => onChange({ type: s.type })}>
                  {typeNames[s.type]}
                </button>
                <p>{s.reason}</p>
              </div>
            ))}
          </div>
        )}
        <p className="caption">
          COUNT excludes missing measures. With no measure, it counts records. Numeric aggregates
          exclude missing values. Trends always sort by X.
        </p>
      </div>
    </aside>
  );
}
