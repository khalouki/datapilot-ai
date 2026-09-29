'use client';
import Link from 'next/link';
import { useEffect, useRef, useState, type DragEvent } from 'react';
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  FileSpreadsheet,
  FlaskConical,
  GitBranch,
  LayoutDashboard,
  Menu,
  Moon,
  Network,
  Plus,
  RotateCcw,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Sun,
  Upload,
  WandSparkles,
  X,
} from 'lucide-react';
import type { Dataset, EDA, Correlation, Outlier, ML, Anomaly, Report, Profile } from '@/types';
import {
  LoadingButton,
  LoadingSpinner,
  LoadingState,
  LoadingOverlay,
} from '@/components/loading/Loading';
import { DownloadButton } from '@/components/loading/DownloadButton';
import { DashboardBuilder } from '@/components/dashboard/DashboardBuilder';
import { api, post, format } from '@/lib/api';
import { Bars, ScatterPlot, Heatmap, BoxPlot, LearningCurve } from '@/components/charts';
import { Panel, Notice, Stats, DataTable, Insights, Quality } from '@/components/ui';
const sections = [
  { name: 'Overview', icon: LayoutDashboard },
  { name: 'Data Quality', icon: ShieldCheck },
  { name: 'Cleaning', icon: WandSparkles },
  { name: 'EDA', icon: BarChart3 },
  { name: 'Correlations', icon: Network },
  { name: 'Outliers', icon: ScanLine },
  { name: 'Machine Learning', icon: FlaskConical },
  { name: 'Anomalies', icon: Activity },
  { name: 'Dashboard Builder', icon: LayoutDashboard },
  { name: 'Report', icon: BookOpen },
];
const navigationGroups: Record<number, string> = {
  0: 'Workspace',
  3: 'Analysis',
  6: 'Intelligence',
  8: 'Business intelligence',
  9: 'Output',
};
const descriptions: Record<string, string> = {
  Overview: 'Your dataset, at a glance. Explore the signals and decide what comes next.',
  'Data Quality': 'Understand what needs attention, and exactly how the score is calculated.',
  Cleaning: 'Make informed changes. You stay in control of every transformation.',
  EDA: 'Explore distributions, patterns, and relationships in your data.',
  Correlations: 'Discover how your numeric features move together.',
  Outliers: 'Unusual does not mean incorrect. Review potential extremes in context.',
  'Machine Learning': 'Start with transparent baselines and honest evaluation.',
  Anomalies: 'Find unusual combinations across your numeric features.',
  'Dashboard Builder':
    'Turn your working dataset into an interactive business intelligence dashboard.',
  Report: 'The complete story of your analysis, ready to share.',
};
type Action = { strategy: string; value?: string | number };
export default function Dashboard() {
  const [dataset, setDataset] = useState<Dataset | null>(null),
    [tab, setTab] = useState('Overview'),
    [busy, setBusy] = useState(''),
    [error, setError] = useState(''),
    [uploadOpen, setUploadOpen] = useState(false),
    [dragging, setDragging] = useState(false),
    [dark, setDark] = useState(false),
    [mobile, setMobile] = useState(false);
  const [navBusy, setNavBusy] = useState(''),
    [navError, setNavError] = useState(''),
    [navRetry, setNavRetry] = useState(0);
  const navigationCache = useRef(new Map<string, unknown>());
  const actionInFlight = useRef(false);
  const themeExplicit = useRef(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const [eda, setEda] = useState<EDA | null>(null),
    [corr, setCorr] = useState<Correlation | null>(null),
    [outliers, setOutliers] = useState<Outlier[] | null>(null),
    [ml, setMl] = useState<ML | null>(null),
    [anomaly, setAnomaly] = useState<Anomaly | null>(null),
    [report, setReport] = useState<Report | null>(null);
  const [method, setMethod] = useState('pearson'),
    [threshold, setThreshold] = useState(0.7),
    [selected, setSelected] = useState(''),
    [scatterY, setScatterY] = useState('');
  const [actions, setActions] = useState<Record<string, Action>>({}),
    [removeDup, setRemoveDup] = useState(false),
    [dropCols, setDropCols] = useState<string[]>([]),
    [conversions, setConversions] = useState<Record<string, string>>({}),
    [order, setOrder] = useState(''),
    [zero, setZero] = useState(false);
  const [target, setTarget] = useState(''),
    [task, setTask] = useState('classification'),
    [suggestions, setSuggestions] = useState<Record<string, string>>({}),
    [scale, setScale] = useState(true),
    [exclude, setExclude] = useState<string[]>([]),
    [testSize, setTestSize] = useState(0.2),
    [contamination, setContamination] = useState(0.05),
    [previewCount, setPreviewCount] = useState(10),
    [toast, setToast] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const id = dataset?.dataset_id;
  const p = dataset?.profile;
  useEffect(() => {
    setDark(document.documentElement.dataset.theme === 'dark');
    try {
      const saved = localStorage.getItem('datapilot-theme');
      themeExplicit.current = saved === 'light' || saved === 'dark';
    } catch { /* System preference remains available without browser storage. */ }
    const system = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => {
      if (themeExplicit.current) return;
      document.documentElement.dataset.theme = system.matches ? 'dark' : 'light';
      setDark(system.matches);
    };
    system.addEventListener('change', update);
    return () => system.removeEventListener('change', update);
  }, []);
  function toggleTheme() {
    themeExplicit.current = true;
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? 'dark' : 'light';
    try {
      localStorage.setItem('datapilot-theme', next ? 'dark' : 'light');
    } catch {
      /* Theme still works when storage is unavailable. */
    }
  }
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1025px)');
    const close = () => {
      if (desktop.matches) setMobile(false);
    };
    desktop.addEventListener('change', close);
    return () => desktop.removeEventListener('change', close);
  }, []);
  useEffect(() => {
    if (!mobile) return;
    const previous = document.activeElement as HTMLElement | null;
    document.body.classList.add('navigation-open');
    sidebarRef.current?.querySelector<HTMLButtonElement>('.sidebar-close')?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobile(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const items = Array.from(
        sidebarRef.current?.querySelectorAll<HTMLElement>(
          'a[href],button:not(:disabled),[tabindex="0"]',
        ) || [],
      ).filter((el) => el.getClientRects().length);
      const first = items[0],
        last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener('keydown', keyboard);
    return () => {
      document.body.classList.remove('navigation-open');
      window.removeEventListener('keydown', keyboard);
      previous?.focus();
    };
  }, [mobile]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 4500);
    return () => clearTimeout(t);
  }, [toast]);
  function initialize(d: Dataset) {
    navigationCache.current.clear();
    setNavError('');
    if (id && id !== d.dataset_id) {
      // Release the previous session only after its replacement was accepted.
      void api(`/datasets/${id}`, { method: 'DELETE' }).catch(() => undefined);
    }
    setDataset(d);
    setActions(
      Object.fromEntries(
        d.profile.recommendations.map((r) => [r.column, { strategy: r.recommended_strategy }]),
      ),
    );
    setEda(null);
    setCorr(null);
    setOutliers(null);
    setAnomaly(null);
    setReport(null);
    setRemoveDup(false);
    setDropCols([]);
    setConversions({});
    setOrder('');
    setZero(false);
    setSelected('');
    setScatterY('');
  }
  async function run(label: string, fn: () => Promise<void>) {
    if (actionInFlight.current) return;
    actionInFlight.current = true;
    setBusy(label);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please retry.');
    } finally {
      actionInFlight.current = false;
      setBusy('');
    }
  }
  async function upload(file?: File) {
    if (!file || actionInFlight.current) return;
    if (!/\.(csv|xlsx)$/i.test(file.name)) {
      setError('Choose a CSV or XLSX file.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('The file exceeds the 10 MB limit.');
      return;
    }
    await run('Profiling your dataset', async () => {
      const body = new FormData();
      body.append('file', file);
      const d = await api<Dataset>('/upload', { method: 'POST', body });
      initialize(d);
      setMl(null);
      setTarget('');
      setExclude([]);
      setUploadOpen(false);
      setTab('Overview');
      setToast('Dataset uploaded. Your original data is preserved.');
    });
  }
  async function example(type: string) {
    await run('Preparing example dataset', async () => {
      initialize(await post<Dataset>(`/examples/${type}`));
      setMl(null);
      setTarget('');
      setExclude([]);
      setUploadOpen(false);
      setTab('Overview');
    });
  }
  useEffect(() => {
    setNavBusy('');
    setNavError('');
    if (!id) return;
    const routes: Record<string, { path: string; label: string }> = {
      EDA: { path: `/eda/${id}`, label: 'Generating exploratory analysis…' },
      Correlations: {
        path: `/correlations/${id}?method=${method}&threshold=${threshold}`,
        label: 'Calculating correlations…',
      },
      Outliers: { path: `/outliers/${id}`, label: 'Analyzing potential outliers…' },
      'Machine Learning': { path: `/ml/targets/${id}`, label: 'Preparing target choices…' },
      Report: { path: `/report/${id}`, label: 'Generating your report…' },
    };
    const route = routes[tab];
    if (!route) return;
    const apply = (value: unknown) => {
      if (tab === 'EDA') {
        const v = value as EDA;
        setEda(v);
        setSelected(Object.keys(v.numeric)[0] || Object.keys(v.categorical)[0] || '');
        setScatterY(Object.keys(v.numeric)[1] || '');
      }
      if (tab === 'Correlations') setCorr(value as Correlation);
      if (tab === 'Outliers') setOutliers(value as Outlier[]);
      if (tab === 'Machine Learning') setSuggestions(value as Record<string, string>);
      if (tab === 'Report') setReport(value as Report);
    };
    if (tab !== 'Report' && navigationCache.current.has(route.path)) {
      apply(navigationCache.current.get(route.path));
      return;
    }
    const controller = new AbortController();
    setNavBusy(route.label);
    if (tab === 'Correlations') setCorr(null);
    if (tab === 'Report') setReport(null);
    api<unknown>(route.path, { signal: controller.signal })
      .then((value) => {
        if (controller.signal.aborted) return;
        if (tab !== 'Report') navigationCache.current.set(route.path, value);
        apply(value);
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setNavError(
            e instanceof Error ? e.message : 'Could not load analysis. Please try again.',
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setNavBusy('');
      });
    return () => controller.abort();
  }, [id, tab, method, threshold, navRetry]);
  function go(name: string) {
    setTab(name);
    setMobile(false);
    setError('');
    setNavError('');
  }
  function toggle(list: string[], value: string) {
    return list.includes(value) ? list.filter((c) => c !== value) : [...list, value];
  }
  const uploadZone = (
    <div
      className={`dropzone ${dragging ? 'dragging' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e: DragEvent) => {
        e.preventDefault();
        setDragging(false);
        if (!busy) upload(e.dataTransfer.files[0]);
      }}
    >
      <div className="upload-orbit">
        <Upload size={27} />
      </div>
      <h3>Drop your dataset here</h3>
      <p>CSV or XLSX. Your original data is always preserved.</p>
      <LoadingButton
        className="button primary"
        loading={!!busy}
        loadingText="Analyzing dataset…"
        disabled={!!busy}
        onClick={() => input.current?.click()}
      >
        <Plus size={16} />
        <span>Browse files</span>
      </LoadingButton>
      <span className="caption">CSV or XLSX · Up to 10 MB · 50,000 rows · 100 columns</span>
    </div>
  );
  return (
    <div className="app-shell">
      <input
        ref={input}
        type="file"
        accept=".csv,.xlsx"
        hidden
        onChange={(e) => {
          upload(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <aside
        ref={sidebarRef}
        id="workspace-navigation"
        className={`sidebar ${mobile ? 'open' : ''}`}
        role={mobile ? 'dialog' : undefined}
        aria-modal={mobile || undefined}
        aria-label={mobile ? 'Workspace navigation' : undefined}
      >
        <div className="sidebar-header">
          <Link
            className="brand"
            translate="no"
            href="/"
            aria-label="DataPilot home"
            onClick={(event) => {
              // Preserve the original full reset of the transient workspace.
              event.preventDefault();
              // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- Full navigation also discards pending work and transient dataset state.
              window.location.assign('/');
            }}
          >
            <span className="brand-mark">
              <GitBranch size={23} />
            </span>
            <span className="brand-wordmark">
              <span>DataPilot<span className="brand-ai">AI</span></span>
              <small translate="yes">Data Intelligence</small>
            </span>
          </Link>
          <button
            className="icon-button sidebar-close"
            aria-label="Close navigation"
            onClick={() => setMobile(false)}
          >
            <X size={18} />
          </button>
        </div>
        <div className="workspace-label">
          YOUR WORKSPACE <span>LOCAL</span>
        </div>
        <nav aria-label="Analysis sections">
          {sections.map((s, i) => (
            <div key={s.name}>
              {navigationGroups[i] && (
                <div className="nav-separator">{navigationGroups[i]}</div>
              )}
              <button
                className={`nav-item ${tab === s.name ? 'active' : ''}`}
                aria-current={tab === s.name ? 'page' : undefined}
                onClick={() => go(s.name)}
              >
                <s.icon size={18} />
                <span>{s.name}</span>
                {tab === s.name && <span className="active-dot" aria-hidden="true" />}
                {s.name === 'Cleaning' && !!p?.recommendations.length && (
                  <span className="nav-count">{p.recommendations.length}</span>
                )}
              </button>
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-card">
            <span className="local-icon">
              <ShieldCheck size={19} />
            </span>
            <h4>Your data stays yours</h4>
            <p>Local analysis. No external AI APIs. No account required.</p>
            <span className="local-status">
              <i /> Local workspace
            </span>
          </div>
          <button className="theme-button" aria-label="Toggle sidebar appearance" onClick={toggleTheme}>
            {dark ? <Sun size={16} /> : <Moon size={16} />}{' '}
            <span>{dark ? 'Light appearance' : 'Dark appearance'}</span>
            <span>↔</span>
          </button>
        </div>
      </aside>
      {mobile && <div className="mobile-backdrop" onClick={() => setMobile(false)} />}
      <div className="main-shell" inert={mobile}>
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Toggle navigation"
              aria-expanded={mobile}
              aria-controls="workspace-navigation"
              onClick={() => setMobile(!mobile)}
            >
              <Menu size={19} />
            </button>
            <div className="header-context"><strong>{tab}</strong><span>Data intelligence workspace</span></div>
          </div>
          <div className="header-actions">
            {dataset && <div className="header-dataset" title={dataset.name}>
              <FileSpreadsheet size={16} aria-hidden="true" />
              <div><strong>{dataset.name}</strong><span>{format(dataset.profile.rows, 0)} rows · {dataset.profile.columns_count} columns</span></div>
            </div>}
            <button className="icon-button header-theme" onClick={toggleTheme} aria-label={dark ? 'Light appearance' : 'Dark appearance'} title={dark ? 'Switch to light theme' : 'Switch to dark theme'}>
              {dark ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
            </button>
            <span className="private-label">
              <span /> Local session
            </span>
            <button
              className="icon-button"
              aria-label="Help and documentation"
              onClick={() => {
                setTab('Report');
                setToast(
                  'Use the README for setup and methodology. Datasets expire after two hours.',
                );
              }}
            >
              <CircleHelp size={19} />
            </button>
            <span className="avatar">DP</span>
          </div>
        </header>
        <main>
          <div className={`page-heading ${!dataset ? 'page-heading-welcome' : ''}`}>
            <div className="eyebrow">YOUR DATA, UNDERSTOOD</div>
            <div className="heading-row">
              <div>
                <h1>
                  {!dataset ? 'Turn raw data into insights.' : tab === 'Overview'
                    ? 'Dataset overview'
                    : tab === 'EDA'
                      ? 'Exploratory analysis'
                      : tab === 'Machine Learning'
                        ? 'Machine learning'
                        : tab === 'Data Quality'
                          ? 'Data quality'
                          : tab === 'Correlations'
                            ? 'Correlation analysis'
                            : tab === 'Outliers'
                              ? 'Outlier analysis'
                              : tab === 'Anomalies'
                                ? 'Anomaly detection'
                                : tab === 'Report'
                                  ? 'Analysis report'
                                  : tab === 'Dashboard Builder'
                                    ? 'BI Dashboard Builder'
                                    : 'Data cleaning'}
                </h1>
                <p>{dataset ? descriptions[tab] : 'Upload a dataset to explore, clean, visualize, and model your data in one workspace.'}</p>
              </div>
              <div className="heading-actions">
                {dataset && (
                  <button className="button" disabled={!!busy} onClick={() => go('Report')}>
                    <BookOpen size={15} /> View report
                  </button>
                )}
                <button
                  className="button primary"
                  disabled={!!busy}
                  onClick={() => setUploadOpen(true)}
                >
                  <Upload size={15} />
                  {dataset ? 'Change dataset' : 'Upload dataset'}
                </button>
              </div>
            </div>
          </div>
          {error && (
            <div className="error-banner" role="alert">
              <span>{error}</span>
              <button
                className="icon-button"
                onClick={() => setError('')}
                aria-label="Dismiss error"
              >
                <X size={16} />
              </button>
            </div>
          )}
          {busy && !uploadOpen && (
            <div className="loading-banner" role="status" aria-live="polite" aria-busy="true">
              <LoadingSpinner size={17} />
              <span>{busy}…</span> <span>Computed locally from your data</span>
            </div>
          )}
          {!dataset ? (
            <>
              <div className="welcome-label">
                <GitBranch size={16} /> <span translate="no">DataPilot AI</span> · YOUR ANALYSIS STARTS HERE
              </div>
              <LoadingOverlay active={!!busy && !uploadOpen} label={`${busy}…`}>
                {uploadZone}
              </LoadingOverlay>
              {busy && !uploadOpen && (
                <LoadingState kind="overview" label="Analyzing your dataset…" />
              )}
              <div className="sample-heading">
                <span>Or explore with a sample dataset</span>
                <span>
                  No setup needed <ArrowDownToLine size={14} />
                </span>
              </div>
              <div className="two-grid">
                <button
                  className="sample-card"
                  disabled={!!busy}
                  onClick={() => example('classification')}
                >
                  <div className="sample-icon">
                    <FlaskConical size={24} />
                  </div>
                  <div>
                    <span className="eyebrow">CLASSIFICATION</span>
                    <h3>Customer churn</h3>
                    <p>Explore customer behavior and predict who might leave.</p>
                    <div className="sample-tags">
                      <span>246 rows</span>
                      <span>7 columns</span>
                      <span>Includes quality issues</span>
                    </div>
                  </div>
                  <ArrowUpRight size={20} />
                </button>
                <button
                  className="sample-card"
                  disabled={!!busy}
                  onClick={() => example('regression')}
                >
                  <div className="sample-icon teal">
                    <BarChart3 size={24} />
                  </div>
                  <div>
                    <span className="eyebrow">REGRESSION</span>
                    <h3>Housing prices</h3>
                    <p>Find the features associated with property value.</p>
                    <div className="sample-tags">
                      <span>245 rows</span>
                      <span>6 columns</span>
                      <span>Includes quality issues</span>
                    </div>
                  </div>
                  <ArrowUpRight size={20} />
                </button>
              </div>
              <div className="workflow-strip">
                {[
                  'Upload',
                  'Clean',
                  'Analyze',
                  'Model',
                  'Visualize',
                ].map((s, i) => (
                  <div key={s}>
                    <span>{String(i + 1).padStart(2, '0')}</span>
                    {s}
                    {i < 4 && <ChevronRight size={16} />}
                  </div>
                ))}
              </div>
              <Notice>
                Every recommendation is explained. Nothing is cleaned, removed, or modeled until you
                choose to do so.
              </Notice>
            </>
          ) : (
            <>
              <div className="dataset-bar">
                <span className="file-icon">
                  <FileSpreadsheet size={21} />
                </span>
                <div>
                  <strong>{dataset.name}</strong>
                  <span>
                    {format(p!.rows, 0)} rows <i>·</i> {p!.columns_count} columns <i>·</i>{' '}
                    {dataset.actions.length ? 'Working copy' : 'Original dataset'}
                  </span>
                </div>
                <span className="badge green">
                  <Check size={12} /> Ready to explore
                </span>
                <button
                  className="icon-button"
                  title="Upload another dataset"
                  aria-label="Upload another dataset"
                  disabled={!!busy}
                  onClick={() => setUploadOpen(true)}
                >
                  <ChevronDown size={17} />
                </button>
              </div>
              {tab === 'Overview' && (
                <>
                  <Stats p={p!} />
                  <div className="overview-grid">
                    <Quality p={p!} onReview={() => go('Data Quality')} />
                    <Panel
                      title="Column composition"
                      subtitle="The building blocks of your dataset"
                    >
                      <div className="composition-bar">
                        {[
                          { n: p!.numeric_columns.length, c: 'var(--purple)' },
                          { n: p!.categorical_columns.length, c: '#10b981' },
                          { n: p!.datetime_columns.length, c: '#f59e0b' },
                          { n: p!.boolean_columns.length, c: '#3b82f6' },
                        ].map((x, i) => (
                          <div
                            key={i}
                            style={{
                              width: `${(100 * x.n) / p!.columns_count}%`,
                              background: x.c,
                            }}
                          />
                        ))}
                      </div>
                      <div className="composition-legend">
                        {[
                          ['Numeric', p!.numeric_columns.length, '#6366f1'],
                          ['Categorical', p!.categorical_columns.length, '#10b981'],
                          ['Datetime', p!.datetime_columns.length, '#f59e0b'],
                          ['Boolean', p!.boolean_columns.length, '#3b82f6'],
                        ].map(([label, n, c]) => (
                          <div key={label}>
                            <i style={{ background: String(c) }} />
                            <span>{label}</span>
                            <strong>{n}</strong>
                          </div>
                        ))}
                      </div>
                      <button className="text-button composition-link" onClick={() => go('EDA')}>
                        Explore your features <ArrowUpRight size={14} />
                      </button>
                    </Panel>
                  </div>
                  <div className="section-label">
                    <h2>What your data is telling you</h2>
                    <span className="tag">
                      <Sparkles size={12} /> Computed insights
                    </span>
                  </div>
                  <div className="insights-overview">
                    <Insights items={dataset.insights} limit={3} />
                  </div>
                  <Panel
                    title="Dataset preview"
                    subtitle={`Showing ${Math.min(previewCount, p!.preview.length)} of ${format(p!.rows, 0)} rows · Current working values · Missing cells highlighted`}
                    action={
                      <button className="text-button" onClick={() => go('EDA')}>
                        Explore data <ArrowUpRight size={14} />
                      </button>
                    }
                  >
                    <DataTable
                      rows={p!.preview}
                      columns={p!.columns.map((c) => c.name)}
                      limit={previewCount}
                    />
                    <div className="table-footer">
                      <span>Preview is limited to 50 rows</span>
                      <label>
                        Rows{' '}
                        <select
                          value={previewCount}
                          onChange={(e) => setPreviewCount(Number(e.target.value))}
                        >
                          <option>10</option>
                          <option>25</option>
                          <option>50</option>
                        </select>
                      </label>
                    </div>
                  </Panel>
                  <div className="next-step">
                    <span className="sample-icon">
                      <WandSparkles size={21} />
                    </span>
                    <div>
                      <h3>A thoughtful next step</h3>
                      <p>Review cleaning recommendations before transforming your data.</p>
                    </div>
                    <button className="button" onClick={() => go('Cleaning')}>
                      Review recommendations <ArrowRight size={15} />
                    </button>
                  </div>
                </>
              )}
              {tab === 'Data Quality' && (
                <>
                  <Stats p={p!} />
                  <div className="two-grid">
                    <Quality p={p!} />
                    <Panel
                      title="How the score works"
                      subtitle="100 minus the following observed penalties"
                    >
                      <div className="factor-list">
                        {p!.quality.factors.map((f) => (
                          <div key={f.name}>
                            <span>
                              {f.name}
                              <small>Maximum penalty: {f.weight}</small>
                            </span>
                            <strong>−{format(f.penalty, 2)}</strong>
                          </div>
                        ))}
                      </div>
                    </Panel>
                  </div>
                  <Notice>{p!.quality.explanation}</Notice>
                  <Panel
                    title="Column health"
                    subtitle="Inferred types are suggestions; uploaded values are preserved."
                  >
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            {[
                              'Column',
                              'Type',
                              'Unique',
                              'Missing',
                              'Missing %',
                              'Observations',
                            ].map((x) => (
                              <th key={x}>{x}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {p!.columns.map((c) => (
                            <tr key={c.name}>
                              <td>
                                <strong>{c.name}</strong>
                              </td>
                              <td>
                                <span className="tag">{c.type}</span>
                              </td>
                              <td>{format(c.unique_count, 0)}</td>
                              <td>{format(c.missing_count, 0)}</td>
                              <td>
                                <div className="missing-cell">
                                  <div className="mini-track">
                                    <i
                                      style={{
                                        width: `${c.missing_percentage}%`,
                                      }}
                                    />
                                  </div>
                                  {format(c.missing_percentage)}%
                                </div>
                              </td>
                              <td>
                                {c.constant
                                  ? 'Constant / empty'
                                  : c.high_cardinality
                                    ? 'High cardinality'
                                    : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Panel>
                </>
              )}
              {tab === 'Cleaning' && (
                <>
                  <Notice>
                    Recommendations are starting points, not guarantees. Review the selected
                    operations, then click Apply. The original upload remains available for reset
                    and model training.
                  </Notice>
                  <Panel
                    title="Missing value recommendations"
                    subtitle="Choose a strategy for each column. No changes have been applied yet."
                  >
                    <div className="recommendations">
                      {p!.recommendations.length ? (
                        p!.recommendations.map((r) => (
                          <div className="recommendation" key={r.column}>
                            <div>
                              <h4>
                                {r.column}{' '}
                                <span className="badge orange">
                                  {format(r.missing_percentage)}% missing
                                </span>
                              </h4>
                              <div className="recommendation-meta"><span className="badge purple">Recommended</span><strong>{r.recommended_strategy.replaceAll('_', ' ')}</strong></div>
                              <p><span className="reason-label">Why this strategy</span>{r.reason}</p>
                              <span className="caption">
                                {format(r.missing_count, 0)} missing cells
                              </span>
                            </div>
                            <div className="strategy-control">
                              <label>
                                Selected strategy
                                <select
                                  value={actions[r.column]?.strategy || 'leave'}
                                  onChange={(e) =>
                                    setActions({
                                      ...actions,
                                      [r.column]: {
                                        ...actions[r.column],
                                        strategy: e.target.value,
                                      },
                                    })
                                  }
                                >
                                  {[r.recommended_strategy, ...r.alternative_strategies].map(
                                    (s) => (
                                      <option key={s} value={s}>
                                        {s.replaceAll('_', ' ')}
                                        {s === r.recommended_strategy ? ' (suggested)' : ''}
                                      </option>
                                    ),
                                  )}
                                </select>
                              </label>
                              {actions[r.column]?.strategy === 'constant' && (
                                <input
                                  aria-label={`Constant for ${r.column}`}
                                  placeholder={
                                    p!.numeric_columns.includes(r.column)
                                      ? 'Enter numeric constant'
                                      : 'Unknown'
                                  }
                                  value={actions[r.column]?.value ?? ''}
                                  onChange={(e) =>
                                    setActions({
                                      ...actions,
                                      [r.column]: {
                                        ...actions[r.column],
                                        value: e.target.value,
                                      },
                                    })
                                  }
                                />
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="empty-small">
                          No missing values detected. Other cleaning options are available below.
                        </p>
                      )}
                    </div>
                  </Panel>
                  <div className="two-grid">
                    <Panel
                      title="Additional operations"
                      subtitle="Only selected changes will be applied"
                    >
                      <label className="checkbox-line">
                        <input
                          type="checkbox"
                          checked={removeDup}
                          onChange={(e) => setRemoveDup(e.target.checked)}
                        />{' '}
                        Remove duplicate rows ({p!.duplicates})
                      </label>
                      <label className="field-label">
                        Ordering column for fills / interpolation
                        <select value={order} onChange={(e) => setOrder(e.target.value)}>
                          <option value="">Select only for ordered data</option>
                          {p!.columns.map((c) => (
                            <option key={c.name}>{c.name}</option>
                          ))}
                        </select>
                      </label>
                      <p className="caption padded">
                        Ordering must be unique and complete. Interpolation assumes equally spaced
                        rows; boundary gaps remain missing.
                      </p>
                      <label className="checkbox-line">
                        <input
                          type="checkbox"
                          checked={zero}
                          onChange={(e) => setZero(e.target.checked)}
                        />{' '}
                        I confirm zero is meaningful where selected.
                      </label>
                    </Panel>
                    <Panel
                      title="Columns & types"
                      subtitle="Invalid conversions are rejected without changing data"
                    >
                      <div className="column-options">
                        {p!.columns.map((c) => (
                          <div key={c.name}>
                            <label>
                              <input
                                type="checkbox"
                                checked={dropCols.includes(c.name)}
                                onChange={() => setDropCols(toggle(dropCols, c.name))}
                              />{' '}
                              Drop {c.name}
                            </label>
                            <select
                              aria-label={`Convert ${c.name}`}
                              value={conversions[c.name] || ''}
                              onChange={(e) => {
                                const v = { ...conversions };
                                if (e.target.value) v[c.name] = e.target.value;
                                else delete v[c.name];
                                setConversions(v);
                              }}
                            >
                              <option value="">Keep {c.type}</option>
                              {['numeric', 'datetime', 'string', 'boolean'].map((t) => (
                                <option key={t}>{t}</option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    </Panel>
                  </div>
                  <div className="action-bar">
                    <LoadingButton
                      loading={busy === 'Resetting dataset'}
                      loadingText="Restoring original…"
                      className="button"
                      disabled={!!busy}
                      onClick={() =>
                        run('Resetting dataset', async () => {
                          initialize(await post<Dataset>(`/reset/${id}`));
                          setMl(null);
                          setToast('Original dataset restored.');
                        })
                      }
                    >
                      <RotateCcw size={15} /> Reset to original
                    </LoadingButton>
                    <DownloadButton
                      path={`/download/cleaned/${id}`}
                      filename="datapilot-cleaned.csv"
                    >
                      <ArrowDownToLine size={15} />
                      <span>Download CSV</span>
                    </DownloadButton>
                    <LoadingButton
                      loading={busy === 'Applying your cleaning decisions'}
                      loadingText="Applying changes…"
                      className="button primary"
                      disabled={!!busy}
                      onClick={() =>
                        run('Applying your cleaning decisions', async () => {
                          initialize(
                            await post<Dataset>(`/clean/${id}`, {
                              missing: actions,
                              remove_duplicates: removeDup,
                              drop_columns: dropCols,
                              conversions,
                              order_by: order || null,
                              confirm_zero: zero,
                            }),
                          );
                          setToast('Cleaning applied to the working copy.');
                        })
                      }
                    >
                      <Check size={16} /> Apply selected changes
                    </LoadingButton>
                  </div>
                  <BeforeAfter before={dataset.original_profile} after={p!} />
                  {dataset.actions.length > 0 && (
                    <Panel title="Applied changes">
                      <ol className="action-log">
                        {dataset.actions.map((a, i) => (
                          <li key={i}>{a}</li>
                        ))}
                      </ol>
                    </Panel>
                  )}
                  <p className="caption">
                    CSV exports prefix formula-like text with an apostrophe for spreadsheet safety.
                    The working data is unchanged.
                  </p>
                </>
              )}
              {tab === 'EDA' &&
                (eda ? (
                  <>
                    <div className="controls">
                      <label>
                        Explore a column
                        <select value={selected} onChange={(e) => setSelected(e.target.value)}>
                          {[...Object.keys(eda.numeric), ...Object.keys(eda.categorical)].map(
                            (c) => (
                              <option key={c}>{c}</option>
                            ),
                          )}
                        </select>
                      </label>
                    </div>
                    {eda.numeric[selected] ? (
                      <>
                        <div className="two-grid">
                          <Panel
                            title={`${selected} distribution`}
                            subtitle="Histogram of observed values"
                          >
                            <Bars data={eda.numeric[selected].histogram} />
                          </Panel>
                          <Panel
                            title="Spread & quartiles"
                            subtitle="Box plot · missing values excluded"
                          >
                            <BoxPlot box={eda.numeric[selected].box} />
                            <div className="stat-pills">
                              {Object.entries(
                                p!.columns.find((c) => c.name === selected)?.statistics || {},
                              ).map(([k, v]) => (
                                <div key={k}>
                                  <span>{k}</span>
                                  <strong>{format(v, 3)}</strong>
                                </div>
                              ))}
                            </div>
                          </Panel>
                        </div>
                        {Object.keys(eda.numeric).length > 1 && (
                          <Panel
                            title="Feature relationship"
                            subtitle={`At most 500 randomly sampled rows; only complete pairs are plotted.`}
                            action={
                              <label>
                                Compare with{' '}
                                <select
                                  value={scatterY}
                                  onChange={(e) => setScatterY(e.target.value)}
                                >
                                  {Object.keys(eda.numeric)
                                    .filter((c) => c !== selected)
                                    .map((c) => (
                                      <option key={c}>{c}</option>
                                    ))}
                                </select>
                              </label>
                            }
                          >
                            <ScatterPlot
                              data={eda.scatter}
                              x={selected}
                              y={
                                scatterY && scatterY !== selected
                                  ? scatterY
                                  : Object.keys(eda.numeric).find((c) => c !== selected) || ''
                              }
                            />
                          </Panel>
                        )}
                      </>
                    ) : eda.categorical[selected] ? (
                      <Panel
                        title={`${selected} distribution`}
                        subtitle={`${eda.categorical[selected].unique_count} categories · Most frequent: ${eda.categorical[selected].most_frequent} (${eda.categorical[selected].frequency} observations)`}
                      >
                        <Bars data={eda.categorical[selected].distribution} x="category" />
                      </Panel>
                    ) : (
                      <Notice>
                        No observed numeric or categorical values to chart. Date-only and empty
                        columns are available in the profile.
                      </Notice>
                    )}
                  </>
                ) : (
                  <LoadingState
                    label={navBusy || `Loading ${tab.toLowerCase()}…`}
                    kind="charts"
                    error={navError}
                    onRetry={() => setNavRetry((n) => n + 1)}
                  />
                ))}
              {tab === 'Correlations' && (
                <>
                  <div className="controls">
                    <label>
                      Correlation method
                      <select value={method} onChange={(e) => setMethod(e.target.value)}>
                        <option value="pearson">Pearson · linear relationships</option>
                        <option value="spearman">Spearman · ranked relationships</option>
                      </select>
                    </label>
                    <label>
                      Strong correlation threshold
                      <input
                        type="number"
                        min="0.1"
                        max="1"
                        step="0.05"
                        value={threshold}
                        onChange={(e) =>
                          setThreshold(Math.max(0.1, Math.min(1, Number(e.target.value))))
                        }
                      />
                    </label>
                  </div>
                  {corr ? (
                    <>
                      <Notice>{corr.warning}</Notice>
                      <Panel
                        title={`${method === 'pearson' ? 'Pearson' : 'Spearman'} correlation matrix`}
                        subtitle="Color strength indicates the magnitude of the relationship"
                      >
                        <Heatmap data={corr} />
                      </Panel>
                      <Panel
                        title="Feature pairs"
                        subtitle="|r| ≥ 0.90 is flagged as a possible multicollinearity concern"
                      >
                        <div className="table-scroll">
                          <table>
                            <thead>
                              <tr>
                                <th>Feature pair</th>
                                <th>Correlation</th>
                                <th>Strength</th>
                                <th>Complete pairs</th>
                                <th>Review</th>
                              </tr>
                            </thead>
                            <tbody>
                              {corr.pairs.map((c) => (
                                <tr key={`${c.x}-${c.y}`}>
                                  <td>
                                    {c.x} <span className="muted">↔</span> {c.y}
                                  </td>
                                  <td>{format(c.value, 3)}</td>
                                  <td>{c.strength}</td>
                                  <td>{c.observations}</td>
                                  <td>
                                    {c.multicollinearity ? (
                                      <span className="badge orange">Possible redundancy</span>
                                    ) : (
                                      '—'
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {!corr.pairs.length && (
                            <p className="empty-small">
                              At least two varying numeric columns with three complete pairs are
                              needed.
                            </p>
                          )}
                        </div>
                      </Panel>
                    </>
                  ) : (
                    <LoadingState
                      label={navBusy || `Loading ${tab.toLowerCase()}…`}
                      kind="charts"
                      error={navError}
                      onRetry={() => setNavRetry((n) => n + 1)}
                    />
                  )}
                </>
              )}
              {tab === 'Outliers' && (
                <>
                  <Notice>
                    Statistical outliers are not confirmed bad data. No observations are removed.
                    IQR is computed for numeric columns with at least four observations; Z-score is
                    offered only for roughly symmetric samples of at least 30.
                  </Notice>
                  {outliers ? (
                    <Panel
                      title="Potential numeric outliers"
                      subtitle="Review the thresholds and domain context"
                    >
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>Column</th>
                              <th>Method</th>
                              <th>Flagged</th>
                              <th>Percentage</th>
                              <th>Lower bound</th>
                              <th>Upper bound</th>
                            </tr>
                          </thead>
                          <tbody>
                            {outliers.map((o, i) => (
                              <tr key={i} title={o.information}>
                                <td>
                                  <strong>{o.column}</strong>
                                </td>
                                <td>
                                  <span className="tag">{o.method}</span>
                                </td>
                                <td>{o.count}</td>
                                <td>{format(o.percentage)}%</td>
                                <td>{format(o.lower, 2)}</td>
                                <td>{format(o.upper, 2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {!outliers.length && (
                          <p className="empty-small">
                            No numeric columns with enough variation and observations.
                          </p>
                        )}
                      </div>
                      <div className="padded caption">
                        IQR: outside Q1 − 1.5 × IQR or Q3 + 1.5 × IQR. Z-score: more than three
                        sample standard deviations from the mean. Symmetry alone does not establish
                        normality.
                      </div>
                    </Panel>
                  ) : (
                    <LoadingState
                      label={navBusy || `Loading ${tab.toLowerCase()}…`}
                      kind="table"
                      error={navError}
                      onRetry={() => setNavRetry((n) => n + 1)}
                    />
                  )}
                </>
              )}
              {tab === 'Machine Learning' && navBusy && (
                <div className="loading-banner" role="status" aria-busy="true">
                  <LoadingSpinner />
                  <span>{navBusy}</span>
                </div>
              )}
              {tab === 'Machine Learning' && navError && (
                <LoadingState error={navError} onRetry={() => setNavRetry((n) => n + 1)} />
              )}
              {tab === 'Machine Learning' && (
                <>
                  <Notice>
                    Training uses the original upload. Imputation, encoding, and optional scaling
                    are fitted on training data only. This MVP uses random splits; use a
                    purpose-built temporal or grouped split for forecasting or repeated subjects.
                  </Notice>
                  <Panel
                    title="Model configuration"
                    subtitle="Select and confirm the target and task before training"
                  >
                    <div className="form-grid">
                      <label>
                        Target column
                        <select
                          value={target}
                          onChange={(e) => {
                            setTarget(e.target.value);
                            setTask(suggestions[e.target.value] || 'classification');
                          }}
                        >
                          <option value="">Choose your target</option>
                          {dataset.original_profile.columns.map((c) => (
                            <option key={c.name}>{c.name}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Task · override the suggestion
                        <select value={task} onChange={(e) => setTask(e.target.value)}>
                          <option value="classification">Classification</option>
                          <option value="regression">Regression</option>
                        </select>
                      </label>
                      <label>
                        Test split
                        <select
                          value={testSize}
                          onChange={(e) => setTestSize(Number(e.target.value))}
                        >
                          <option value={0.2}>20% test / 80% train</option>
                          <option value={0.3}>30% test / 70% train</option>
                          <option value={0.4}>40% test / 60% train</option>
                        </select>
                      </label>
                    </div>
                    {target && (
                      <p className="padded caption">
                        Suggested task: {suggestions[target]}. This uses datatype and cardinality
                        heuristics; confirm based on your prediction goal.
                      </p>
                    )}
                    <label className="checkbox-line">
                      <input
                        type="checkbox"
                        checked={scale}
                        onChange={(e) => setScale(e.target.checked)}
                      />{' '}
                      Standardize numeric features
                    </label>
                    <div className="padded">
                      <strong className="small">
                        Exclude identifiers, post-outcome fields, and other leakage risks
                      </strong>
                      <div className="feature-checks">
                        {dataset.original_profile.columns
                          .filter((c) => c.name !== target)
                          .map((c) => (
                            <label key={c.name}>
                              <input
                                type="checkbox"
                                checked={exclude.includes(c.name)}
                                onChange={() => setExclude(toggle(exclude, c.name))}
                              />
                              {c.name}
                            </label>
                          ))}
                      </div>
                    </div>
                    <div className="panel-bottom">
                      <span className="caption">
                        Two baseline models · Fixed seed · Training-set cross-validation
                      </span>
                      <LoadingButton
                        loading={busy === 'Training and evaluating baselines'}
                        loadingText="Training models…"
                        className="button primary"
                        disabled={!target || !!busy}
                        onClick={() =>
                          run('Training and evaluating baselines', async () => {
                            const v = await post<ML>(`/ml/train/${id}`, {
                              target,
                              task,
                              scale,
                              test_size: testSize,
                              exclude_columns: exclude.filter((c) => c !== target),
                            });
                            setMl(v);
                            const d = await api<Dataset>(`/profile/${id}`);
                            setDataset(d);
                            setReport(null);
                          })
                        }
                      >
                        <FlaskConical size={16} /> Confirm & train models
                      </LoadingButton>
                    </div>
                  </Panel>
                  {ml ? <ModelResults data={ml} /> : !busy && <div className="empty-state">
                    <FlaskConical size={25} aria-hidden="true" />
                    <div><h3>No model trained yet</h3><p>Select a target variable above, configure your experiment, and train your baselines to compare performance.</p></div>
                  </div>}
                </>
              )}
              {tab === 'Anomalies' && (
                <>
                  <Notice>
                    Isolation Forest finds unusual combinations of numeric values. It imputes
                    missing values for analysis only. Flagged rows remain in your dataset.
                  </Notice>
                  <Panel
                    title="Run an anomaly analysis"
                    subtitle="The expected anomaly fraction is an assumption you control"
                  >
                    <div className="form-grid">
                      <label>
                        Expected flagged fraction
                        <select
                          value={contamination}
                          onChange={(e) => setContamination(Number(e.target.value))}
                        >
                          {[0.01, 0.03, 0.05, 0.1, 0.2].map((x) => (
                            <option key={x} value={x}>
                              {x * 100}%
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="align-end">
                        <LoadingButton
                          loading={busy === 'Detecting unusual observations'}
                          loadingText="Detecting anomalies…"
                          className="button primary"
                          disabled={!!busy}
                          onClick={() =>
                            run('Detecting unusual observations', async () => {
                              setAnomaly(
                                await post<Anomaly>(`/anomalies/${id}`, {
                                  contamination,
                                }),
                              );
                              setDataset(await api<Dataset>(`/profile/${id}`));
                              setReport(null);
                            })
                          }
                        >
                          <ScanLine size={16} /> Run Isolation Forest
                        </LoadingButton>
                      </div>
                    </div>
                  </Panel>
                  {anomaly && (
                    <>
                      <div className="two-grid">
                        <Panel title="Flagged observations">
                          <div className="anomaly-stat">
                            <strong>{anomaly.count}</strong>
                            <span>
                              {format(anomaly.percentage)}% of {anomaly.total} rows
                            </span>
                          </div>
                          <p className="padded muted">Features: {anomaly.features.join(', ')}</p>
                        </Panel>
                        <Panel
                          title="Anomaly score distribution"
                          subtitle="Higher scores indicate more unusual observations"
                        >
                          <Bars data={anomaly.distribution} />
                        </Panel>
                      </div>
                      <Notice>{anomaly.note}</Notice>
                      <Panel
                        title="Flagged row preview"
                        subtitle="Current dataset row numbers are one-based; export includes all flags."
                        action={
                          <DownloadButton
                            path={`/download/anomalies/${id}`}
                            filename="datapilot-anomalies.csv"
                          >
                            <ArrowDownToLine size={15} />
                            <span>Export anomalies</span>
                          </DownloadButton>
                        }
                      >
                        <DataTable
                          rows={anomaly.rows.map((r, i) => ({
                            source_row: anomaly.row_numbers[i],
                            anomaly_score: anomaly.scores[i],
                            ...r,
                          }))}
                          limit={100}
                        />
                      </Panel>
                    </>
                  )}
                </>
              )}
              <div hidden={tab !== 'Dashboard Builder'}>
                <DashboardBuilder
                  key={dataset.dataset_id}
                  dataset={dataset}
                  active={tab === 'Dashboard Builder'}
                />
              </div>
              {tab === 'Report' &&
                (report ? (
                  <>
                    <div className="action-bar no-print">
                      <span className="muted">
                        A snapshot of the current working copy and completed analyses
                      </span>
                      <button className="button primary" onClick={() => window.print()}>
                        <ArrowDownToLine size={15} /> Print / Save as PDF
                      </button>
                    </div>
                    <div className="print-title">
                      <h1>DataPilot AI · Analysis report</h1>
                      <p>{dataset.name}</p>
                    </div>
                    <Stats p={p!} />
                    <Quality p={p!} />
                    <Notice>{p!.quality.explanation}</Notice>
                    <BeforeAfter before={dataset.original_profile} after={p!} />
                    <Panel title="Cleaning actions">
                      {dataset.actions.length ? (
                        <ol className="action-log">
                          {dataset.actions.map((a, i) => (
                            <li key={i}>{a}</li>
                          ))}
                        </ol>
                      ) : (
                        <p className="padded muted">No cleaning has been applied.</p>
                      )}
                    </Panel>
                    <Panel title="Missing values & important statistics">
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>Column</th>
                              <th>Type</th>
                              <th>Missing</th>
                              <th>Mean</th>
                              <th>Median</th>
                              <th>Std</th>
                              <th>Unique</th>
                            </tr>
                          </thead>
                          <tbody>
                            {p!.columns.map((c) => (
                              <tr key={c.name}>
                                <td>{c.name}</td>
                                <td>{c.type}</td>
                                <td>
                                  {c.missing_count} ({format(c.missing_percentage)}%)
                                </td>
                                <td>{format(c.statistics?.mean)}</td>
                                <td>{format(c.statistics?.median)}</td>
                                <td>{format(c.statistics?.std)}</td>
                                <td>{c.unique_count}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Panel>
                    <Panel title="Important correlations">
                      <Heatmap data={report.correlations} />
                      <p className="padded caption">{report.correlations.warning}</p>
                    </Panel>
                    <Panel title="Potential outliers">
                      <div className="padded">
                        {report.outliers.length ? (
                          report.outliers
                            .filter((o) => o.method === 'IQR')
                            .map((o) => (
                              <p key={o.column}>
                                {o.column}: {o.count} potential IQR outliers ({format(o.percentage)}
                                %).
                              </p>
                            ))
                        ) : (
                          <p>No eligible numeric columns.</p>
                        )}
                        <p className="caption">
                          Statistical outliers are not confirmed bad data; none are automatically
                          removed.
                        </p>
                      </div>
                    </Panel>
                    {report.ml ? (
                      <ModelResults data={report.ml} />
                    ) : (
                      <Notice>No supervised model has been trained.</Notice>
                    )}
                    {report.anomalies ? (
                      <Panel title="Anomaly detection">
                        <p className="padded">
                          Isolation Forest flagged {report.anomalies.count} rows (
                          {format(report.anomalies.percentage)}%) at{' '}
                          {report.anomalies.contamination * 100}% expected contamination. No rows
                          were removed.
                        </p>
                      </Panel>
                    ) : (
                      <Notice>Anomaly detection has not been run.</Notice>
                    )}
                    <Panel title="Main insights">
                      <Insights items={report.insights} limit={100} />
                    </Panel>
                  </>
                ) : (
                  <LoadingState
                    label={navBusy || `Loading ${tab.toLowerCase()}…`}
                    kind="table"
                    error={navError}
                    onRetry={() => setNavRetry((n) => n + 1)}
                  />
                ))}
            </>
          )}
          <footer className="page-footer">
            <span>
              <GitBranch size={13} /> DataPilot AI
            </span>
            <span>Thoughtful analysis. Informed decisions.</span>
            <span>MVP · Local workspace</span>
          </footer>
        </main>
      </div>
      {uploadOpen && (
        <div className="modal-overlay" onClick={() => !busy && setUploadOpen(false)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Upload dataset"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>Start with your data</h2>
              <button
                className="icon-button"
                disabled={!!busy}
                aria-label="Close upload"
                onClick={() => setUploadOpen(false)}
              >
                <X size={20} />
              </button>
            </div>
            {uploadZone}
            {busy && (
              <p role="status">
                <LoadingSpinner size={16} />
                <span>{busy}…</span>
              </p>
            )}
            {error && (
              <p role="alert" className="modal-error">
                {error}
              </p>
            )}
            <div className="sample-buttons">
              <button
                className="button"
                disabled={!!busy}
                onClick={() => example('classification')}
              >
                Try customer churn
              </button>
              <button className="button" disabled={!!busy} onClick={() => example('regression')}>
                Try housing prices
              </button>
            </div>
            <p className="caption">
              Files are held in backend memory for up to two hours. XLSX uses the first sheet. The
              original upload is preserved.
            </p>
          </div>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
        </div>
      )}
    </div>
  );
}
function BeforeAfter({ before, after }: { before: Profile; after: Profile }) {
  return (
    <Panel
      title="Before & after cleaning"
      subtitle="Original upload compared with the current working copy"
    >
      <div className="comparison">
        {[
          ['Rows', before.rows, after.rows],
          ['Columns', before.columns_count, after.columns_count],
          ['Missing cells', before.missing_values, after.missing_values],
          ['Duplicates', before.duplicates, after.duplicates],
        ].map(([label, b, a]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>
              {format(Number(b), 0)} <ArrowRight size={16} /> <em>{format(Number(a), 0)}</em>
            </strong>
          </div>
        ))}
      </div>
    </Panel>
  );
}
function ModelResults({ data }: { data: ML }) {
  const explanations: Record<string, string> = {
    accuracy: 'Fraction of correct predictions; can hide class imbalance.',
    precision: 'Weighted precision: how often predicted labels are correct.',
    recall: 'Weighted recall: how many true class members are recovered.',
    f1: 'Weighted F1 balances precision and recall; inspect per-class confusion counts.',
    roc_auc: 'Binary ranking performance; 0.5 is chance-like.',
    mae: 'Mean absolute prediction error, in target units.',
    rmse: 'Root mean squared error; penalizes large errors more.',
    r2: 'Explained variation relative to a mean baseline; can be negative.',
  };
  return (
    <>
      <Notice>
        {data.source} {data.warning}
      </Notice>
      <div className="result-meta">
        <span>
          Target: <strong>{data.target}</strong>
        </span>
        <span>
          {data.train_rows} train / {data.test_rows} test
        </span>
        <span>{data.excluded_rows} missing-target or duplicate rows excluded</span>
      </div>
      {data.excluded_features.length > 0 && (
        <Notice>
          Training-only screening excluded: {data.excluded_features.join(', ')} (constant, empty, or
          more than 100 categories).
        </Notice>
      )}
      <div className="section-label"><h2>Model performance</h2><span className="caption">Held-out metrics and diagnostic evidence</span></div>
      {data.models.map((m) => (
        <Panel key={m.name} title={m.name} subtitle={`Held-out test evaluation · ${data.task}`}>
          <div className="metric-grid">
            {Object.entries(m.metrics).map(([k, v]) => (
              <div key={k} title={explanations[k]}>
                <span>{k.replace('_', '-').toUpperCase()}</span>
                <strong>{format(v, 3)}</strong>
                <p>{explanations[k]}</p>
              </div>
            ))}
          </div>
          <div className={`diagnostic ${m.diagnostic === 'Reasonably balanced fit' ? 'diagnostic-balanced' : ''}`}>
            <h4>Diagnostics</h4>
            <span className={`badge ${m.diagnostic === 'Reasonably balanced fit' ? 'green' : 'orange'}`}>{m.diagnostic}</span>
            <p>{m.diagnostic_reason}</p>
            <p className="caption">
              Cross-validation folds: {m.cv_scores.map((v) => format(v, 3)).join(' · ')}. Held-out
              test {data.scoring}: {format(m.test_score, 3)}.
            </p>
          </div>
          <div className="two-grid model-charts">
            <div>
              <h4>Learning curve · {data.scoring}</h4>
              {m.learning_curve.length ? (
                <LearningCurve data={m.learning_curve} />
              ) : (
                <p className="empty-small">{m.learning_curve_note}</p>
              )}
            </div>
            <div>
              <h4>Feature importance</h4>
              <p className="caption">{m.importance_kind}. Association does not imply causality.</p>
              <Bars data={m.importance} x="feature" y="value" horizontal />
            </div>
          </div>
          {m.confusion_matrix && m.labels && (
            <div className="padded">
              <h4>Confusion matrix</h4>
              <p className="caption">Rows: actual class · Columns: predicted class</p>
              <div className="table-scroll">
                <table className="confusion">
                  <thead>
                    <tr>
                      <th>Actual / Predicted</th>
                      {m.labels.map((l) => (
                        <th key={l}>{l}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {m.confusion_matrix.map((row, i) => (
                      <tr key={i}>
                        <th>{m.labels![i]}</th>
                        {row.map((n, j) => (
                          <td
                            key={j}
                            style={{
                              background: i === j ? 'var(--purple-soft)' : undefined,
                            }}
                          >
                            {n}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {m.warnings.map((w, i) => (
            <Notice key={i}>{w}</Notice>
          ))}
        </Panel>
      ))}
    </>
  );
}
