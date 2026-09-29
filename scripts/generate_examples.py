"""Reproducible synthetic examples; no personal or external data."""
from pathlib import Path
import numpy as np
import pandas as pd

rng = np.random.default_rng(42)
root = Path(__file__).resolve().parents[1] / 'examples'
root.mkdir(exist_ok=True)
n = 240
age = rng.integers(20, 70, n).astype(float)
tenure = rng.integers(1, 72, n).astype(float)
spend = rng.normal(85, 24, n).round(2)
plan = rng.choice(['Starter', 'Professional', 'Business'], n, p=[.4, .4, .2])
prob = 1 / (1 + np.exp(-(-.4 + .022 * (spend-85) - .03 * (tenure-25) + .5 * (plan == 'Starter'))))
churn = np.where(rng.random(n) < prob, 'Yes', 'No')
classification = pd.DataFrame({'age': age, 'tenure_months': tenure, 'monthly_spend': spend, 'total_spend': (spend * tenure).round(2), 'plan': plan, 'support_tickets': rng.poisson(2, n), 'churn': churn})
classification.loc[rng.choice(n, 18, False), 'age'] = np.nan
classification.loc[rng.choice(n, 12, False), 'monthly_spend'] = np.nan
classification.loc[rng.choice(n, 9, False), 'plan'] = None
classification.loc[4, 'monthly_spend'] = 980
classification = pd.concat([classification, classification.iloc[:6]], ignore_index=True)
classification.to_csv(root / 'classification.csv', index=False)
area = rng.normal(1500, 450, n).clip(400).round()
rooms = np.clip(np.round(area / 480 + rng.normal(0, .5, n)), 1, 7)
location = rng.choice(['Central', 'Suburban', 'Rural'], n)
years = rng.integers(0, 70, n)
price = (area * 190 + rooms * 12000 - years * 950 + (location == 'Central') * 75000 + rng.normal(0, 30000, n)).round()
regression = pd.DataFrame({'area_sqft': area, 'bedrooms': rooms, 'property_age': years, 'location': location, 'garage': rng.choice(['Yes', 'No'], n), 'price': price})
regression.loc[rng.choice(n, 16, False), 'area_sqft'] = np.nan
regression.loc[rng.choice(n, 10, False), 'location'] = None
regression.loc[7, 'area_sqft'] = 15000
regression = pd.concat([regression, regression.iloc[:5]], ignore_index=True)
regression.to_csv(root / 'regression.csv', index=False)
