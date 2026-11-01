"""Measure the hidden Markov model on every stored coin and write data/hmm_cross_section.csv.

    uv run scripts/hmm_cross_section.py prices.csv

prices.csv has columns coin, date, price, exported from the price-history table. Only the per-coin results are
committed; the prices themselves stay out of the repository.

Two questions, for each coin with enough history:
  1. How many states does a year of returns support, by BIC?
  2. Using only data available at the time, does the model say anything about the next day? The walk-forward test
     refits weekly on the previous 180 returns and scores each following day.
"""

import multiprocessing
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT.parent / "batch"))

from cql_batch import hmm  # noqa: E402

START = "2025-11-01"
MIN_RETURNS = 200
TRAIN = 180
REFIT_EVERY = 7
EWMA_LAMBDA = 0.94
VOLATILITY_WINDOW = 30
MIN_DAILY_VOLATILITY = 1e-6


def log_normal(x: float, mean, variance):
    return -0.5 * (np.log(2 * np.pi * variance) + (x - mean) ** 2 / variance)


def state_counts(returns: np.ndarray) -> dict:
    n = len(returns)
    one_state = -0.5 * n * (np.log(2 * np.pi * returns.var()) + 1)
    two = hmm.fit_hmm(returns, k=2)
    three = hmm.fit_hmm(returns, k=3)
    bics = {1: 2 * np.log(n) - 2 * one_state, 2: two.bic(n), 3: three.bic(n)}
    return {
        "observations": n,
        "daily_volatility": returns.std(ddof=1),
        "best_bic_states": min(bics, key=bics.get),
        "converged": two.converged,
        "calm_daily_volatility": np.sqrt(two.variances[0]),
        "turbulent_daily_volatility": np.sqrt(two.variances[1]),
        "calm_stay": two.transition[0, 0],
        "turbulent_stay": two.transition[1, 1],
    }


def walk_forward(returns: np.ndarray) -> dict:
    rows = []
    fit = None
    for t in range(TRAIN, len(returns)):
        history = returns[t - TRAIN : t]
        if (t - TRAIN) % REFIT_EVERY == 0:
            fit = hmm.fit_hmm(history, starts=5)

        _, filtered, _, _ = hmm.forward_backward(hmm.log_densities(history, fit.means, fit.variances), fit.initial, fit.transition)
        predicted = filtered[-1] @ fit.transition
        hmm_score = np.logaddexp.reduce(log_normal(returns[t], fit.means, fit.variances) + np.log(predicted + 1e-300))
        hmm_variance = (predicted * (fit.variances + fit.means**2)).sum() - (predicted * fit.means).sum() ** 2

        weights = EWMA_LAMBDA ** np.arange(TRAIN - 1, -1, -1)
        ewma_variance = (weights * history**2).sum() / weights.sum()
        volatilities = pd.Series(history).rolling(VOLATILITY_WINDOW).std().dropna().to_numpy()

        rows.append(
            {
                "turbulent": filtered[-1, 1] > 0.5,
                "percentile": (volatilities <= volatilities[-1]).mean(),
                "move": abs(returns[t]),
                "hmm_score": hmm_score,
                "normal_score": log_normal(returns[t], history.mean(), history.var(ddof=1)),
                "ewma_score": log_normal(returns[t], 0.0, ewma_variance),
                "hmm_volatility": np.sqrt(hmm_variance),
            }
        )

    days = pd.DataFrame(rows)
    high, low = days[days.percentile > 2 / 3], days[days.percentile < 1 / 3]
    return {
        "test_days": len(days),
        "turbulent_days": int(days.turbulent.sum()),
        "move_after_calm": days.loc[~days.turbulent, "move"].mean(),
        "move_after_turbulent": days.loc[days.turbulent, "move"].mean(),
        "move_after_low_percentile": low.move.mean(),
        "move_after_high_percentile": high.move.mean(),
        "hmm_score": days.hmm_score.mean(),
        "normal_score": days.normal_score.mean(),
        "ewma_score": days.ewma_score.mean(),
        "hmm_move_correlation": days.hmm_volatility.corr(days.move),
        "percentile_move_correlation": days.percentile.corr(days.move),
    }


def measure(item: tuple[str, pd.DataFrame]) -> dict | None:
    coin, rows = item
    prices = rows[rows.date >= START].sort_values("date").price.to_numpy()
    returns = np.diff(np.log(prices))
    if len(returns) < MIN_RETURNS or returns.std(ddof=1) < MIN_DAILY_VOLATILITY:
        return None
    result = {"coin": coin, **state_counts(returns)}
    if len(returns) >= TRAIN + 100:
        result.update(walk_forward(returns))
    return result


def main() -> None:
    prices = pd.read_csv(sys.argv[1])
    with multiprocessing.Pool() as pool:
        results = [r for r in pool.map(measure, list(prices.groupby("coin"))) if r]

    table = pd.DataFrame(results).sort_values("coin")
    path = ROOT / "data" / "hmm_cross_section.csv"
    table.to_csv(path, index=False, float_format="%.6g")
    print(f"wrote {path.relative_to(ROOT.parent)}: {len(table)} coins, {table.test_days.notna().sum()} with a walk-forward test")


if __name__ == "__main__":
    main()
