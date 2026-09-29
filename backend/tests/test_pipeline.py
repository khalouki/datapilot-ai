from io import BytesIO
import json
import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.storage import store
from app.services.profiling import profile
from app.services.cleaning import clean
from app.services.ml import train
from app.schemas.requests import CleaningRequest, TrainRequest

client = TestClient(app)

@pytest.fixture(autouse=True)
def clear():
    store.datasets.clear()
    yield
    store.datasets.clear()


def upload(text='x,category,target\n1,a,yes\n2,b,no\n,a,yes\n2,b,no\n'):
    response = client.post('/api/upload', files={'file': ('data.csv', text, 'text/csv')})
    assert response.status_code == 200, response.text
    return response.json()


def test_upload_profile_clean_reset_and_download():
    data = upload()
    key = data['dataset_id']
    assert data['profile']['rows'] == 4
    assert data['profile']['missing_values'] == 1
    assert data['profile']['duplicates'] == 1
    response = client.post(f'/api/clean/{key}', json={'missing': {'x': {'strategy': 'median'}}, 'remove_duplicates': True})
    assert response.status_code == 200, response.text
    assert response.json()['profile']['missing_values'] == 0
    assert response.json()['profile']['rows'] == 3
    assert response.json()['original_profile']['missing_values'] == 1
    assert client.get(f'/api/download/cleaned/{key}').status_code == 200
    assert client.post(f'/api/reset/{key}').json()['profile']['rows'] == 4


def test_atomic_failure_and_empty_result():
    data = upload()
    key = data['dataset_id']
    response = client.post(f'/api/clean/{key}', json={'conversions': {'category': 'numeric'}})
    assert response.status_code == 400
    assert client.get(f'/api/profile/{key}').json()['actions'] == []
    response = client.post(f'/api/clean/{key}', json={'drop_columns':['x','category','target']})
    assert response.status_code == 400
    assert client.get(f'/api/profile/{key}').json()['profile']['columns_count'] == 3


def test_missing_heuristics_and_strict_json():
    frame = pd.DataFrame({'empty':[np.nan]*5, 'constant':[2]*5, 'category':['a',None,'b','a','b'], 'infinite':[np.inf,1,2,3,4]})
    p = profile(frame)
    json.dumps(p, allow_nan=False)
    assert p['missing_values'] == 7
    assert p['recommendations'][0]['recommended_strategy'] == 'drop_column'
    assert p['quality']['score'] == round(100-sum(f['penalty'] for f in p['quality']['factors']),1)


@pytest.mark.parametrize('contents', ['', 'x,y\n', 'x,x\n1,2\n', ',y\n1,2\n'])
def test_invalid_upload(contents):
    assert client.post('/api/upload', files={'file':('data.csv', contents)}).status_code == 400


def test_xlsx_and_filename():
    buf = BytesIO()
    pd.DataFrame({'a':[1,2], 'b':['x','y']}).to_excel(buf,index=False)
    response = client.post('/api/upload', files={'file':('../../danger.xlsx',buf.getvalue())})
    assert response.status_code == 200, response.text
    assert response.json()['name'] == 'danger.xlsx'
    assert response.json()['profile']['rows'] == 2


def test_categorical_only_and_small_numeric():
    data = upload('color,flag\nred,true\nblue,false\nred,true\n')
    key=data['dataset_id']
    assert client.get(f'/api/eda/{key}').json()['numeric'] == {}
    assert client.get(f'/api/correlations/{key}').json()['columns'] == []
    assert client.get(f'/api/outliers/{key}').json() == []
    assert client.post(f'/api/anomalies/{key}',json={}).status_code == 400
    assert client.post(f'/api/ml/train/{key}',json={'target':'flag','task':'classification'}).status_code == 400
    assert profile(pd.DataFrame({'x':[1]}))['columns'][0]['statistics']['std'] is None


def test_ordering_and_zero_require_explicit_context():
    frame = pd.DataFrame({'time':[3,1,2], 'x':[3,1,np.nan]})
    with pytest.raises(ValueError,match='ordering'):
        clean(frame, CleaningRequest(missing={'x':{'strategy':'interpolate'}}))
    out,_=clean(frame,CleaningRequest(missing={'x':{'strategy':'interpolate'}},order_by='time'))
    assert out.x.tolist() == [1,2,3]
    with pytest.raises(ValueError,match='Confirm'):
        clean(frame,CleaningRequest(missing={'x':{'strategy':'zero'}}))
    assert frame.x.isna().sum()==1


