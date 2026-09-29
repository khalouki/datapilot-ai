from pathlib import Path
import json
import pandas as pd
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.storage import store

client=TestClient(app)

@pytest.fixture(autouse=True)
def clear_store():
    store.datasets.clear()
    yield
    store.datasets.clear()


def upload(data='group,value,date,flag\na,10,2024-01-01,true\na,20,2024-01-02,false\nb,30,2024-02-01,true\nb,,2024-02-02,false\n'):
    r=client.post('/api/upload',files={'file':('bi.csv',data)})
    assert r.status_code==200,r.text
    return r.json()['dataset_id']


def query(key,visuals,filters=None):
    r=client.post(f'/api/dashboard/{key}/query',json={'visuals':visuals,'filters':filters or []})
    assert r.status_code==200,r.text
    json.dumps(r.json(),allow_nan=False)
    return r.json()


@pytest.mark.parametrize('aggregation,expected',[('count',3),('distinct',3),('sum',60),('average',20),('min',10),('max',30)])
def test_column_aggregations(aggregation,expected):
    key=upload()
    data=query(key,[{'id':'k','type':'kpi','metric':'column','y':'value','aggregation':aggregation}])
    assert data['results']['k']['value']==expected


def test_count_records_vs_observed_and_missing_groups():
    key=upload('group,value\na,10\na,\n,20\n,\n')
    results=query(key,[{'id':'records','type':'bar','x':'group','aggregation':'count'}, {'id':'observed','type':'bar','x':'group','y':'value','aggregation':'count'}])['results']
    assert sum(p['value'] for p in results['records']['points'])==4
    assert sum(p['value'] for p in results['observed']['points'])==2
    assert any(p['key'] is None for p in results['records']['points'])


def test_shared_filters_intersection_and_source_unchanged():
    key=upload()
    results=query(key,[{'id':'rows','type':'kpi'},{'id':'bars','type':'bar','x':'group'}],
                  [{'column':'group','kind':'categorical','values':['a']},{'column':'value','kind':'numeric','minimum':15}])
    assert results['filtered_rows']==1
    assert results['results']['rows']['value']==1
    assert results['results']['bars']['points'][0]['value']==1
    assert client.get(f'/api/profile/{key}').json()['profile']['rows']==4
    assert '25.0%' in results['insights'][0]['detail']


def test_date_boolean_and_missing_filters():
    key=upload()
    assert query(key,[],[{'column':'date','kind':'datetime','start':'2024-01-01','end':'2024-01-31'}])['filtered_rows']==2
    assert query(key,[],[{'column':'flag','kind':'boolean','values':[True]}])['filtered_rows']==2
    assert query(key,[],[{'column':'value','kind':'categorical','values':[None]}])['filtered_rows']==1
    assert query(key,[],[{'column':'flag','kind':'boolean','values':[False]},{'column':'date','kind':'datetime','end':'2024-01-02'}])['filtered_rows']==1


def test_empty_filter_results_and_undefined_aggregates():
    key=upload()
    r=query(key,[{'id':'sum','type':'kpi','metric':'column','y':'value','aggregation':'sum'}, {'id':'rows','type':'kpi'}, {'id':'hist','type':'histogram','x':'value'}],[{'column':'value','kind':'numeric','minimum':100}])
    assert r['results']['sum']['value'] is None
    assert r['results']['rows']['value']==0
    assert r['results']['hist']['points']==[]


def test_table_search_sort_pagination_and_limits():
    key=upload('n,category\n'+''.join(f'{i},group{i%2}\n' for i in range(30)))
    r=query(key,[{'id':'t','type':'table','columns':['n','category'],'search':'group1','sort_column':'n','descending':True,'page':2,'page_size':5}])['results']['t']
    assert r['total']==15 and r['pages']==3
    assert [row['n'] for row in r['rows']]==[19,17,15,13,11]
    assert client.post(f'/api/dashboard/{key}/query',json={'visuals':[{'id':'t','type':'table','page_size':10000}]}).status_code==422


