"""Reference return, drawdown and beta metrics matching backend/src/models/performance.ts.

Conventions:
- Daily simple returns; the risk-free rate is taken as 0.
- Annualized return is geometric: (last / first) ** (periods per year / returns) - 1.
- Sharpe = mean / sample standard deviation * sqrt(periods per year).
- Sortino = mean / downside deviation * sqrt(periods per year), where downside
  deviation = sqrt(mean(min(r, 0)^2)) over every return (target 0).
- Drawdown is price / running peak - 1. The longest drawdown is the most
  consecutive days the price spent below a previous high.
- Calmar = annualized return / |maximum drawdown|.
- Beta is the OLS slope of the coin's returns on Bitcoin's, on matching dates.
"""

import numpy as np
import pandas as pd
from scipy import stats


def annualized_return(prices: np.ndarray, periods_per_year: float) -> float:
    return float((prices[-1] / prices[0]) ** (periods_per_year / (len(prices) - 1)) - 1)


def sharpe(r: np.ndarray, periods_per_year: float) -> float:
    return float(r.mean() / r.std(ddof=1) * np.sqrt(periods_per_year))


def sortino(r: np.ndarray, periods_per_year: float) -> float:
    downside = np.sqrt(np.mean(np.minimum(r, 0) ** 2))
    return float(r.mean() / downside * np.sqrt(periods_per_year))


def drawdowns(prices: np.ndarray, dates: list[str]) -> dict:
    peak = np.maximum.accumulate(prices)
    dd = prices / peak - 1
    trough = int(np.argmin(dd))
    peak_index = int(np.argmax(prices[: trough + 1]))
    recovered = [i for i in range(trough, len(prices)) if prices[i] >= prices[peak_index]]

    longest = streak = 0
    for below in dd < 0:
        streak = streak + 1 if below else 0
        longest = max(longest, streak)

    return {
        "maxDrawdown": float(dd[trough]),
        "peakDate": dates[peak_index],
        "troughDate": dates[trough],
        "recoveryDate": dates[recovered[0]] if recovered else None,
        "currentDrawdown": float(dd[-1]),
        "longestDrawdownDays": longest,
    }


def pandas_drawdown(prices: np.ndarray) -> float:
    s = pd.Series(prices)
    return float((s / s.cummax() - 1).min())


def beta(coin: np.ndarray, btc: np.ndarray) -> dict:
    result = stats.linregress(btc, coin)
    return {"beta": float(result.slope), "correlation": float(result.rvalue)}


def worst_days(r: np.ndarray, dates: list[str], count: int = 5) -> list[dict]:
    order = np.argsort(r, kind="stable")[:count]
    return [{"date": dates[i], "return": float(r[i])} for i in order]


def worst_week(prices: np.ndarray, dates: list[str]) -> dict:
    weekly = prices[7:] / prices[:-7] - 1
    i = int(np.argmin(weekly))
    return {"startDate": dates[i], "endDate": dates[i + 7], "return": float(weekly[i])}
