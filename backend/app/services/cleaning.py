import numpy as np
import pandas as pd
from app.schemas.requests import CleaningRequest


def clean(df: pd.DataFrame, request: CleaningRequest):
    result = df.copy(deep=True)
    actions = []
    referenced = set(request.missing) | set(request.drop_columns) | set(request.conversions)
    if request.order_by:
        referenced.add(request.order_by)
    unknown = referenced - set(df.columns)
    if unknown:
        raise ValueError(f'Unknown columns: {", ".join(sorted(unknown))}')
    for col, target in request.conversions.items():
        s = result[col]
        if target == 'numeric':
            converted = pd.to_numeric(s, errors='coerce')
        elif target == 'datetime':
            converted = pd.to_datetime(s, errors='coerce', format='mixed', utc=True)
        elif target == 'boolean':
            converted = s.astype(str).str.lower().map({'true': True, 'false': False, '1': True, '0': False}).astype('boolean')
        else:
            converted = s.astype('string')
        invalid = s.notna() & converted.isna()
        if invalid.any():
            raise ValueError(f'{col}: {int(invalid.sum())} values cannot convert to {target}. Nothing was changed.')
        result[col] = converted
        actions.append(f'Converted {col} to {target}.')
    ordered = any(a.strategy in ('ffill', 'bfill', 'interpolate') for a in request.missing.values())
    if ordered:
        if not request.order_by:
            raise ValueError('Choose an ordering column before forward fill, backward fill, or interpolation.')
        key = result[request.order_by]
        if key.isna().any() or key.duplicated().any():
            raise ValueError('Ordering column must contain unique, non-missing values.')
        result = result.sort_values(request.order_by, kind='stable')
        actions.append(f'Ordered rows by {request.order_by}. Interpolation uses equally spaced row positions.')
    drop = set(request.drop_columns)
    for col, action in request.missing.items():
        method = action.strategy
        if col in drop or method == 'leave':
            continue
        if method == 'drop_column':
            drop.add(col)
            continue
        s = result[col].replace([np.inf, -np.inf], np.nan)
        if method == 'drop_rows':
            result = result.loc[s.notna()].copy()
        elif method in ('mean', 'median', 'zero', 'interpolate'):
            if not pd.api.types.is_numeric_dtype(s):
                raise ValueError(f'{method} requires a numeric column: {col}')
            if method == 'zero' and not request.confirm_zero:
                raise ValueError('Confirm that zero has a meaningful domain interpretation for selected columns.')
            if method == 'interpolate':
                result[col] = s.interpolate(limit_area='inside')
            else:
                val = 0 if method == 'zero' else getattr(s, method)()
                if pd.isna(val):
                    raise ValueError(f'{col} has no observed values; choose a constant, drop, or leave unchanged.')
                result[col] = s.fillna(val)
        elif method == 'mode':
            mode = s.mode()
            if mode.empty:
                raise ValueError(f'{col} has no mode; choose a constant or leave unchanged.')
            result[col] = s.fillna(mode.iloc[0])
        elif method == 'constant':
            val = action.value if action.value is not None else 'Unknown'
            if pd.api.types.is_numeric_dtype(s):
                try:
                    val = float(val)
                    if not np.isfinite(val):
                        raise ValueError()
                except (ValueError, TypeError):
                    raise ValueError(f'{col} requires a finite numeric constant.')
            else:
                s = s.astype(object)
            result[col] = s.fillna(val)
        elif method in ('ffill', 'bfill'):
            result[col] = getattr(s, method)()
        actions.append(f'{col}: {method}.')
    if drop:
        result = result.drop(columns=sorted(drop))
        actions.append(f'Removed columns: {", ".join(sorted(drop))}.')
    if not len(result.columns):
        raise ValueError('Keep at least one column. Nothing was changed.')
    if request.remove_duplicates:
        count = int(result.duplicated().sum())
        result = result.drop_duplicates()
        actions.append(f'Removed {count} duplicate rows.')
    if result.empty:
        raise ValueError('These operations would remove every row. Nothing was changed.')
    return result.reset_index(drop=True), actions
