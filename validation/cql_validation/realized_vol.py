"""Reference realized volatility matching backend/src/models/realizedVolatility.ts.

Conventions:
- Values are per period (not annualized) and aligned with the returns.
- Rolling close-to-close volatility is the sample standard deviation (n - 1)
  of the last `window` returns, demeaned within the window. Positions before a
  full window are None.
- EWMA variance is the normalised weighted average of squared returns,
  sum(lambda^i * r[t-i]^2) / sum(lambda^i), with zero mean (RiskMetrics).
  There is no seed value; early estimates use the returns available.
"""

import numpy as np
import pandas as pd


def rolling_volatility(returns: np.ndarray, window: int) -> list[float | None]:
    out: list[float | None] = [None] * len(returns)
    for t in range(window - 1, len(returns)):
        w = returns[t - window + 1 : t + 1]
        out[t] = float(np.sqrt(np.sum((w - w.mean()) ** 2) / (window - 1)))
    return out


def ewma_variance(returns: np.ndarray, decay: float) -> list[float]:
    out = []
    for t in range(len(returns)):
        weights = decay ** np.arange(t, -1, -1)
        out.append(float(np.sum(weights * returns[: t + 1] ** 2) / np.sum(weights)))
    return out


def pandas_rolling_volatility(returns: np.ndarray, window: int) -> list[float | None]:
    s = pd.Series(returns).rolling(window).std(ddof=1)
    return [None if np.isnan(v) else float(v) for v in s]


def pandas_ewma_variance(returns: np.ndarray, decay: float) -> list[float]:
    return [float(v) for v in pd.Series(returns**2).ewm(alpha=1 - decay, adjust=True).mean()]
