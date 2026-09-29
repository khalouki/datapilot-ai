import warnings
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.linear_model import LogisticRegression, LinearRegression
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.model_selection import train_test_split, StratifiedKFold, KFold, cross_val_score, learning_curve
from sklearn.metrics import (accuracy_score, precision_recall_fscore_support, confusion_matrix, roc_auc_score,
                             mean_absolute_error, mean_squared_error, r2_score)
from app.schemas.requests import TrainRequest
from app.utils.serialization import safe


def suggest_task(s):
    if not pd.api.types.is_numeric_dtype(s) or s.nunique() <= 10:
        return 'classification'
    return 'regression'


def train(df: pd.DataFrame, request: TrainRequest):
    if request.target not in df:
        raise ValueError('Choose an existing target column.')
    if set(request.exclude_columns) - set(df.columns):
        raise ValueError('An excluded feature does not exist.')
    if len(df) > 10000:
        raise ValueError('Model training is limited to 10,000 rows in this local MVP. Upload a representative sample.')
    data = df.replace([np.inf, -np.inf], np.nan).dropna(subset=[request.target]).drop_duplicates()
    if len(data) < 30:
        raise ValueError('Training requires at least 30 distinct rows with an observed target.')
    X = data.drop(columns=[request.target, *[c for c in request.exclude_columns if c != request.target]])
    if X.shape[1] == 0:
        raise ValueError('Keep at least one feature besides the target.')
    y = data[request.target]
    classification = request.task == 'classification'
    if classification:
        y = y.astype(str)
        counts = y.value_counts()
        if len(counts) < 2 or len(counts) > 30:
            raise ValueError('Classification requires between 2 and 30 target classes. Consider regression for continuous targets.')
        if counts.min() < 3 or int(np.ceil(len(y) * request.test_size)) < len(counts):
            raise ValueError('Each class needs at least 3 observations and the test split must fit every class.')
    else:
        y = pd.to_numeric(y, errors='coerce')
        if y.isna().any() or y.nunique() < 2:
            raise ValueError('Regression requires a varying numeric target. Choose classification or another target.')
    numeric = list(X.select_dtypes(include='number').columns)
    categorical = [c for c in X if c not in numeric]
    for c in categorical:
        X[c] = X[c].map(lambda v: str(v) if pd.notna(v) else np.nan)
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=request.test_size, random_state=42, stratify=y if classification else None)
    # Feature screening and all learned preprocessing use only training observations.
    excluded = [c for c in X_train if X_train[c].nunique() <= 1 or (c in categorical and X_train[c].nunique() > 100)]
    numeric = [c for c in numeric if c not in excluded]
    categorical = [c for c in categorical if c not in excluded]
    if not numeric and not categorical:
        raise ValueError('No usable features remain after excluding empty, constant, and >100-category features in the training split.')
    num_steps = [('impute', SimpleImputer(strategy='median', keep_empty_features=True))]
    if request.scale:
        num_steps.append(('scale', StandardScaler()))
    preprocessor = ColumnTransformer([
        ('numeric', Pipeline(num_steps), numeric),
        ('category', Pipeline([('impute', SimpleImputer(strategy='constant', fill_value='Unknown')), ('encode', OneHotEncoder(handle_unknown='ignore', max_categories=30))]), categorical)
    ])
    models = [('Logistic Regression', LogisticRegression(max_iter=1500)), ('Random Forest', RandomForestClassifier(n_estimators=80, max_depth=12, min_samples_leaf=2, random_state=42, n_jobs=1))] if classification else [
        ('Linear Regression', LinearRegression()), ('Random Forest', RandomForestRegressor(n_estimators=80, max_depth=12, min_samples_leaf=2, random_state=42, n_jobs=1))]
    folds = min(3, int(y_train.value_counts().min())) if classification else 3
    cv = StratifiedKFold(folds, shuffle=True, random_state=42) if classification and folds >= 2 else KFold(3, shuffle=True, random_state=42)
    scoring = 'f1_weighted' if classification else 'r2'
    results = []
    for name, model in models:
        pipe = Pipeline([('preprocess', preprocessor), ('model', model)])
        with warnings.catch_warnings(record=True) as caught:
            warnings.simplefilter('always')
            pipe.fit(X_train, y_train)
        prediction = pipe.predict(X_test)
        train_prediction = pipe.predict(X_train)
        matrix = None
        labels = None
        if classification:
            precision, recall, f1, _ = precision_recall_fscore_support(y_test, prediction, average='weighted', zero_division=0)
            metrics = dict(accuracy=accuracy_score(y_test, prediction), precision=precision, recall=recall, f1=f1, roc_auc=None)
            labels = list(pipe.classes_)
            matrix = confusion_matrix(y_test, prediction, labels=labels).tolist()
            if len(labels) == 2 and y_test.nunique() == 2:
                metrics['roc_auc'] = roc_auc_score(y_test == labels[1], pipe.predict_proba(X_test)[:, 1])
            train_score = precision_recall_fscore_support(y_train, train_prediction, average='weighted', zero_division=0)[2]
            test_score = f1
        else:
            metrics = dict(mae=mean_absolute_error(y_test, prediction), rmse=np.sqrt(mean_squared_error(y_test, prediction)), r2=r2_score(y_test, prediction))
            train_score, test_score = r2_score(y_train, train_prediction), metrics['r2']
        cv_scores = cross_val_score(pipe, X_train, y_train, cv=cv, scoring=scoring, error_score='raise', n_jobs=1)
        validation = float(np.mean(cv_scores))
        gap = train_score - validation
        interpretation = 'Possible overfitting / high-variance signal' if gap > .15 else 'Possible underfitting / high-bias signal' if train_score < .6 and validation < .6 else 'Reasonably balanced fit'
        reason = f'Training {scoring} is {train_score:.3f}; cross-validation is {validation:.3f} (gap {gap:.3f}). Thresholds of 0.15 for the gap and 0.60 for low scores are heuristic diagnostic indications, not proofs. Compare to a domain baseline.'
        curves = []
        curve_note = 'Learning curves require at least 100 training rows and at least 5 training observations per class.'
        if len(X_train) >= 100 and (not classification or y_train.value_counts().min() >= 5):
            try:
                with warnings.catch_warnings():
                    warnings.simplefilter('ignore')
                    sizes, tr, va = learning_curve(pipe, X_train, y_train, cv=cv, scoring=scoring, train_sizes=[.5, .75, 1.0], shuffle=True, random_state=42, error_score=np.nan, n_jobs=1)
                curves = [dict(rows=int(size), training=float(np.nanmean(t)), validation=float(np.nanmean(v))) for size, t, v in zip(sizes, tr, va)]
                curve_note = 'Training-set cross-validation only; failed folds are omitted from the mean.'
            except ValueError as error:
                curve_note = f'Curve unavailable for this sample: {error}'
        fitted = pipe.named_steps['model']
        names = pipe.named_steps['preprocess'].get_feature_names_out()
        values = fitted.feature_importances_ if hasattr(fitted, 'feature_importances_') else np.abs(fitted.coef_).mean(axis=0) if fitted.coef_.ndim > 1 else np.abs(fitted.coef_)
        importance = sorted([dict(feature=str(n).split('__', 1)[-1], value=float(v)) for n, v in zip(names, values)], key=lambda d: -d['value'])[:15]
        results.append(dict(name=name, metrics=metrics, training_score=train_score, test_score=test_score, cv_scores=cv_scores, validation_score=validation,
                            diagnostic=interpretation, diagnostic_reason=reason, learning_curve=curves, learning_curve_note=curve_note,
                            importance=importance, importance_kind='Impurity-based importance' if hasattr(fitted, 'feature_importances_') else 'Absolute coefficient magnitude (units depend on scaling)',
                            confusion_matrix=matrix, labels=labels, warnings=list(dict.fromkeys(str(w.message) for w in caught))))
    return safe(dict(target=request.target, task=request.task, source='Original upload; exploratory cleaning is not used for training.',
                     train_rows=len(X_train), test_rows=len(X_test), excluded_rows=len(df)-len(data), excluded_features=excluded,
                     split='Random 80/20 by default, seed 42; stratified for classification. Not appropriate for grouped or temporal prediction.',
                     features=numeric + categorical, scoring=scoring, models=results,
                     class_distribution=y.value_counts().to_dict() if classification else None,
                     warning='Preprocessing is fitted inside each training fold. Exact duplicate rows and missing targets are excluded only from this modeling view. Remove identifiers and any features that reveal the target before training. Feature importance does not imply causality.'))
