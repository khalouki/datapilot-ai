from io import StringIO
from pathlib import Path
from typing import Literal
from fastapi import APIRouter, UploadFile, File, HTTPException, Query
from fastapi.responses import Response
from app.services.storage import store
from app.services.upload import parse_upload, MAX_BYTES
from app.services.profiling import profile
from app.services.cleaning import clean
from app.services.eda import eda
from app.services.correlation import correlations
from app.services.outliers import analyze_outliers
from app.services.ml import train, suggest_task
from app.services.anomalies import anomalies
from app.services.insights import insights
from app.schemas.requests import CleaningRequest, TrainRequest, AnomalyRequest
from app.utils.serialization import safe

router = APIRouter(prefix='/api')


def payload(key):
    d = store.get(key)
    with d.lock:
        p = profile(d.current)
        c = correlations(d.current)
        return dict(dataset_id=key, name=d.name, profile=p, original_profile=profile(d.original), actions=d.actions,
                    insights=insights(p, c, d.ml, d.anomaly))


@router.get('/health')
def health():
    return {'status': 'ok'}


@router.post('/upload')
def upload(file: UploadFile = File(...)):
    try:
        content = file.file.read(MAX_BYTES + 1)
        name, df = parse_upload(content, file.filename or '')
        key = store.add(name, df)
        return payload(key)
    finally:
        file.file.close()


@router.post('/examples/{example}')
def example(example: Literal['classification', 'regression']):
    path = Path(__file__).resolve().parents[3] / 'examples' / f'{example}.csv'
    name, df = parse_upload(path.read_bytes(), path.name)
    return payload(store.add(name, df))


@router.get('/profile/{key}')
def get_profile(key: str):
    return payload(key)


@router.post('/clean/{key}')
def cleaning(key: str, request: CleaningRequest):
    d = store.get(key)
    with d.lock:
        updated, actions = clean(d.current, request)
        if updated.memory_usage(deep=True).sum() > 50_000_000:
            raise HTTPException(413, 'Cleaned data exceeds the 50 MB in-memory dataset limit.')
        d.current = updated
        d.revision += 1
        d.dashboard_cache.clear()
        d.actions.extend(actions)
        d.anomaly = d.anomaly_rows = None
        return payload(key)


@router.post('/reset/{key}')
def reset(key: str):
    d = store.get(key)
    with d.lock:
        d.current = d.original.copy(deep=True)
        d.actions = []
        d.revision += 1
        d.dashboard_cache.clear()
        d.ml = d.anomaly = d.anomaly_rows = None
        return payload(key)


@router.delete('/datasets/{key}')
def delete(key: str):
    with store.lock:
        store.datasets.pop(key, None)
    return {'deleted': True}


@router.get('/eda/{key}')
def get_eda(key: str):
    d = store.get(key)
    with d.lock:
        return eda(d.current)


@router.get('/correlations/{key}')
def get_correlations(key: str, method: Literal['pearson', 'spearman'] = 'pearson', threshold: float = Query(.7, ge=.1, le=1)):
    d = store.get(key)
    with d.lock:
        return correlations(d.current, method, threshold)


@router.get('/outliers/{key}')
def get_outliers(key: str):
    d = store.get(key)
    with d.lock:
        return safe(analyze_outliers(d.current))


@router.get('/ml/targets/{key}')
def targets(key: str):
    d = store.get(key)
    return {c: suggest_task(d.original[c]) for c in d.original}


@router.post('/ml/train/{key}')
def training(key: str, request: TrainRequest):
    d = store.get(key)
    with d.lock:
        d.ml = train(d.original, request)
        return d.ml


@router.post('/anomalies/{key}')
def run_anomalies(key: str, request: AnomalyRequest):
    d = store.get(key)
    with d.lock:
        d.anomaly, d.anomaly_rows = anomalies(d.current, request.contamination)
        return d.anomaly


@router.get('/report/{key}')
def report(key: str):
    d = store.get(key)
    with d.lock:
        result = payload(key)
        result.update(eda=eda(d.current), correlations=correlations(d.current), outliers=safe(analyze_outliers(d.current)), ml=d.ml, anomalies=d.anomaly)
        return result


def csv_response(df, filename, spreadsheet_safe):
    export = df.copy()
    if spreadsheet_safe:
        for c in export.select_dtypes(include=['object', 'string']):
            export[c] = export[c].map(lambda v: "'" + v if isinstance(v, str) and v.lstrip().startswith(('=', '+', '-', '@', '\t', '\r')) else v)
        export.columns = ["'" + c if c.lstrip().startswith(('=', '+', '-', '@')) else c for c in export.columns]
    return Response(export.to_csv(index=False), media_type='text/csv', headers={'Content-Disposition': f'attachment; filename="{filename}"'})


@router.get('/download/{variant}/{key}')
def download(variant: Literal['cleaned', 'anomalies'], key: str, spreadsheet_safe: bool = True):
    d = store.get(key)
    with d.lock:
        frame = d.current if variant == 'cleaned' else d.anomaly_rows
        if frame is None:
            raise HTTPException(400, 'Run anomaly analysis before downloading flagged rows.')
        return csv_response(frame, f'datapilot-{variant}.csv', spreadsheet_safe)
