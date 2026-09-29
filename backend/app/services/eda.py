import numpy as np
import pandas as pd
from app.services.profiling import kind
from app.utils.serialization import safe, records


def eda(df: pd.DataFrame):
    numeric, categorical = {}, {}
    for col in df:
        s = df[col].replace([np.inf, -np.inf], np.nan).dropna()
        k = kind(df[col])
        if k == 'numeric' and len(s):
            counts, edges = np.histogram(s, bins=min(20, max(1, int(np.sqrt(len(s))))))
            q1, med, q3 = s.quantile([.25, .5, .75])
            lo, hi = q1 - 1.5 * (q3 - q1), q3 + 1.5 * (q3 - q1)
            numeric[col] = dict(histogram=[dict(bin=f'{edges[i]:.3g}–{edges[i+1]:.3g}', count=int(c)) for i, c in enumerate(counts)],
                                box=dict(min=s.min(), q1=q1, median=med, q3=q3, max=s.max(), lower=s[s >= lo].min(), upper=s[s <= hi].max()))
        elif k in ('categorical', 'boolean') and len(s):
            counts = s.astype(str).value_counts()
            dist = [dict(category=str(v), count=int(c)) for v, c in counts.head(12).items()]
            if len(counts) > 12:
                dist.append(dict(category='Other categories (combined)', count=int(counts.iloc[12:].sum())))
            categorical[col] = dict(unique_count=s.nunique(), most_frequent=str(counts.index[0]), frequency=int(counts.iloc[0]), distribution=dist)
    nums = list(numeric)
    sample = df[nums].replace([np.inf, -np.inf], np.nan).sample(min(len(df), 500), random_state=42) if nums else pd.DataFrame()
    return safe(dict(numeric=numeric, categorical=categorical, scatter=records(sample, 500), scatter_sample_size=len(sample)))