@pytest.mark.parametrize('example,target,task',[('classification','churn','classification'),('regression','price','regression')])
def test_full_example_workflow(example,target,task):
    response=client.post(f'/api/examples/{example}')
    assert response.status_code==200,response.text
    key=response.json()['dataset_id']
    assert client.get(f'/api/eda/{key}').status_code==200
    assert client.get(f'/api/correlations/{key}?method=spearman').status_code==200
    assert client.get(f'/api/outliers/{key}').status_code==200
    result=client.post(f'/api/ml/train/{key}',json={'target':target,'task':task})
    assert result.status_code==200,result.text
    result=result.json()
    assert len(result['models'])==2
    assert result['train_rows']+result['test_rows']==240
    for m in result['models']:
        assert len(m['cv_scores'])==3
        assert m['importance']
        assert m['learning_curve']
    a=client.post(f'/api/anomalies/{key}',json={'contamination':.05})
    assert a.status_code==200,a.text
    assert a.json()['count']>0
    assert client.get(f'/api/download/anomalies/{key}').status_code==200
    report=client.get(f'/api/report/{key}')
    assert report.status_code==200
    assert report.json()['ml']['target']==target
    assert report.json()['anomalies']['count']==a.json()['count']


def test_ml_uses_original_and_imputation_fits_on_training_only(monkeypatch):
    from sklearn.impute import SimpleImputer
    observed=[]
    original=SimpleImputer.fit
    def traced(self,X,y=None):
        observed.append(len(X))
        return original(self,X,y)
    monkeypatch.setattr(SimpleImputer,'fit',traced)
    data=client.post('/api/examples/regression').json()
    key=data['dataset_id']
    assert client.post(f'/api/clean/{key}',json={'drop_columns':['price']}).status_code==200
    response=client.post(f'/api/ml/train/{key}',json={'target':'price','task':'regression'})
    assert response.status_code==200,response.text
    assert observed and max(observed)<=response.json()['train_rows']
    assert response.json()['target']=='price'


def test_undefined_correlation_and_formula_export():
    data=upload('constant,value,text\n1,3,=SUM(A1)\n1,4,safe\n1,5,normal\n')
    key=data['dataset_id']
    c=client.get(f'/api/correlations/{key}').json()
    assert c['matrix'][0][0] is None
    assert "'=SUM(A1)" in client.get(f'/api/download/cleaned/{key}').text
    assert data['profile']['preview'][0]['text']=='=SUM(A1)'


def test_reject_oversized_and_invalid_format():
    assert client.post('/api/upload',files={'file':('data.csv',b'x'*(10*1024*1024+1))}).status_code in [400,413]
    assert client.post('/api/upload',files={'file':('data.txt',b'x\n1')}).status_code==400
    assert client.get('/api/profile/missing').status_code==404


@pytest.mark.parametrize('contents',['a,b\n1,2,3\n', 'a,b\n1\n', 'a,b\n"unclosed,2\n'])
def test_ragged_csv_is_not_silently_reindexed(contents):
    response=client.post('/api/upload',files={'file':('ragged.csv',contents)})
    assert response.status_code==400
    assert 'CSV' in response.json()['detail']


def test_quoted_multiline_csv_is_preserved():
    data=upload('id,comment\n1,"first line\nsecond line"\n2,normal\n')
    assert data['profile']['preview'][0]['comment']=='first line\nsecond line'


def test_non_workbook_zip_has_useful_error():
    from zipfile import ZipFile
    buf=BytesIO()
    with ZipFile(buf,'w') as z:
        z.writestr('readme.txt','not a workbook')
    response=client.post('/api/upload',files={'file':('not-excel.xlsx',buf.getvalue())})
    assert response.status_code==400
    assert 'valid Excel workbook' in response.json()['detail']


def test_request_cap_without_content_length():
    from app.utils.limits import RequestSizeLimit
    import asyncio
    sent=[]
    called=[]
    async def downstream(scope,receive,send):
        called.append(True)
    messages=iter([{'type':'http.request','body':b'12345','more_body':True},
                   {'type':'http.request','body':b'67890','more_body':False}])
    async def receive():
        return next(messages)
    async def send(message):
        sent.append(message)
    asyncio.run(RequestSizeLimit(downstream,maximum=8)({'type':'http','method':'POST'},receive,send))
    assert sent[0]['status']==413
    assert not called
