from typing import Literal
from pydantic import BaseModel, Field, model_validator

Aggregation = Literal['count', 'distinct', 'sum', 'average', 'min', 'max']
VisualType = Literal['kpi', 'bar', 'horizontal', 'line', 'area', 'pie', 'donut', 'scatter', 'histogram', 'table']


class DashboardFilter(BaseModel):
    column: str
    kind: Literal['categorical', 'numeric', 'datetime', 'boolean']
    values: list[str | float | bool | None] = Field(default_factory=list, max_length=200)
    minimum: float | None = Field(default=None, allow_inf_nan=False)
    maximum: float | None = Field(default=None, allow_inf_nan=False)
    start: str | None = None
    end: str | None = None

    @model_validator(mode='after')
    def ordered(self):
        if self.minimum is not None and self.maximum is not None and self.minimum > self.maximum:
            raise ValueError('Range minimum must not exceed maximum.')
        return self


class DashboardVisual(BaseModel):
    id: str = Field(min_length=1, max_length=100)
    type: VisualType
    title: str = Field(default='Untitled visual', max_length=160)
    x: str | None = None
    y: str | None = None
    aggregation: Aggregation = 'count'
    metric: Literal['column', 'rows', 'columns', 'missing', 'duplicates'] = 'rows'
    sort: Literal['value_desc', 'value_asc', 'label_asc', 'label_desc'] = 'value_desc'
    limit: int = Field(default=10, ge=1, le=50)
    bins: int = Field(default=15, ge=2, le=40)
    time_bucket: Literal['none', 'day', 'month', 'year'] = 'month'
    columns: list[str] = Field(default_factory=list, max_length=100)
    page: int = Field(default=1, ge=1, le=50000)
    page_size: int = Field(default=10, ge=5, le=100)
    search: str = Field(default='', max_length=200)
    sort_column: str | None = None
    descending: bool = False


class DashboardQuery(BaseModel):
    visuals: list[DashboardVisual] = Field(default_factory=list, max_length=24)
    filters: list[DashboardFilter] = Field(default_factory=list, max_length=30)

    @model_validator(mode='after')
    def unique_ids(self):
        if len({v.id for v in self.visuals}) != len(self.visuals):
            raise ValueError('Visual IDs must be unique.')
        return self
