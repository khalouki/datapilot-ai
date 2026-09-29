import numpy as np
import pandas as pd
from app.services.outliers import analyze_outliers
from app.utils.serialization import records, safe

STRATEGIES = ['leave', 'mean', 'median', 'mode', 'constant', 'zero', 'ffill', 'bfill', 'interpolate', 'drop_rows', 'drop_column']


def kind(s: pd.Series) -> str:
    if pd.api.types.is_bool_dtype(s):
        return 'boolean'
    if pd.api.types.is_numeric_dtype(s):
        return 'numeric'
    if pd.api.types.is_datetime64_any_dtype(s):
        return 'datetime'
    vals = s.dropna().astype(str)
    if len(vals) and vals.str.lower().isin(['true', 'false']).all():
        return 'boolean'
    # Require date separators, so identifiers and numeric strings aren't guessed as dates.
    if len(vals) and vals.str.match(r'^\d{4}[-/]\d{1,2}[-/]\d{1,2}').all():
        if pd.to_datetime(vals, errors='coerce', format='mixed').notna().all():
            return 'datetime'
    return 'categorical'


def recommendations(df, columns):
    result = []
    for c in columns:
        if not c['missing_count']:
            continue
        s = df[c['name']].replace([np.inf, -np.inf], np.nan)
        pct, k = c['missing_percentage'], c['type']
        if pct >= 60:
            strategy, reason = 'drop_column', 'At least 60% is missing. Consider removal unless this feature is essential.'
        elif k == 'numeric':
            skew = s.skew()
            q1, q3 = s.quantile([.25, .75])
            has_extremes = ((s < q1 - 1.5 * (q3 - q1)) | (s > q3 + 1.5 * (q3 - q1))).any()
            strategy = 'median' if abs(skew) > .5 or has_extremes else 'mean'
            reason = 'Skewness or potential extremes make the median a robust candidate.' if strategy == 'median' else 'The observed distribution is roughly symmetric; mean imputation is a reasonable baseline.'
        elif k == 'datetime':
            strategy, reason = 'leave', 'Dates need context. Preserve missing dates unless an ordering or domain rule is known.'
        elif c['unique_count'] <= 10 and not s.mode().empty and (s == s.mode().iloc[0]).mean() > .5:
            strategy, reason = 'mode', 'A dominant category exists; mode is a candidate, but can reinforce imbalance.'
        else:
            strategy, reason = 'constant', 'An explicit Unknown category preserves uncertainty instead of guessing a category.'
        if pct < 2:
            reason += ' Missingness is below 2%; dropping affected rows is another option if it does not bias the sample.'
        alternatives = ['leave', 'mode', 'constant', 'drop_rows', 'drop_column', 'ffill', 'bfill']
        if k == 'numeric':
            alternatives += ['mean', 'median', 'zero', 'interpolate']
        result.append(dict(column=c['name'], missing_count=c['missing_count'], missing_percentage=pct,
                           recommended_strategy=strategy, reason=reason,
                           alternative_strategies=[x for x in alternatives if x != strategy]))
    return result


def profile(df: pd.DataFrame):
    n, p = df.shape
    finite = df.replace([np.inf, -np.inf], np.nan)
    columns = []
    for col in df:
        s, k = finite[col], kind(df[col])
        missing = int(s.isna().sum())
        unique = int(s.nunique())
        stats = None
        if k == 'numeric':
            stats = dict(count=int(s.count()), mean=s.mean(), median=s.median(), std=s.std(), variance=s.var(), min=s.min(), max=s.max(),
                         q1=s.quantile(.25), q3=s.quantile(.75), skewness=s.skew(), kurtosis=s.kurt())
        columns.append(dict(name=col, type=k, dtype=str(df[col].dtype), unique_count=unique, missing_count=missing,
                            missing_percentage=100 * missing / n if n else 0, constant=unique <= 1,
                            high_cardinality=k == 'categorical' and unique > 20 and unique / max(n, 1) > .5, statistics=stats))
    missing = int(finite.isna().sum().sum())
    duplicates = int(df.duplicated().sum())
    constants = sum(c['constant'] for c in columns)
    extreme = sum(c['missing_percentage'] >= 60 for c in columns)
    infinite = int(df.select_dtypes(include='number').isin([np.inf, -np.inf]).sum().sum())
    inconsistent = 0
    for col in df.select_dtypes(include=['object', 'string']):
        s = df[col].dropna().astype(str)
        normalized = s.str.strip().str.casefold()
        # Detect only observable whitespace/case variants, not domain validity.
        variants = s.groupby(normalized).nunique()
        inconsistent += int(s.str.strip().ne(s).sum()) + int(variants.sub(1).clip(lower=0).sum())
    outliers = analyze_outliers(finite)
    outlier_count = sum(x['count'] for x in outliers if x['method'] == 'IQR')
    cells = max(n * p, 1)
    factors = [dict(name='Missing or non-finite cells', penalty=40 * missing / cells, weight=40),
               dict(name='Duplicate rows', penalty=20 * duplicates / max(n, 1), weight=20),
               dict(name='Constant / empty columns', penalty=10 * constants / max(p, 1), weight=10),
               dict(name='Columns ≥60% missing', penalty=15 * extreme / max(p, 1), weight=15),
               dict(name='Detected infinity / text inconsistencies', penalty=10 * min(1, (infinite + inconsistent) / cells), weight=10),
               dict(name='Potential IQR outlier cells', penalty=5 * outlier_count / cells, weight=5)]
    score = round(max(0, 100 - sum(f['penalty'] for f in factors)), 1) if n and p else 0
    return safe(dict(rows=n, columns_count=p, columns=columns, missing_values=missing, missing_percentage=100 * missing / cells,
                     duplicates=duplicates, constant_columns=constants, high_cardinality_columns=[c['name'] for c in columns if c['high_cardinality']],
                     numeric_columns=[c['name'] for c in columns if c['type'] == 'numeric'],
                     categorical_columns=[c['name'] for c in columns if c['type'] == 'categorical'],
                     datetime_columns=[c['name'] for c in columns if c['type'] == 'datetime'],
                     boolean_columns=[c['name'] for c in columns if c['type'] == 'boolean'],
                     quality=dict(score=score, factors=factors, explanation='Project-specific heuristic, not an industry standard. Each penalty is its weight × observed proportion. Extreme missingness and non-finite cells deliberately contribute to multiple factors; outliers may be valid. Empty datasets score 0.'),
                     recommendations=recommendations(finite, columns), preview=records(df), non_finite_values=infinite))
