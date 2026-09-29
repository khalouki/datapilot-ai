"""Read-only BI operations on the current working dataset."""
import math
import numpy as np
import pandas as pd
from app.schemas.dashboard import DashboardFilter, DashboardVisual, DashboardQuery
from app.services.profiling import kind
from app.services.insights import dashboard_insights
from app.utils.serialization import safe, records


def prepare(df):
    frame = df.replace([np.inf, -np.inf], np.nan).copy()
    types = {c: kind(frame[c]) for c in frame}
    for c, t in types.items():
        if t == 'datetime':
            frame[c] = pd.to_datetime(frame[c], errors='coerce', format='mixed', utc=True)
        elif t == 'boolean':
            frame[c] = frame[c].map(lambda v: str(v).lower() == 'true' if pd.notna(v) else None)
    return frame, types


def require_column(df, column):
    if column not in df:
        raise ValueError(f'Column {column!r} is unavailable in the working dataset. Edit or remove this visual/filter.')


def options(frame, column, search=''):
    require_column(frame, column)
    s = frame[column].dropna()
    counts = s.value_counts()
    if search:
        counts = counts[counts.index.astype(str).str.contains(search, case=False, regex=False)]
    values = [dict(value=v, label=str(v), count=int(n)) for v, n in counts.head(100).items()]
    if frame[column].isna().any() and (not search or 'missing' in search.lower()):
        values.append(dict(value=None, label='(Missing)', count=int(frame[column].isna().sum())))
    return safe(dict(options=values, truncated=len(counts) > 100))


def metadata(frame, types, revision):
    fields = []
    for col in frame:
        s = frame[col].dropna()
        t = types[col]
        item = dict(name=col, type=t, unique=int(s.nunique()), missing=int(frame[col].isna().sum()),
                    minimum=s.min() if t in ('numeric', 'datetime') and len(s) else None,
                    maximum=s.max() if t in ('numeric', 'datetime') and len(s) else None)
        if t in ('categorical', 'boolean'):
            item.update(options(frame, col))
        fields.append(item)
    return safe(dict(fields=fields, rows=len(frame), columns=len(frame.columns), revision=revision))


def apply_filters(frame, types, filters: list[DashboardFilter]):
    mask = pd.Series(True, index=frame.index)
    for f in filters:
        require_column(frame, f.column)
        s = frame[f.column]
        if f.kind in ('categorical', 'boolean'):
            if f.values:
                mask &= s.isin([v for v in f.values if v is not None]) | (s.isna() if None in f.values else False)
        elif f.kind == 'numeric':
            if types[f.column] != 'numeric':
                raise ValueError(f'{f.column} is not numeric. Clear or update its filter.')
            if f.minimum is not None:
                mask &= s >= f.minimum
            if f.maximum is not None:
                mask &= s <= f.maximum
        else:
            if types[f.column] != 'datetime':
                raise ValueError(f'{f.column} is not a date column. Clear or update its filter.')
            try:
                start = pd.to_datetime(f.start, utc=True) if f.start else None
                end = pd.to_datetime(f.end, utc=True) if f.end else None
            except (ValueError, TypeError):
                raise ValueError('Enter valid ISO dates for the date range.')
            if (start is not None and pd.isna(start)) or (end is not None and pd.isna(end)):
                raise ValueError('Enter valid ISO dates for the date range.')
            if start is not None and end is not None and start > end:
                raise ValueError('Date range start must not follow its end.')
            if start is not None:
                mask &= s >= start
            if end is not None:
                # Date-only end values include the full calendar day.
                mask &= s < end + pd.Timedelta(days=1) if len(f.end) == 10 else s <= end
    return frame.loc[mask]


def aggregate(series, aggregation):
    if aggregation == 'count':
        return int(series.count())
    if aggregation == 'distinct':
        return int(series.nunique())
    if not pd.api.types.is_numeric_dtype(series):
        raise ValueError(f'{aggregation} requires a numeric measure.')
    if aggregation == 'sum':
        return series.sum(min_count=1)
    return getattr(series, {'average': 'mean'}.get(aggregation, aggregation))()


