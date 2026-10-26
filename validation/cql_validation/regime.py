"""Reference threshold regime matching backend/src/models/regime.ts.

- Trend: the latest close against its 200-day simple moving average.
- Volatility level: the latest 30-day close-to-close volatility (log returns,
  sample standard deviation) ranked among every 30-day window in the history,
  as the fraction of windows at or below it. Below 1/3 is low, above 2/3 high.
"""

import numpy as np
import pandas as pd

from . import realized_vol, returns

TREND_DAYS = 200
VOLATILITY_WINDOW = 30


def regime(prices: np.ndarray) -> dict:
    sma = float(prices[-TREND_DAYS:].mean())
    vols = np.array([v for v in realized_vol.rolling_volatility(returns.log_returns(prices), VOLATILITY_WINDOW) if v is not None])
    percentile = float(np.mean(vols <= vols[-1]))
    return {
        "movingAverage": sma,
        "priceToMovingAverage": float(prices[-1] / sma),
        "volatilityPercentile": percentile,
        "volatilityLevel": "low" if percentile < 1 / 3 else "high" if percentile > 2 / 3 else "normal",
        "trend": "up" if prices[-1] > sma else "down",
    }


def pandas_regime(prices: np.ndarray) -> dict:
    s = pd.Series(prices)
    vols = np.log(s).diff().rolling(VOLATILITY_WINDOW).std().dropna()
    return {
        "movingAverage": float(s.rolling(TREND_DAYS).mean().iloc[-1]),
        "volatilityPercentile": float(vols.rank(pct=True, method="max").iloc[-1]),
    }
