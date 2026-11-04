"""Compare long-only portfolios of the top 20 coins out of sample and write data/portfolio_backtest_*.csv.

    uv run scripts/portfolio_backtest.py prices_caps.csv

prices_caps.csv has columns coin, date, price, market_cap, exported from the price-history table. Only portfolio-level
results are committed; the prices themselves stay out of the repository.

Every 30 days, the 20 largest coins by market cap with daily volatility of at least 0.5% over the estimation window
are chosen, each strategy sets weights from that window's returns, and the portfolio is held without trading until
the next rebalance. Two window lengths and three starting offsets check that one schedule doesn't decide the result;
all of them cover the same test days. Minimum variance holds mostly TRON, the least volatile large coin, so every run
is repeated without it to see whether the result depends on that one coin.
"""

import sys
from itertools import product
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from cql_validation import portfolio as pf  # noqa: E402

TOP = 20
REBALANCE = 30
WINDOWS = [90, 180]
OFFSETS = [0, 10, 20]
UNIVERSES = {"top_20": [], "top_20_without_tron": ["tron"]}
MIN_DAILY_VOLATILITY = 0.005
FRONTIER_POINTS = 25
DAYS_PER_YEAR = 365.25


def max_sharpe(cov: np.ndarray, mean: np.ndarray) -> np.ndarray:
    """The frontier point with the highest mean over volatility, with a zero risk-free rate."""
    frontier = pf.efficient_frontier(cov, mean, FRONTIER_POINTS)
    return max(frontier, key=lambda w: (w @ mean) / np.sqrt(w @ cov @ w))


def weights(strategy: str, r: np.ndarray, caps: np.ndarray, covariances: dict) -> tuple[np.ndarray, np.ndarray]:
    """Weights, and the covariance the strategy's own risk forecast uses. Strategies that don't optimize, and those
    that don't compare estimators, use constant-correlation shrinkage."""
    shrunk = covariances["constant_correlation"]
    if strategy == "cap_weight":
        return caps / caps.sum(), shrunk
    if strategy == "equal_weight":
        return np.full(len(caps), 1 / len(caps)), shrunk
    if strategy == "inverse_volatility":
        inverse = 1 / r.std(axis=0, ddof=1)
        return inverse / inverse.sum(), shrunk
    if strategy.startswith("min_variance_"):
        cov = covariances[strategy.removeprefix("min_variance_")]
        return pf.minimum_variance(cov), cov
    if strategy == "risk_parity":
        return pf.risk_parity(shrunk), shrunk
    return max_sharpe(shrunk, r.mean(axis=0)), shrunk


STRATEGIES = [
    "cap_weight",
    "equal_weight",
    "inverse_volatility",
    "min_variance_sample",
    "min_variance_identity",
    "min_variance_constant_correlation",
    "risk_parity",
    "max_sharpe",
]


