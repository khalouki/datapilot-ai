export type Row = Record<string, string | number | boolean | null>;
export type Column = {
  name: string;
  type: string;
  dtype: string;
  unique_count: number;
  missing_count: number;
  missing_percentage: number;
  constant: boolean;
  high_cardinality: boolean;
  statistics: Record<string, number | null> | null;
};
export type Recommendation = {
  column: string;
  missing_count: number;
  missing_percentage: number;
  recommended_strategy: string;
  reason: string;
  alternative_strategies: string[];
};
export type Profile = {
  rows: number;
  columns_count: number;
  columns: Column[];
  missing_values: number;
  missing_percentage: number;
  duplicates: number;
  constant_columns: number;
  numeric_columns: string[];
  categorical_columns: string[];
  datetime_columns: string[];
  boolean_columns: string[];
  preview: Row[];
  quality: {
    score: number;
    factors: { name: string; penalty: number; weight: number }[];
    explanation: string;
  };
  recommendations: Recommendation[];
};
export type Insight = { level: string; title: string; detail: string };
export type Dataset = {
  dataset_id: string;
  name: string;
  profile: Profile;
  original_profile: Profile;
  actions: string[];
  insights: Insight[];
};
export type EDA = {
  numeric: Record<
    string,
    { histogram: { bin: string; count: number }[]; box: Record<string, number> }
  >;
  categorical: Record<
    string,
    {
      unique_count: number;
      most_frequent: string;
      frequency: number;
      distribution: { category: string; count: number }[];
    }
  >;
  scatter: Row[];
  scatter_sample_size: number;
};
export type Correlation = {
  method: string;
  threshold: number;
  columns: string[];
  matrix: (number | null)[][];
  pairs: {
    x: string;
    y: string;
    value: number;
    observations: number;
    strength: string;
    multicollinearity: boolean;
  }[];
  warning: string;
};
export type Outlier = {
  column: string;
  count: number;
  percentage: number;
  method: string;
  lower: number;
  upper: number;
  information: string;
  recommendation: string;
};
export type Model = {
  name: string;
  metrics: Record<string, number | null>;
  training_score: number;
  test_score: number;
  cv_scores: number[];
  validation_score: number;
  diagnostic: string;
  diagnostic_reason: string;
  learning_curve: { rows: number; training: number; validation: number }[];
  learning_curve_note: string;
  importance: { feature: string; value: number }[];
  importance_kind: string;
  confusion_matrix: number[][] | null;
  labels: string[] | null;
  warnings: string[];
};
export type ML = {
  target: string;
  task: string;
  source: string;
  train_rows: number;
  test_rows: number;
  excluded_rows: number;
  excluded_features: string[];
  split: string;
  features: string[];
  scoring: string;
  models: Model[];
  warning: string;
  class_distribution: Record<string, number> | null;
};
export type Anomaly = {
  count: number;
  percentage: number;
  total: number;
  features: string[];
  contamination: number;
  distribution: { bin: string; count: number }[];
  rows: Row[];
  row_numbers: number[];
  scores: number[];
  note: string;
};
export type Report = Dataset & {
  eda: EDA;
  correlations: Correlation;
  outliers: Outlier[];
  ml: ML | null;
  anomalies: Anomaly | null;
};
