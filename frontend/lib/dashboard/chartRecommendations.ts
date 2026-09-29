import type { Field, VisualType } from '@/types/dashboard';
export function recommend(x?: Field, y?: Field): { type: VisualType; reason: string }[] {
  if (!x) return [];
  if (x.type === 'datetime' && y?.type === 'numeric')
    return [
      {
        type: 'line',
        reason: 'An ordered date field and numeric measure make a trend chart useful.',
      },
      { type: 'area', reason: 'Show the same ordered trend with a filled area.' },
    ];
  if (x.type === 'numeric' && y?.type === 'numeric' && x.name !== y.name)
    return [
      { type: 'scatter', reason: 'Two numeric fields reveal relationships without grouping.' },
      { type: 'bar', reason: 'Compare an aggregated measure at each distinct X value.' },
    ];
  if (x.type === 'numeric' && !y)
    return [{ type: 'histogram', reason: 'Summarize the distribution of one numeric field.' }];
  if (x.type === 'categorical' || x.type === 'boolean')
    return [
      {
        type: 'bar',
        reason: y
          ? 'Compare the measure across categories.'
          : 'Compare record counts across categories.',
      },
      ...(!y && x.unique <= 7
        ? [
            {
              type: 'donut' as const,
              reason: 'A few categories make a part-to-whole chart readable.',
            },
          ]
        : []),
    ];
  return [{ type: 'bar', reason: 'Compare grouped values; choose a meaningful aggregation.' }];
}
