"""Reference returns and sample moments matching backend/src/models/returns.ts.

Conventions:
- Returns are aligned with the price they end on: returns[i] uses prices[i] and prices[i+1].
- Standard deviation is the sample estimate (n - 1 denominator).
- Skewness and excess kurtosis are the bias-adjusted estimators G1 and G2,
  the defaults in pandas and `scipy.stats` with `bias=False`.
"""

from dataclasses import dataclass

import numpy as np
import pandas as pd
from scipy import stats

MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000


@dataclass
class Moments:
    mean: float
    standard_deviation: float
    skewness: float
    excess_kurtosis: float


def log_returns(prices: np.ndarray) -> np.ndarray:
    return np.diff(np.log(prices))


def simple_returns(prices: np.ndarray) -> np.ndarray:
    return prices[1:] / prices[:-1] - 1


def periods_per_year(timestamps_ms: np.ndarray) -> float:
    avg_period = (timestamps_ms[-1] - timestamps_ms[0]) / (len(timestamps_ms) - 1)
    return MS_PER_YEAR / avg_period


def moments(x: np.ndarray) -> Moments:
    n = len(x)
    d = x - x.mean()
    m2 = np.mean(d**2)
    m3 = np.mean(d**3)
    m4 = np.mean(d**4)
    g1 = m3 / m2**1.5
    g2 = m4 / m2**2 - 3
    return Moments(
        mean=float(x.mean()),
        standard_deviation=float(np.sqrt(np.sum(d**2) / (n - 1))),
        skewness=float(g1 * np.sqrt(n * (n - 1)) / (n - 2)),
        excess_kurtosis=float(((n + 1) * g2 + 6) * (n - 1) / ((n - 2) * (n - 3))),
    )


def library_moments(x: np.ndarray) -> dict:
    """The same statistics from scipy and pandas, as an independent check."""
    s = pd.Series(x)
    return {
        "scipy": {
            "standardDeviation": float(np.std(x, ddof=1)),
            "skewness": float(stats.skew(x, bias=False)),
            "excessKurtosis": float(stats.kurtosis(x, fisher=True, bias=False)),
        },
        "pandas": {
            "standardDeviation": float(s.std()),
            "skewness": float(s.skew()),
            "excessKurtosis": float(s.kurt()),
        },
    }