def backtest(prices: pd.DataFrame, caps: pd.DataFrame, universe: str, window: int, offset: int) -> tuple[list[dict], dict[str, list]]:
    returns = prices.drop(columns=UNIVERSES[universe]).pct_change().iloc[1:]
    dates = returns.index
    start = max(WINDOWS) + offset
    rebalances = list(range(start, len(dates), REBALANCE))

    periods = []
    daily = {s: [] for s in STRATEGIES}
    held = {s: None for s in STRATEGIES}
    for k, t in enumerate(rebalances):
        end = rebalances[k + 1] if k + 1 < len(rebalances) else len(dates)
        history = returns.iloc[t - window : t]
        cap_today = caps.loc[dates[t - 1]]
        eligible = [
            c for c in history.columns
            if history[c].notna().all() and returns[c].iloc[t:end].notna().all() and not np.isnan(cap_today[c])
            and history[c].std(ddof=1) >= MIN_DAILY_VOLATILITY
        ]
        chosen = sorted(eligible, key=lambda c: -cap_today[c])[:TOP]
        r = history[chosen].to_numpy()
        identity, identity_shrinkage = pf.ledoit_wolf(r)
        correlated, correlated_shrinkage = pf.constant_correlation(r)
        covariances = {"sample": pf.sample_covariance(r), "identity": identity, "constant_correlation": correlated}
        relatives = (1 + returns[chosen].iloc[t:end]).cumprod().to_numpy()

        for strategy in STRATEGIES:
            w, forecast_cov = weights(strategy, r, cap_today[chosen].to_numpy(), covariances)
            values = relatives @ w
            path = np.diff(np.r_[1.0, values]) / np.r_[1.0, values[:-1]]
            daily[strategy].extend(path)

            previous = held[strategy]
            turnover = np.nan
            if previous is not None:
                drifted = pd.Series(previous).reindex(chosen).fillna(0).to_numpy()
                turnover = 0.5 * (np.abs(w - drifted).sum() + (1 - drifted.sum()))
            held[strategy] = dict(zip(chosen, relatives[-1] * w / values[-1]))

            periods.append({
                "universe": universe,
                "window": window,
                "offset": offset,
                "start": dates[t].date().isoformat(),
                "days": end - t,
                "strategy": strategy,
                "identity_shrinkage": identity_shrinkage,
                "constant_correlation_shrinkage": correlated_shrinkage,
                "period_return": values[-1] - 1,
                "realized_daily_volatility": path.std(ddof=1),
                "forecast_daily_volatility": np.sqrt(w @ forecast_cov @ w),
                "turnover": turnover,
                "effective_holdings": 1 / (w**2).sum(),
                "largest_weight": w.max(),
            })
    return periods, daily


def summarize(universe: str, window: int, offset: int, strategy: str, path: list, periods: pd.DataFrame) -> dict:
    x = np.array(path)
    values = np.cumprod(1 + x)
    drawdown = 1 - values / np.maximum.accumulate(np.r_[1.0, values])[1:]
    mine = periods[
        (periods.universe == universe) & (periods.window == window) & (periods.offset == offset) & (periods.strategy == strategy)
    ]
    return {
        "universe": universe,
        "window": window,
        "offset": offset,
        "strategy": strategy,
        "days": len(x),
        "annualized_volatility": x.std(ddof=1) * np.sqrt(DAYS_PER_YEAR),
        "total_return": values[-1] - 1,
        "sharpe": x.mean() / x.std(ddof=1) * np.sqrt(DAYS_PER_YEAR),
        "max_drawdown": drawdown.max(),
        "mean_turnover": mine.turnover.mean(),
        "mean_effective_holdings": mine.effective_holdings.mean(),
        "realized_over_forecast_volatility": (mine.realized_daily_volatility / mine.forecast_daily_volatility).mean(),
    }


def main() -> None:
    raw = pd.read_csv(sys.argv[1], parse_dates=["date"])
    prices = raw.pivot(index="date", columns="coin", values="price").sort_index()
    caps = raw.pivot(index="date", columns="coin", values="market_cap").sort_index()

    periods, summaries = [], []
    for universe, window, offset in product(UNIVERSES, WINDOWS, OFFSETS):
        rows, daily = backtest(prices, caps, universe, window, offset)
        periods.extend(rows)
        frame = pd.DataFrame(periods)
        summaries.extend(summarize(universe, window, offset, s, daily[s], frame) for s in STRATEGIES)

    period_path = ROOT / "data" / "portfolio_backtest_periods.csv"
    summary_path = ROOT / "data" / "portfolio_backtest_summary.csv"
    pd.DataFrame(periods).to_csv(period_path, index=False, float_format="%.6g")
    summary = pd.DataFrame(summaries)
    summary.to_csv(summary_path, index=False, float_format="%.6g")

    print(summary.groupby(["universe", "strategy"])[["annualized_volatility", "total_return", "max_drawdown", "mean_turnover",
                                       "mean_effective_holdings", "realized_over_forecast_volatility"]].mean().round(3))
    print(f"wrote {period_path.relative_to(ROOT.parent)} and {summary_path.relative_to(ROOT.parent)}")


if __name__ == "__main__":
    main()