def visual_data(frame, types, v: DashboardVisual, original=None):
    if v.type == 'kpi':
        if v.metric == 'column':
            require_column(frame, v.y)
            value = aggregate(frame[v.y], v.aggregation)
        else:
            value = {'rows': lambda: len(frame), 'columns': lambda: len(frame.columns),
                     'missing': lambda: int(frame.isna().sum().sum()),
                     'duplicates': lambda: int((original.loc[frame.index] if original is not None else frame).duplicated().sum())}[v.metric]()
        return dict(value=value, note='COUNT counts observed measure values; dataset Total Rows counts records. Empty numeric aggregates are undefined.')
    if v.type == 'table':
        cols = v.columns or list(frame.columns)[:6]
        for col in cols:
            require_column(frame, col)
        table = frame[cols]
        if v.search:
            match = pd.Series(False, index=table.index)
            for col in cols:
                match |= table[col].astype('string').str.contains(v.search, case=False, regex=False, na=False)
            table = table.loc[match]
        if v.sort_column:
            require_column(table, v.sort_column)
            table = table.sort_values(v.sort_column, ascending=not v.descending, kind='stable', na_position='last')
        total = len(table)
        pages = max(1, math.ceil(total / v.page_size))
        page = min(v.page, pages)
        return dict(rows=records(table.iloc[(page-1)*v.page_size:page*v.page_size], v.page_size),
                    columns=cols, total=total, page=page, pages=pages, note='Search applies to selected table columns only. Other visuals use the dashboard filters.')
    require_column(frame, v.x)
    if v.type in ('scatter', 'histogram'):
        if types[v.x] != 'numeric':
            raise ValueError('Select a numeric X field for this chart.')
        if v.type == 'scatter':
            require_column(frame, v.y)
            if types[v.y] != 'numeric' or v.x == v.y:
                raise ValueError('Scatter plots require two different numeric fields.')
            pairs = frame[[v.x, v.y]].dropna()
            sampled = pairs.sample(min(500, len(pairs)), random_state=42)
            return dict(points=[dict(x=a, y=b) for a, b in sampled.itertuples(index=False, name=None)],
                        note=f'{len(sampled):,} of {len(pairs):,} complete pairs shown; deterministic sample capped at 500.')
        s = frame[v.x].dropna()
        if s.empty:
            return dict(points=[], note='No observed numeric values under these filters.')
        counts, edges = np.histogram(s, bins=v.bins)
        return dict(points=[dict(label=f'{edges[i]:.4g}–{edges[i+1]:.4g}', value=int(n)) for i, n in enumerate(counts)],
                    note=f'{len(s):,} observed values. Bins are left-inclusive; final bin includes the maximum.')
    if v.y:
        require_column(frame, v.y)
    elif v.aggregation != 'count':
        raise ValueError('Choose a measure column for this aggregation.')
    grouped_frame = frame.copy(deep=False)
    groups = frame[v.x]
    is_date = types[v.x] == 'datetime'
    if v.type in ('line', 'area') and types[v.x] not in ('datetime', 'numeric'):
        raise ValueError('Line and area charts require an ordered numeric or date X field.')
    if is_date and v.time_bucket != 'none':
        groups = groups.dt.strftime({'day':'%Y-%m-%d','month':'%Y-%m','year':'%Y'}[v.time_bucket])
    grouped = grouped_frame.groupby(groups, dropna=False, sort=False)
    counts = grouped.size()
    if v.y:
        if v.aggregation not in ('count', 'distinct') and types[v.y] != 'numeric':
            raise ValueError(f'{v.aggregation} requires a numeric measure.')
        measure = grouped[v.y]
        values = measure.sum(min_count=1) if v.aggregation == 'sum' else getattr(
            measure, {'average': 'mean', 'distinct': 'nunique'}.get(v.aggregation, v.aggregation))()
    else:
        values = counts
    points = []
    for (label, value), count in zip(values.items(), counts):
        key = None if pd.isna(label) else label
        points.append(dict(key=key, label='(Missing)' if key is None else str(key), value=value, records=int(count)))
    if v.sort.startswith('label') or v.type in ('line', 'area'):
        points.sort(key=lambda p: (p['key'] is None, p['key'] if p['key'] is not None else ''), reverse=v.sort == 'label_desc')
    else:
        points.sort(key=lambda p: (pd.isna(p['value']), (p['value'] if v.sort == 'value_asc' else -p['value']) if pd.notna(p['value']) else 0))
    count = len(points)
    points = points[:v.limit]
    if v.type in ('pie', 'donut') and any(p['value'] < 0 for p in points if pd.notna(p['value'])):
        raise ValueError('Pie/donut charts cannot represent negative values. Use a bar chart instead.')
    return dict(points=points, groups=count, shown_groups=len(points),
                cross_filterable=not is_date,
                note=f'Showing {len(points)} of {count} groups. Missing categories are included; missing measures are excluded. '
                     + ('Trend charts use X order. ' if v.type in ('line', 'area') else '')
                     + ('Pie shares describe displayed aggregate values only.' if v.type in ('pie', 'donut') else ''))


def query(frame, types, request: DashboardQuery, original=None):
    filtered = apply_filters(frame, types, request.filters)
    results = {}
    for visual in request.visuals:
        try:
            results[visual.id] = safe(visual_data(filtered, types, visual, original))
        except (ValueError, TypeError, OverflowError) as error:
            results[visual.id] = dict(error=str(error))
    return dict(total_rows=len(frame), filtered_rows=len(filtered), results=results,
                insights=dashboard_insights(len(frame), len(filtered), request.visuals, results))
