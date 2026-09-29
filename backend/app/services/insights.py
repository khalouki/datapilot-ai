def insights(profile, correlation, ml=None, anomalies=None):
    result = []
    for c in profile['columns']:
        if c['missing_count']:
            result.append(dict(level='warning', title=f"{c['name']} has {c['missing_percentage']:.1f}% missing values", detail=f"{c['missing_count']:,} cells need a decision. Review the suggested treatment before applying changes."))
        stat = c['statistics']
        if stat and stat['skewness'] is not None and abs(stat['skewness']) > 1:
            direction = 'right' if stat['skewness'] > 0 else 'left'
            result.append(dict(level='info', title=f"{c['name']} is {direction}-skewed", detail=f"Observed skewness is {stat['skewness']:.2f}; median imputation may be more robust than mean imputation."))
        if c['constant']:
            result.append(dict(level='info', title=f"{c['name']} has no observed variation", detail='This column may offer little predictive information. Check its purpose before removal.'))
    if profile['duplicates']:
        result.append(dict(level='warning', title=f"{profile['duplicates']:,} duplicated rows detected", detail='Confirm whether these are repeated records or legitimate repeated observations.'))
    for pair in correlation['pairs'][:5]:
        if abs(pair['value']) >= correlation['threshold']:
            result.append(dict(level='info', title=f"{pair['x']} and {pair['y']} are correlated", detail=f"{correlation['method'].title()} r = {pair['value']:.2f} across {pair['observations']} complete pairs. They may carry redundant information; correlation does not imply causation."))
    if ml:
        counts = ml.get('class_distribution')
        if counts:
            majority = max(counts.values()) / sum(counts.values())
            if majority >= .7:
                result.append(dict(level='warning', title='Target classes are imbalanced', detail=f'The largest class represents {majority:.1%} of modeling observations. Inspect per-class confusion counts alongside weighted metrics.'))
        for m in ml['models']:
            result.append(dict(level='info', title=f"{m['name']}: {m['diagnostic']}", detail=m['diagnostic_reason']))
    if anomalies:
        result.append(dict(level='info', title=f"{anomalies['count']} potentially anomalous rows", detail=f"Isolation Forest flagged {anomalies['percentage']:.1f}% at a requested contamination of {anomalies['contamination']:.0%}. No rows were removed."))
    if not result:
        result.append(dict(level='info', title='No issues detected by the basic checks', detail='This does not establish correctness, representativeness, or fitness for a particular use.'))
    return result


def dashboard_insights(total, filtered, visuals, results):
    """BI observations use the same explicit rule-based insight contract."""
    found = [dict(level='info', title=f'{filtered:,} of {total:,} records in view',
                  detail=f'The current shared filters retain {filtered / total:.1%} of the working dataset.' if total else 'No source records available.')]
    for visual in visuals:
        result = results.get(visual.id, {})
        points = [p for p in result.get('points', []) if p.get('value') is not None]
        if result.get('error') or visual.type in ('scatter', 'histogram') or not points:
            continue
        peak = max(points, key=lambda p: p['value'])
        if visual.aggregation == 'count' and not visual.y and filtered:
            found.append(dict(level='info', title=f"{peak['label']}: {peak['value'] / filtered:.1%} of filtered records",
                              detail=f"Largest displayed category in {visual.title}; {peak['value']:,} records. Hidden groups, if any, remain in the denominator."))
        else:
            found.append(dict(level='info', title=f"{visual.title}: highest displayed value at {peak['label']}",
                              detail=f"Observed {visual.aggregation}: {peak['value']:.4g}. This compares displayed groups only and does not establish causality."))
    return found[:6]
