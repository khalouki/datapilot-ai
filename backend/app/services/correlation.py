import numpy as np
import pandas as pd
from app.utils.serialization import safe


def correlations(df: pd.DataFrame, method='pearson', threshold=.7):
    numeric = df.select_dtypes(include='number').replace([np.inf, -np.inf], np.nan)
    matrix = numeric.corr(method=method, min_periods=3)
    pairs = []
    names = list(matrix.columns)
    for i, a in enumerate(names):
        for b in names[i+1:]:
            r = matrix.loc[a, b]
            if pd.notna(r):
                pairs.append(dict(x=a, y=b, value=r, observations=int(numeric[[a, b]].dropna().shape[0]),
                                  strength='strong positive' if r >= threshold else 'strong negative' if r <= -threshold else 'weak / moderate',
                                  multicollinearity=bool(abs(r) >= .9)))
    return safe(dict(method=method, threshold=threshold, columns=names, matrix=matrix.values.tolist(), pairs=sorted(pairs, key=lambda x: -abs(x['value'])),
                     warning='Correlation does not imply causation. Pairwise complete observations are used; fewer than 3 observations or constant columns yield undefined correlations.'))
