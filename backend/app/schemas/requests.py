from typing import Literal
from pydantic import BaseModel, Field


class MissingAction(BaseModel):
    strategy: Literal['leave', 'mean', 'median', 'mode', 'constant', 'zero', 'ffill', 'bfill', 'interpolate', 'drop_rows', 'drop_column'] = 'leave'
    value: str | float | None = None


class CleaningRequest(BaseModel):
    missing: dict[str, MissingAction] = Field(default_factory=dict)
    remove_duplicates: bool = False
    drop_columns: list[str] = Field(default_factory=list)
    conversions: dict[str, Literal['numeric', 'datetime', 'string', 'boolean']] = Field(default_factory=dict)
    order_by: str | None = None
    confirm_zero: bool = False


class TrainRequest(BaseModel):
    target: str
    task: Literal['classification', 'regression']
    scale: bool = True
    test_size: float = Field(default=.2, ge=.15, le=.4)
    exclude_columns: list[str] = Field(default_factory=list)


class AnomalyRequest(BaseModel):
    contamination: float = Field(default=.05, ge=.01, le=.3)
