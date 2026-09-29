import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from app.utils.serialization import records, safe


def anomalies(df: pd.DataFrame, contamination=.05):
    numeric = df.select_dtypes(include='number').replace([np.inf, -np.inf], np.nan)
    numeric = numeric.loc[:, numeric.nunique() > 1]
    if len(df) < 10 or numeric.shape[1] == 0:
        raise ValueError('Anomaly analysis requires at least 10 rows and one varying numeric feature.')
    pipe = Pipeline([('impute', SimpleImputer(strategy='median')), ('scale', StandardScaler()),
                     ('forest', IsolationForest(n_estimators=100, contamination=contamination, random_state=42, n_jobs=1))])
    labels = pipe.fit_predict(numeric)
    transformed = pipe[:-1].transform(numeric)
    scores = -pipe[-1].score_samples(transformed)
    mask = labels == -1
    flagged = df.loc[mask].copy()
    counts, edges = np.histogram(scores, bins=16)
    result = dict(count=int(mask.sum()), percentage=100 * mask.mean(), total=len(df), features=list(numeric.columns), contamination=contamination,
                  distribution=[dict(bin=f'{edges[i]:.3f}', count=int(v)) for i, v in enumerate(counts)],
                  rows=records(flagged, 100), row_numbers=(np.flatnonzero(mask) + 1).tolist()[:100], scores=scores[mask].tolist()[:100],
                  note='Higher scores are more unusual. Contamination controls the expected flagged fraction; flags are not confirmed errors. Preview capped at 100; export contains every flagged row.')
    return safe(result), flagged