def test_invalid_filter_and_isolated_widget_error():
    key=upload()
    r=client.post(f'/api/dashboard/{key}/query',json={'filters':[{'column':'gone','kind':'categorical','values':['x']}]})
    assert r.status_code==400
    r=query(key,[{'id':'bad','type':'scatter','x':'group','y':'value'},{'id':'good','type':'kpi'},{'id':'missing','type':'bar','x':'gone'}])
    assert 'error' in r['results']['bad'] and 'error' in r['results']['missing']
    assert r['results']['good']['value']==4
    assert client.post(f'/api/dashboard/{key}/query',json={'filters':[{'column':'value','kind':'numeric','minimum':9,'maximum':1}]}).status_code==422
    assert client.post(f'/api/dashboard/{key}/query',json={'filters':[{'column':'date','kind':'datetime','start':'bad-date'}]}).status_code==400


def test_date_buckets_and_pie_negative_guard():
    key=upload()
    r=query(key,[{'id':'trend','type':'line','x':'date','y':'value','aggregation':'sum','time_bucket':'month'}])['results']['trend']
    assert [p['label'] for p in r['points']]==['2024-01','2024-02']
    assert [p['value'] for p in r['points']]==[30,30]
    key=upload('group,value\na,-3\nb,10\n')
    assert 'error' in query(key,[{'id':'pie','type':'pie','x':'group','y':'value','aggregation':'sum'}])['results']['pie']


def test_cache_invalidation_on_clean_and_reset():
    key=upload()
    visual=[{'id':'k','type':'kpi','metric':'missing'}]
    assert query(key,visual)['results']['k']['value']==1
    old=client.get(f'/api/dashboard/{key}/schema').json()
    assert store.get(key).dashboard_cache
    assert client.post(f'/api/clean/{key}',json={'missing':{'value':{'strategy':'median'}}}).status_code==200
    assert not store.get(key).dashboard_cache
    r=query(key,visual)
    assert r['results']['k']['value']==0 and r['revision']>old['revision']
    assert client.post(f'/api/reset/{key}').status_code==200
    assert query(key,visual)['results']['k']['value']==1


def test_scatter_sample_histogram_totals_and_top_n():
    key=upload('x,y,category\n'+''.join(f'{i},{i*2},cat{i%9}\n' for i in range(600)))
    r=query(key,[{'id':'s','type':'scatter','x':'x','y':'y'},{'id':'h','type':'histogram','x':'x','bins':12},{'id':'b','type':'bar','x':'category','limit':3}])['results']
    assert len(r['s']['points'])==500
    assert sum(p['value'] for p in r['h']['points'])==600
    assert len(r['b']['points'])==3 and r['b']['groups']==9


def test_titanic_filters_and_aggregations_against_pandas():
    path=Path(__file__).resolve().parents[2]/'examples'/'titanic.csv'
    frame=pd.read_csv(path)
    key=upload(path.read_bytes())
    female=frame[frame.sex=='female']
    r=query(key,[{'id':'rows','type':'kpi'},{'id':'fare','type':'kpi','metric':'column','y':'fare','aggregation':'average'},{'id':'survival','type':'bar','x':'pclass','y':'survived','aggregation':'average'}],[{'column':'sex','kind':'categorical','values':['female']}])
    assert r['total_rows']==len(frame)==891
    assert r['filtered_rows']==len(female)==314
    assert r['results']['fare']['value']==pytest.approx(female.fare.mean())
    expected=female.groupby('pclass').survived.mean().to_dict()
    assert {p['key']:p['value'] for p in r['results']['survival']['points']}==pytest.approx(expected)


def test_schema_and_searchable_categories():
    key=upload('category\n'+''.join(f'name-{i}\n' for i in range(150)))
    meta=client.get(f'/api/dashboard/{key}/schema').json()
    assert meta['fields'][0]['truncated']
    r=client.get(f'/api/dashboard/{key}/values',params={'column':'category','search':'name-149'}).json()
    assert r['options'][0]['value']=='name-149'


def test_duplicate_kpi_preserves_exact_working_values():
    key=upload('value\nNaN\ninf\n')
    result=query(key,[{'id':'d','type':'kpi','metric':'duplicates'},{'id':'m','type':'kpi','metric':'missing'}])
    assert result['results']['d']['value']==0
    assert result['results']['m']['value']==2
    assert client.get(f'/api/profile/{key}').json()['profile']['duplicates']==0
