"""Backtest moving-average crossovers on every coin and write data/crossover_backtest_*.csv.

    uv run scripts/crossover_backtest.py prices.csv

prices.csv has columns coin, date, price, exported from the price-history table. Only per-coin statistics are
committed; the prices themselves stay out of the repository.

Each coin with a full year of history and daily volatility of at least 0.5% (which leaves out stablecoins) is tested
three ways, all over the same days once the slowest average exists:
- In sample: the best of 15 crossovers by Sharpe ratio, with its probabilistic Sharpe ratio against zero and its
  deflated Sharpe ratio for 15 trials.
- Walk-forward: retrain on the previous 120 days every 30 days and hold the winner for the next 30, compared with
  holding the coin over the same test days.
- Against shuffled prices: the same search on prices rebuilt from the coin's own daily returns in random order.
  Demeaned, there is nothing to earn, and how often the best variant looks significant is each test's
  false-positive rate. Keeping the mean, the coin's trend is still there but there is nothing to time; the share of
  shuffles whose best Sharpe ratio is at least the real one is a p-value for timing skill (a permutation test, as in
  White's reality check).
"""

import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from cql_validation import backtest as bt  # noqa: E402

SHORTS = [1, 5, 10, 20]
LONGS = [20, 30, 50, 100]
GRID = [(s, l) for s in SHORTS for l in LONGS if s < l]
START = max(LONGS) - 1
TRAIN = 120
TEST = 30
COSTS = [0.0, 0.0015, 0.003]
MAIN_COST = 0.0015
SHUFFLES = 20
TIMING_SHUFFLES = 200
MIN_DAILY_VOLATILITY = 0.005
DAYS_PER_YEAR = 365.25
OUT = ROOT / "data"


def search(prices: np.ndarray, cost: float) -> dict:
    variants = [bt.crossover_positions(prices, s, l) for s, l in GRID]
    evaluated = [bt.strategy_returns(prices, p, cost)[START:] for p in variants]
    sharpes = np.array([bt.sharpe(r) for r in evaluated])
    best = int(np.argmax(sharpes))
    implied = bt.implied_trials(np.array([r for r in evaluated if r.std() > 0]))
    return {
        "variants": variants,
        "best": best,
        "sharpe": sharpes[best],
        "psr": bt.probabilistic_sharpe(evaluated[best], 0.0),
        "dsr": bt.deflated_sharpe(evaluated[best], sharpes),
        "implied_trials": implied,
        "dsr_implied": bt.deflated_sharpe(evaluated[best], sharpes, implied),
    }


def shuffled_prices(prices: np.ndarray, rng: np.random.Generator, demean: bool) -> np.ndarray:
    r = np.log(prices[1:] / prices[:-1])
    r = rng.permutation(r - r.mean() if demean else r)
    return prices[0] * np.exp(np.concatenate([[0.0], np.cumsum(r)]))


def main() -> None:
    frame = pd.read_csv(sys.argv[1]).pivot(index="date", columns="coin", values="price")
    full = frame.dropna(axis=1)
    daily_vol = np.log(full).diff().std()
    coins = sorted(daily_vol[daily_vol >= MIN_DAILY_VOLATILITY].index)
    print(f"{len(coins)} coins with {len(full)} days, {full.index[0]} to {full.index[-1]}")

    rng = np.random.default_rng(2026)
    rows = []
    null_rows = []
    annual = np.sqrt(DAYS_PER_YEAR)
    for coin in coins:
        prices = full[coin].to_numpy()
        row = {"coin": coin}
        for cost in COSTS:
            found = search(prices, cost)
            wf = bt.walk_forward(prices, found["variants"], START, TRAIN, TEST, cost)
            held = bt.strategy_returns(prices[START + TRAIN :], np.ones(len(prices) - START - TRAIN), cost)
            tag = f"{cost * 1e4:.0f}bp"
            row |= {
                f"best_{tag}": "{}/{}".format(*GRID[found["best"]]),
                f"in_sample_sharpe_{tag}": found["sharpe"] * annual,
                f"psr_{tag}": found["psr"],
                f"dsr_{tag}": found["dsr"],
                f"dsr_implied_{tag}": found["dsr_implied"],
                f"walk_forward_sharpe_{tag}": bt.sharpe(wf.returns) * annual,
                f"walk_forward_return_{tag}": float(np.prod(1 + wf.returns) - 1),
                f"walk_forward_exposure_{tag}": float(wf.positions.mean()),
                f"walk_forward_switches_{tag}": int(np.sum(np.diff(wf.chosen) != 0)),
            }
            if cost == MAIN_COST:
                row["implied_trials"] = found["implied_trials"]
                in_sample = bt.strategy_returns(prices, np.ones(len(prices)), cost)[START:]
                row["hold_in_sample_sharpe"] = bt.sharpe(in_sample) * annual
                row["hold_sharpe"] = bt.sharpe(held) * annual
                row["hold_return"] = float(np.prod(1 + held) - 1)
                timing = [search(shuffled_prices(prices, rng, False), cost)["sharpe"] for _ in range(TIMING_SHUFFLES)]
                row["timing_p_value"] = (1 + sum(t >= found["sharpe"] for t in timing)) / (1 + TIMING_SHUFFLES)
        rows.append(row)

        for k in range(SHUFFLES):
            found = search(shuffled_prices(prices, rng, True), MAIN_COST)
            null_rows.append({"coin": coin, "shuffle": k, "psr": found["psr"], "dsr": found["dsr"],
                              "dsr_implied": found["dsr_implied"], "implied_trials": found["implied_trials"]})

    results = pd.DataFrame(rows)
    null = pd.DataFrame(null_rows)
    results.to_csv(OUT / "crossover_backtest_coins.csv", index=False, float_format="%.6g")
    null.to_csv(OUT / "crossover_backtest_null.csv", index=False, float_format="%.6g")

    for cost in COSTS:
        tag = f"{cost * 1e4:.0f}bp"
        print(
            f"{tag:>5}: PSR>0.95 {np.mean(results[f'psr_{tag}'] > 0.95):.1%}, "
            f"DSR>0.95 {np.mean(results[f'dsr_{tag}'] > 0.95):.1%}, "
            f"implied {np.mean(results[f'dsr_implied_{tag}'] > 0.95):.1%}, "
            f"median in-sample Sharpe {results[f'in_sample_sharpe_{tag}'].median():.2f}, "
            f"median walk-forward Sharpe {results[f'walk_forward_sharpe_{tag}'].median():.2f}, "
            f"beats holding {np.mean(results[f'walk_forward_sharpe_{tag}'] > results['hold_sharpe']):.1%}"
        )
    print(f"median holding Sharpe {results['hold_sharpe'].median():.2f} out of sample, "
          f"{results['hold_in_sample_sharpe'].median():.2f} in sample; "
          f"median implied trials {results['implied_trials'].median():.1f}; "
          f"timing p < 0.05 for {np.mean(results['timing_p_value'] < 0.05):.1%}")
    print(f"null ({len(null)} searches): PSR>0.95 {np.mean(null['psr'] > 0.95):.1%}, "
          f"DSR>0.95 {np.mean(null['dsr'] > 0.95):.1%}, implied {np.mean(null['dsr_implied'] > 0.95):.1%}, "
          f"median implied trials {null['implied_trials'].median():.1f}")


if __name__ == "__main__":
    main()
