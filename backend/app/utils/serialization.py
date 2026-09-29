import json
import numpy as np
import pandas as pd


def safe(value):
    """Return strict JSON values, including undefined sample statistics."""
    if isinstance(value, dict):
        return {str(k): safe(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, np.ndarray)):
        return [safe(v) for v in value]
    if isinstance(value, (np.integer, np.floating, np.bool_)):
        value = value.item()
    if isinstance(value, float) and not np.isfinite(value):
        return None
    if value is pd.NA or value is pd.NaT:
        return None
    if isinstance(value, (pd.Timestamp,)):
        return value.isoformat()
    return value


def records(df: pd.DataFrame, limit: int = 50):
    return json.loads(df.head(limit).to_json(orient='records', date_format='iso'))
