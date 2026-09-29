'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Plus,
  Sparkles,
  Save,
  RotateCcw,
  Monitor,
  Minimize2,
  Printer,
  LayoutDashboard,
} from 'lucide-react';
import type { Dataset } from '@/types';
import type {
  DashboardSchema,
  DashboardConfig,
  DashboardResult,
  DashboardFilter,
  Visual,
  VisualType,
} from '@/types/dashboard';
import { api } from '@/lib/api';
import {
  createVisual,
  generateDashboard,
  loadDashboard,
  storageKey,
} from '@/lib/dashboard/dashboardConfig';
import { FieldsPanel } from './FieldsPanel';
import { VisualConfigPanel } from './VisualConfigPanel';
import { FilterBar } from './FilterBar';
import { DashboardCanvas } from './DashboardCanvas';
import { AddVisualDialog } from './AddVisualDialog';
import { Insights } from '@/components/ui';
import { LoadingButton, LoadingSpinner, LoadingState } from '@/components/loading/Loading';
const blank: DashboardConfig = {
  version: 1,
  title: 'My analytics dashboard',
  visuals: [],
  filters: [],
};
export function DashboardBuilder({ dataset, active }: { dataset: Dataset; active: boolean }) {
  const [schema, setSchema] = useState<DashboardSchema | null>(null),
    [config, setConfig] = useState<DashboardConfig>(blank),
    [result, setResult] = useState<DashboardResult | null>(null),
    [selected, setSelected] = useState(''),
    [target, setTarget] = useState<'x' | 'y'>('x'),
    [cross, setCross] = useState<DashboardFilter | null>(null),
    [adding, setAdding] = useState(false),
    [present, setPresent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [dirty, setDirty] = useState(false);
  const loaded = useRef(false);
  const generationLock = useRef(false);
  const [generating, setGenerating] = useState(false);
  const [retry, setRetry] = useState(0);
  const [schemaRetry, setSchemaRetry] = useState(0);
  const key = storageKey(dataset);
  const revision = JSON.stringify(dataset.actions);
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    setError('');
    api<DashboardSchema>(`/dashboard/${dataset.dataset_id}/schema`, { signal: controller.signal })
      .then((s) => {
        if (controller.signal.aborted) return;
        setSchema(s);
        if (!loaded.current) {
          try {
            const saved = loadDashboard(key, s);
            setConfig(saved.config);
            setMessage(saved.message);
            setSelected(saved.config.visuals[0]?.id || '');
          } catch {
            setMessage(
              'Browser storage is unavailable. This dashboard can still be used without saving.',
            );
          }
          loaded.current = true;
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [dataset.dataset_id, revision, active, key, schemaRetry]);
  useEffect(() => {
    if (!active || !schema || !loaded.current) {
      setBusy(false);
      setGenerating(false);
      generationLock.current = false;
      return;
    }
    const controller = new AbortController();
    setBusy(false);
    const timer = setTimeout(
      () => {
        setBusy(true);
        setResult(null);
        setError('');
        api<DashboardResult>(`/dashboard/${dataset.dataset_id}/query`, {
          method: 'POST',
          body: JSON.stringify({
            visuals: config.visuals,
            filters: [...config.filters, ...(cross ? [cross] : [])],
          }),
          signal: controller.signal,
        })
          .then((r) => {
            if (controller.signal.aborted) return;
            setResult(r);
            setError('');
          })
          .catch((e) => {
            if (!controller.signal.aborted) setError(e.message);
          })
          .finally(() => {
            if (!controller.signal.aborted) {
              setBusy(false);
              setGenerating(false);
              generationLock.current = false;
            }
          });
      },
      generationLock.current ? 0 : 350,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [dataset.dataset_id, active, schema, config, cross, retry]);
  useEffect(() => {
    document.body.classList.toggle('bi-presenting', present && active);
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPresent(false);
    };
    window.addEventListener('keydown', escape);
    return () => {
      document.body.classList.remove('bi-presenting');
      window.removeEventListener('keydown', escape);
    };
  }, [present, active]);
  useEffect(() => {
    document.body.classList.toggle('bi-page-active', active);
    return () => document.body.classList.remove('bi-page-active');
  }, [active]);
  function change(next: DashboardConfig) {
    setConfig(next);
    setDirty(true);
    setMessage('');
  }
  function patch(id: string, p: Partial<Visual>) {
    change({ ...config, visuals: config.visuals.map((v) => (v.id === id ? { ...v, ...p } : v)) });
  }
  function add(type: VisualType) {
    if (!schema || config.visuals.length >= 24) return;
    const v = createVisual(type, schema, config.visuals.length);
    change({ ...config, visuals: [...config.visuals, v] });
    setSelected(v.id);
    setAdding(false);
  }
  function move(id: string, d: number) {
    const arr = [...config.visuals];
    const i = arr.findIndex((v) => v.id === id),
      j = i + d;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    change({ ...config, visuals: arr.map((v, i) => ({ ...v, position: i })) });
  }
  function duplicate(id: string) {
    const source = config.visuals.find((v) => v.id === id);
    if (!source || config.visuals.length >= 24) return;
    const v = {
      ...source,
      id: crypto.randomUUID(),
      title: `${source.title} (copy)`,
      position: config.visuals.length,
    };
    change({ ...config, visuals: [...config.visuals, v] });
    setSelected(v.id);
  }
  function save() {
    try {
      localStorage.setItem(key, JSON.stringify(config));
      setMessage(
        'Dashboard saved in this browser. Re-upload the same named dataset and schema to restore it.',
      );
      setDirty(false);
    } catch {
      setError(
        'Could not save: browser storage is unavailable or full. Your current dashboard remains open.',
      );
    }
  }
  if (!schema)
    return (
      <LoadingState
        label="Loading dashboard fields…"
        kind="overview"
        error={error}
        onRetry={() => setSchemaRetry((n) => n + 1)}
      />
    );
  const visual = config.visuals.find((v) => v.id === selected);
  return (
    <div className={`bi-builder ${present ? 'bi-presentation' : ''}`}>
      <div className="bi-toolbar">
        <div>
          <LayoutDashboard size={18} />
          <div>
            <h2>Dashboard workspace</h2>
            <span>
              {dataset.name} · Working dataset ·{' '}
              {dirty ? 'Unsaved changes' : 'Browser configuration'}
            </span>
          </div>
        </div>
        <div className="bi-toolbar-actions">
          <LoadingButton
            className="button bi-edit-only"
            loading={generating}
            loadingText="Generating…"
            onClick={() => {
              if (generationLock.current) return;
              generationLock.current = true;
              setGenerating(true);
              try {
                const generated = generateDashboard(schema);
                change(generated);
                setSelected(generated.visuals[0]?.id || '');
                setCross(null);
              } catch (cause) {
                generationLock.current = false;
                setGenerating(false);
                setError(cause instanceof Error ? cause.message : 'Could not generate the dashboard. Please try again.');
              }
            }}
          >
            <Sparkles size={14} /> Generate Dashboard
          </LoadingButton>
          <button
            className="button bi-edit-only"
            disabled={config.visuals.length >= 24}
            onClick={() => setAdding(true)}
          >
            <Plus size={14} /> Add visual
          </button>
          <button className="button bi-edit-only" onClick={save}>
            <Save size={14} /> Save Dashboard
          </button>
          <button
            className="button bi-edit-only"
            onClick={() => {
              try {
                localStorage.removeItem(key);
                setConfig(blank);
                setSelected('');
                setCross(null);
                setDirty(false);
                setMessage('Dashboard reset. Dataset unchanged.');
              } catch {
                setError('Browser storage is unavailable; saved dashboard could not be reset.');
              }
            }}
          >
            <RotateCcw size={14} /> Reset Dashboard
          </button>
          <button className="button" onClick={() => setPresent(!present)}>
            {present ? <Minimize2 size={14} /> : <Monitor size={14} />}{' '}
            {present ? 'Exit presentation' : 'Presentation Mode'}
          </button>
          <button className="button" disabled={busy || !result} onClick={() => window.print()}>
            <Printer size={14} /> Print / PDF
          </button>
        </div>
      </div>
      {message && (
        <div className="bi-message bi-edit-only" role="status">
          {message}
        </div>
      )}
      {error && (
        <div className="error-banner" role="alert">
          {error}{' '}
          <button className="button" onClick={() => setRetry((n) => n + 1)}>
            Try again
          </button>
        </div>
      )}
      <FilterBar
        datasetId={dataset.dataset_id}
        schema={schema}
        filters={config.filters}
        onChange={(filters) => {
          change({ ...config, filters, visuals: config.visuals.map((v) => ({ ...v, page: 1 })) });
        }}
        cross={cross}
        onClearCross={() => setCross(null)}
      />
      <div className="bi-workspace">
        <FieldsPanel
          fields={schema.fields}
          selected={visual}
          target={target}
          onTarget={setTarget}
          onSelect={(name) => {
            if (visual)
              patch(
                visual.id,
                visual.type === 'table'
                  ? { columns: Array.from(new Set([...visual.columns, name])) }
                  : { [target]: name },
              );
          }}
        />
        <div className="bi-canvas-column">
          <div className="bi-canvas-heading">
            <input
              aria-label="Dashboard title"
              maxLength={160}
              value={config.title}
              onChange={(e) => change({ ...config, title: e.target.value })}
            />
            <h2 className="bi-display-title">{config.title}</h2>
            <span role={busy ? 'status' : undefined} aria-busy={busy}>
              {busy ? (
                <>
                  <LoadingSpinner size={13} /> <span>Updating…</span>
                </>
              ) : result ? (
                `${result.filtered_rows.toLocaleString()} / ${result.total_rows.toLocaleString()} records`
              ) : (
                ''
              )}
            </span>
          </div>
          <DashboardCanvas
            visuals={config.visuals}
            result={result}
            pending={busy || generating}
            error={error}
            selected={selected}
            onSelect={setSelected}
            onChange={patch}
            onDuplicate={duplicate}
            onRemove={(id) => {
              change({ ...config, visuals: config.visuals.filter((v) => v.id !== id) });
              if (selected === id) setSelected('');
            }}
            onMove={move}
            onAdd={() => setAdding(true)}
            onCross={(v, value) => {
              if (!v.x) return;
              setCross(
                cross?.column === v.x && JSON.stringify(cross.values) == JSON.stringify([value])
                  ? null
                  : { column: v.x, kind: 'categorical', values: [value] },
              );
            }}
          />
          {result && (
            <section className="bi-insights">
              <h3>
                <Sparkles size={14} /> Dashboard insights
              </h3>
              <Insights items={result.insights} limit={6} />
            </section>
          )}
        </div>
        <VisualConfigPanel
          visual={visual}
          schema={schema}
          onChange={(p) => {
            if (visual) patch(visual.id, p);
          }}
        />
      </div>
      {adding && <AddVisualDialog onAdd={add} onClose={() => setAdding(false)} />}
      <div className="bi-footnote">
        Shared filters and chart selections use AND logic. Visuals use the working copy; no rows are
        modified. Save stores configuration only. Up to 24 visuals.
      </div>
    </div>
  );
}
