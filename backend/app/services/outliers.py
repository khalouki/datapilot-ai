import pandas as pd


def analyze_outliers(df: pd.DataFrame):
    results = []
    for col in df.select_dtypes(include='number'):
        s = df[col].replace([float('inf'), -float('inf')], float('nan')).dropna()
        if len(s) < 4 or s.nunique() < 2:
            continue
        q1, q3 = s.quantile([.25, .75])
        iqr = q3 - q1
        low, high = q1 - 1.5 * iqr, q3 + 1.5 * iqr
        count = int(((s < low) | (s > high)).sum())
        results.append(dict(column=col, count=count, percentage=100 * count / len(s), method='IQR', lower=low, upper=high,
                            information='Outside Q1 − 1.5 × IQR or Q3 + 1.5 × IQR. Zero IQR can flag rare valid values.',
                            recommendation='Inspect context and measurement validity. A statistical outlier is not confirmed bad data.'))
        if len(s) >= 30 and abs(s.skew()) < .5 and s.std() > 0:
            count = int(((s - s.mean()).abs() / s.std() > 3).sum())
            results.append(dict(column=col, count=count, percentage=100 * count / len(s), method='Z-score', lower=s.mean() - 3 * s.std(), upper=s.mean() + 3 * s.std(),
                                information='|Z| > 3; offered for ≥30 observations and |skewness| < 0.5. Symmetry does not prove normality.',
                                recommendation='Review potential extremes; do not remove automatically.'))
    return results
