import json
from fastapi import APIRouter, Query
from app.services.storage import store
from app.services import dashboard
from app.schemas.dashboard import DashboardQuery

router = APIRouter(prefix='/api/dashboard', tags=['Business intelligence'])


def prepared(d):
    if 'prepared' not in d.dashboard_cache:
        d.dashboard_cache['prepared'] = dashboard.prepare(d.current)
    return d.dashboard_cache['prepared']


@router.get('/{key}/schema')
def schema(key: str):
    d = store.get(key)
    with d.lock:
        if 'schema' not in d.dashboard_cache:
            d.dashboard_cache['schema'] = dashboard.metadata(*prepared(d), d.revision)
        return d.dashboard_cache['schema']


@router.get('/{key}/values')
def values(key: str, column: str, search: str = Query('', max_length=200)):
    d = store.get(key)
    with d.lock:
        return dashboard.options(prepared(d)[0], column, search)


@router.post('/{key}/query')
def query(key: str, request: DashboardQuery):
    d = store.get(key)
    with d.lock:
        cache_key = request.model_dump_json()
        cache = d.dashboard_cache.setdefault('queries', {})
        if cache_key not in cache:
            result = dashboard.query(*prepared(d), request, original=d.current)
            result['revision'] = d.revision
            if len(cache) >= 12:
                cache.pop(next(iter(cache)))
            # Large table payloads are served once, not retained in every cache entry.
            if len(json.dumps(result)) <= 1_000_000:
                cache[cache_key] = result
            return result
        return cache[cache_key]
