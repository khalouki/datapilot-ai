import type { Insight, Row } from '@/types';
export type VisualType =
  | 'kpi'
  | 'bar'
  | 'horizontal'
  | 'line'
  | 'area'
  | 'pie'
  | 'donut'
  | 'scatter'
  | 'histogram'
  | 'table';
export type Aggregation = 'count' | 'distinct' | 'sum' | 'average' | 'min' | 'max';
export type Field = {
  name: string;
  type: 'numeric' | 'categorical' | 'datetime' | 'boolean';
  unique: number;
  missing: number;
  minimum: number | string | null;
  maximum: number | string | null;
  options?: Option[];
  truncated?: boolean;
};
export type Option = { value: string | number | boolean | null; label: string; count: number };
export type DashboardSchema = { fields: Field[]; rows: number; columns: number; revision: number };
export type DashboardFilter = {
  column: string;
  kind: Field['type'];
  values?: (string | number | boolean | null)[];
  minimum?: number | null;
  maximum?: number | null;
  start?: string | null;
  end?: string | null;
};
export type Visual = {
  id: string;
  type: VisualType;
  title: string;
  x: string | null;
  y: string | null;
  aggregation: Aggregation;
  metric: 'column' | 'rows' | 'columns' | 'missing' | 'duplicates';
  sort: 'value_desc' | 'value_asc' | 'label_asc' | 'label_desc';
  limit: number;
  bins: number;
  time_bucket: 'none' | 'day' | 'month' | 'year';
  columns: string[];
  page: number;
  page_size: number;
  search: string;
  sort_column: string | null;
  descending: boolean;
  position: number;
  width: 1 | 2;
  height: 240 | 340;
};
export type DashboardConfig = {
  version: 1;
  title: string;
  visuals: Visual[];
  filters: DashboardFilter[];
};
export type Point = {
  label?: string;
  key?: string | number | boolean | null;
  value?: number | null;
  records?: number;
  x?: number;
  y?: number;
};
export type VisualResult = {
  error?: string;
  value?: number | null;
  note?: string;
  points?: Point[];
  rows?: Row[];
  columns?: string[];
  total?: number;
  page?: number;
  pages?: number;
  cross_filterable?: boolean;
};
export type DashboardResult = {
  total_rows: number;
  filtered_rows: number;
  revision: number;
  results: Record<string, VisualResult>;
  insights: Insight[];
};
