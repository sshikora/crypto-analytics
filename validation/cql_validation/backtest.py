"""Reference signal backtests, Sharpe ratio inference and walk-forward selection matching
backend/src/models/signals.ts, backtest.ts and sharpeInference.ts.

Conventions:
- positions[t] is the fraction of capital held from close t to close t + 1, decided from closes up to t.
- Trades happen at the close. The cost is a fraction of the value traded (fee plus slippage) and is charged in the
  period the new position is first held:
      net[t] = positions[t] * R[t + 1] - cost * |positions[t] - positions[t - 1]|,  positions[-1] = 0,
  where R[t + 1] is the simple return from close t to close t + 1.
- A moving-average crossover is long (1) while the short simple moving average is above the long one and flat (0)
  otherwise, including before the long average exists. A short period of 1 compares the price with its average.
- Sharpe ratios used for inference are per period, not annualized: mean / sample standard deviation (n - 1). A
  series with no variation, such as a strategy that stayed flat, has a Sharpe ratio of 0.
- Skewness and kurtosis in the probabilistic Sharpe ratio are population moments, and kurtosis is not excess
  (3 for a normal distribution), as in Bailey and López de Prado.
- Probabilistic Sharpe ratio (Bailey and López de Prado 2012): the probability that the true Sharpe ratio exceeds
  a benchmark SR*,
      PSR(SR*) = Phi((SR - SR*) sqrt(T - 1) / sqrt(1 - skew SR + (kurt - 1) / 4 SR^2)).
- Deflated Sharpe ratio (Bailey and López de Prado 2014): PSR against the Sharpe ratio expected from the best of N
  trials with no skill,
      SR0 = sqrt(V) ((1 - gamma) Phi^-1(1 - 1/N) + gamma Phi^-1(1 - 1/(N e))),
  where V is the sample variance (n - 1) of the trials' Sharpe ratios and gamma is Euler's constant. With one
  trial there is no selection and SR0 = 0. The approximation is asymptotic and turns negative for N just above 1,
  where the true expected maximum is still at least 0, so it is floored at 0.
- N counts independent trials. Correlated trials (Appendix A.3 of the 2014 paper) count as
      N = rho + (1 - rho) M
  for M trials whose returns have average pairwise correlation rho.
- Walk-forward: fold k trains on net returns [start + k test, start + k test + train) and tests on the `test`
  returns after them (the last fold may be shorter). The variant with the highest training Sharpe ratio, the first
  on ties, is held through the test days. Test positions are spliced together and costed as one strategy that
  starts flat, so switching variants between folds pays for the trade.
"""

from dataclasses import dataclass

import numpy as np
from scipy import stats


def moving_average(prices: np.ndarray, period: int) -> np.ndarray:
    out = np.full(len(prices), np.nan)
    for i in range(period - 1, len(prices)):
        out[i] = prices[i - period + 1 : i + 1].sum() / period
    return out


def crossover_positions(prices: np.ndarray, short: int, long: int) -> np.ndarray:
    fast = moving_average(prices, short)
    slow = moving_average(prices, long)
    above = np.zeros(len(prices))
    ready = ~np.isnan(slow)
    above[ready] = (fast[ready] > slow[ready]).astype(float)
    return above


def strategy_returns(prices: np.ndarray, positions: np.ndarray, cost: float) -> np.ndarray:
    r = prices[1:] / prices[:-1] - 1
    held = positions[:-1]
    traded = np.abs(np.diff(held, prepend=0.0))
    return held * r - cost * traded


def sharpe(r: np.ndarray) -> float:
    sd = r.std(ddof=1)
    return 0.0 if sd == 0 else float(r.mean() / sd)


def probabilistic_sharpe(r: np.ndarray, benchmark: float) -> float:
    sr = sharpe(r)
    skew = stats.skew(r, bias=True)
    kurt = stats.kurtosis(r, fisher=False, bias=True)
    z = (sr - benchmark) * np.sqrt(len(r) - 1) / np.sqrt(1 - skew * sr + (kurt - 1) / 4 * sr**2)
    return float(stats.norm.cdf(z))


def expected_maximum_sharpe(trials: float, variance: float) -> float:
    if trials <= 1:
        return 0.0
    g = np.euler_gamma
    approximation = np.sqrt(variance) * (
        (1 - g) * stats.norm.ppf(1 - 1 / trials) + g * stats.norm.ppf(1 - 1 / (trials * np.e))
    )
    return float(max(0.0, approximation))


def implied_trials(trial_returns: np.ndarray) -> float:
    corr = np.corrcoef(trial_returns)
    m = len(corr)
    rho = (corr.sum() - m) / (m * (m - 1))
    return float(rho + (1 - rho) * m)


def deflated_sharpe(r: np.ndarray, trial_sharpes: np.ndarray, trials: float | None = None) -> float:
    variance = float(np.var(trial_sharpes, ddof=1)) if len(trial_sharpes) > 1 else 0.0
    n = len(trial_sharpes) if trials is None else trials
    return probabilistic_sharpe(r, expected_maximum_sharpe(n, variance))


@dataclass
class WalkForward:
    chosen: list[int]
    positions: np.ndarray
    returns: np.ndarray


def walk_forward(
    prices: np.ndarray, variants: list[np.ndarray], start: int, train: int, test: int, cost: float
) -> WalkForward:
    net = [strategy_returns(prices, p, cost) for p in variants]
    end = len(prices) - 1
    chosen = []
    spliced = []
    a = start
    while a + train < end:
        scores = [sharpe(n[a : a + train]) for n in net]
        best = int(np.argmax(scores))
        chosen.append(best)
        spliced.append(variants[best][a + train : min(a + train + test, end)])
        a += test
    positions = np.concatenate(spliced)
    first = start + train
    window = prices[first : first + len(positions) + 1]
    return WalkForward(chosen, positions, strategy_returns(window, np.append(positions, 0.0), cost))
