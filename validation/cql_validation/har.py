"""Reference HAR-RV matching backend/src/models/har.ts.

Corsi (2009) on daily data. Without intraday prices, each day's realized
variance is its squared log return. Crypto trades every day, so the weekly and
monthly components average the last 7 and 30 days rather than 5 and 22.

    RV[t+1] = b0 + bd * RV[t] + bw * mean(RV[t-6..t]) + bm * mean(RV[t-29..t]) + e

Estimated by ordinary least squares. Multi-day forecasts iterate the equation,
feeding each forecast back in as the next day's RV.
"""

from dataclasses import dataclass

import numpy as np
import statsmodels.api as sm

WEEK = 7
MONTH = 30


@dataclass
class HarFit:
    params: np.ndarray  # b0, bd, bw, bm
    r_squared: float
    nobs: int


def design(rv: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    rows = range(MONTH - 1, len(rv) - 1)
    X = np.array([[1.0, rv[t], rv[t - WEEK + 1 : t + 1].mean(), rv[t - MONTH + 1 : t + 1].mean()] for t in rows])
    y = np.array([rv[t + 1] for t in rows])
    return X, y


def fit(rv: np.ndarray) -> HarFit:
    X, y = design(rv)
    params, *_ = np.linalg.lstsq(X, y, rcond=None)
    resid = y - X @ params
    r_squared = 1 - np.sum(resid**2) / np.sum((y - y.mean()) ** 2)
    return HarFit(params=params, r_squared=float(r_squared), nobs=len(y))


def forecast(f: HarFit, rv: np.ndarray, steps: int) -> np.ndarray:
    history = list(rv)
    out = []
    for _ in range(steps):
        x = np.array([1.0, history[-1], np.mean(history[-WEEK:]), np.mean(history[-MONTH:])])
        nxt = float(x @ f.params)
        history.append(nxt)
        out.append(nxt)
    return np.array(out)


def statsmodels_cross_check(rv: np.ndarray) -> dict:
    """The same regression with statsmodels OLS, plus HAC t-statistics for the notes."""
    X, y = design(rv)
    res = sm.OLS(y, X).fit()
    hac = res.get_robustcov_results(cov_type="HAC", maxlags=WEEK)
    names = ["intercept", "daily", "weekly", "monthly"]
    return {
        "params": dict(zip(names, map(float, res.params))),
        "rSquared": float(res.rsquared),
        "nobs": int(res.nobs),
        "hacTStatistics": dict(zip(names, map(float, hac.tvalues))),
    }
