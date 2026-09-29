import type { Dataset } from '@/types';
import type { DashboardConfig, DashboardSchema, Visual, VisualType } from '@/types/dashboard';
export const visualTypes: VisualType[] = [
  'kpi',
  'bar',
  'horizontal',
  'line',
  'area',
  'pie',
  'donut',
  'scatter',
  'histogram',
  'table',
];
export const aggregationNames = {
  count: 'Count (observed)',
  distinct: 'Distinct count',
  sum: 'Sum',
  average: 'Average',
  min: 'Minimum',
  max: 'Maximum',
};
export const typeNames: Record<VisualType, string> = {
  kpi: 'KPI card',
  bar: 'Bar chart',
  horizontal: 'Horizontal bar',
  line: 'Line chart',
  area: 'Area chart',
  pie: 'Pie chart',
  donut: 'Donut chart',
  scatter: 'Scatter plot',
  histogram: 'Histogram',
  table: 'Table',
};
export function createVisual(type: VisualType, schema: DashboardSchema, position: number): Visual {
  const nums = schema.fields.filter((f) => f.type === 'numeric' && f.unique > 1);
  const category = schema.fields.find(
    (f) => (f.type === 'categorical' || f.type === 'boolean') && f.unique > 1 && f.unique <= 30,
  );
  const date = schema.fields.find((f) => f.type === 'datetime' && f.unique > 1);
  const x =
    type === 'scatter' || type === 'histogram'
      ? nums[0]?.name
      : type === 'line' || type === 'area'
        ? (date || nums[0])?.name
        : (category || schema.fields[0])?.name;
  return {
    id: crypto.randomUUID(),
    type,
    title: type === 'kpi' ? 'Total records' : typeNames[type],
    x: x || null,
    y:
      type === 'scatter'
        ? nums[1]?.name || null
        : type === 'line' || type === 'area'
          ? nums[0]?.name || null
          : null,
    aggregation: type === 'line' || type === 'area' ? 'average' : 'count',
    metric: 'rows',
    sort: type === 'line' || type === 'area' ? 'label_asc' : 'value_desc',
    limit: 10,
    bins: 15,
    time_bucket: 'month',
    columns: schema.fields.slice(0, 5).map((f) => f.name),
    page: 1,
    page_size: 10,
    search: '',
    sort_column: null,
    descending: false,
    position,
    width: type === 'table' ? 2 : 1,
    height: 240,
  };
}
export function generateDashboard(schema: DashboardSchema): DashboardConfig {
  const visuals: Visual[] = [];
  const add = (type: VisualType, patch: Partial<Visual>) =>
    visuals.push({ ...createVisual(type, schema, visuals.length), ...patch });
  add('kpi', { title: 'Total records', metric: 'rows' });
  add('kpi', { title: 'Missing values', metric: 'missing' });
  const nums = schema.fields.filter(
    (f) =>
      f.type === 'numeric' &&
      f.unique > 1 &&
      !/(^id$|_id$|passengerid|customerid|orderid|postal|zip|code)/i.test(f.name),
  );
  nums.sort((a, b) => Number(b.unique > 10) - Number(a.unique > 10));
  const cat = schema.fields.find(
    (f) => (f.type === 'categorical' || f.type === 'boolean') && f.unique >= 2 && f.unique <= 30,
  );
  const date = schema.fields.find((f) => f.type === 'datetime' && f.unique > 1);
  if (nums.length)
    add('kpi', {
      title: `Average ${nums[0].name}`,
      metric: 'column',
      y: nums[0].name,
      aggregation: 'average',
    });
  if (cat)
    add('bar', { title: `Records by ${cat.name}`, x: cat.name, y: null, aggregation: 'count' });
  if (date && nums.length)
    add('line', {
      title: `Average ${nums[0].name} over time`,
      x: date.name,
      y: nums[0].name,
      aggregation: 'average',
      sort: 'label_asc',
      limit: 50,
    });
  if (nums.length > 1 && nums[0].unique > 10 && nums[1].unique > 10)
    add('scatter', {
      title: `${nums[0].name} vs ${nums[1].name}`,
      x: nums[0].name,
      y: nums[1].name,
    });
  else if (nums.length)
    add('histogram', { title: `${nums[0].name} distribution`, x: nums[0].name, y: null });
  return { version: 1, title: 'My analytics dashboard', visuals, filters: [] };
}
export function storageKey(dataset: Dataset) {
  return `datapilot:dashboard:v1:${JSON.stringify([dataset.name, dataset.original_profile.columns.map((c) => [c.name, c.type])])}`;
}
export function loadDashboard(
  key: string,
  schema: DashboardSchema,
): { config: DashboardConfig; message: string } {
  const empty: DashboardConfig = {
    version: 1,
    title: 'My analytics dashboard',
    visuals: [],
    filters: [],
  };
  const raw = localStorage.getItem(key);
  if (!raw) return { config: empty, message: '' };
  try {
    const data = JSON.parse(raw) as DashboardConfig;
    if (
      data.version !== 1 ||
      typeof data.title !== 'string' ||
      !Array.isArray(data.visuals) ||
      data.visuals.length > 24 ||
      !Array.isArray(data.filters) ||
      data.filters.length > 30
    )
      throw Error('Invalid configuration');
    const fields = new Set(schema.fields.map((f) => f.name));
    let adjusted = false;
    const visuals = data.visuals.map((v, i) => {
      if (
        !v ||
        !visualTypes.includes(v.type) ||
        typeof v.title !== 'string' ||
        ![1, 2].includes(v.width) ||
        ![240, 340].includes(v.height) ||
        !['count', 'distinct', 'sum', 'average', 'min', 'max'].includes(v.aggregation) ||
        !Array.isArray(v.columns) ||
        v.columns.some((c) => typeof c !== 'string')
      )
        throw Error('Invalid visual');
      const result = {
        ...createVisual(v.type, schema, i),
        ...v,
        id: typeof v.id === 'string' ? v.id : crypto.randomUUID(),
        position: i,
      };
      if (result.x && !fields.has(result.x)) {
        result.x = null;
        adjusted = true;
      }
      if (result.y && !fields.has(result.y)) {
        result.y = null;
        adjusted = true;
      }
      result.columns = result.columns.filter((c) => fields.has(c));
      if (result.sort_column && !fields.has(result.sort_column)) result.sort_column = null;
      return result;
    });
    if (new Set(visuals.map((v) => v.id)).size !== visuals.length) throw Error('Duplicate IDs');
    const filters = data.filters.filter(
      (f) =>
        f &&
        fields.has(f.column) &&
        ['numeric', 'categorical', 'datetime', 'boolean'].includes(f.kind) &&
        (!f.values || Array.isArray(f.values)),
    );
    return {
      config: { version: 1, title: data.title, visuals, filters },
      message:
        adjusted || filters.length !== data.filters.length
          ? 'Saved dashboard restored. Some fields changed; review settings.'
          : 'Saved dashboard restored.',
    };
  } catch {
    return {
      config: empty,
      message: 'The saved dashboard is invalid or unsupported. Generate a new dashboard.',
    };
  }
}
