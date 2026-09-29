from dataclasses import dataclass, field
from threading import RLock
from time import monotonic
from uuid import uuid4
import pandas as pd
from fastapi import HTTPException


@dataclass
class Dataset:
    name: str
    original: pd.DataFrame
    current: pd.DataFrame
    created: float = field(default_factory=monotonic)
    revision: int = 0
    dashboard_cache: dict = field(default_factory=dict)
    actions: list[str] = field(default_factory=list)
    ml: dict | None = None
    anomaly: dict | None = None
    anomaly_rows: pd.DataFrame | None = None
    lock: RLock = field(default_factory=RLock)


class Store:
    def __init__(self):
        self.datasets: dict[str, Dataset] = {}
        self.lock = RLock()

    def add(self, name, frame):
        with self.lock:
            self.datasets = {k: v for k, v in self.datasets.items() if monotonic() - v.created < 7200}
            size = int(frame.memory_usage(deep=True).sum()) * 2
            used = sum(int(d.original.memory_usage(deep=True).sum() + d.current.memory_usage(deep=True).sum()) for d in self.datasets.values())
            if size > 100_000_000 or used + size > 250_000_000 or len(self.datasets) >= 8:
                raise HTTPException(413, 'Local session capacity reached (8 datasets / 250 MB). Delete a dataset or restart the backend.')
            key = str(uuid4())
            self.datasets[key] = Dataset(name, frame.copy(deep=True), frame.copy(deep=True))
            return key

    def get(self, key):
        with self.lock:
            data = self.datasets.get(key)
            if not data or monotonic() - data.created > 7200:
                self.datasets.pop(key, None)
                raise HTTPException(404, 'Dataset expired or was not found. Upload it again; sessions last two hours.')
            return data


store = Store()
