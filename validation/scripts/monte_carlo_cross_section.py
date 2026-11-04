"""Test 10-day Monte Carlo VaR out of sample on every stored coin and write data/monte_carlo_cross_section.csv.

    uv run scripts/monte_carlo_cross_section.py prices.csv

prices.csv has columns coin, date, price, exported from the price-history table. Only the per-coin counts are
committed; the prices themselves stay out of the repository.

For each coin, each model is fitted to the previous 180 daily log returns and simulated 10 days ahead, once with the
window's mean return as drift and once with zero drift. The VaR and ES of the simulated 10-day simple return are
compared with the return that followed. Forecast periods don't overlap, so a coin's exceptions are independent if the
model is right; different coins' are not, because coins move together.

Two files are written: per-coin counts, and per-period counts summed across coins to show when exceptions happened.
"""

import dataclasses
import multiprocessing
import sys
import zlib
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from cql_validation import monte_carlo as mc  # noqa: E402

START = "2025-11-01"
TRAIN = 180
HORIZON = 10
PATHS = 5000
MIN_DAILY_VOLATILITY = 1e-6
CONFIDENCE = {"95": 0.95, "99": 0.99}
MODELS = {"gbm": mc.gbm, "student_t": mc.student_t, "garch_bootstrap": mc.garch_bootstrap}


def without_drift(model):
    return dataclasses.replace(model, location=0.0) if isinstance(model, mc.StudentT) else dataclasses.replace(model, mu=0.0)


def measure(item: tuple[str, pd.DataFrame]) -> tuple[dict, list[dict]] | None:
    coin, rows = item
    rows = rows[rows.date >= START].sort_values("date")
    prices, dates = rows.price.to_numpy(), rows.date.to_numpy()
    r = np.diff(np.log(prices))
    if len(r) < TRAIN + HORIZON or r.std(ddof=1) < MIN_DAILY_VOLATILITY:
        return None

    rng = np.random.default_rng(zlib.crc32(coin.encode()))
    origins = range(TRAIN, len(r) - HORIZON + 1, HORIZON)
    result = {"coin": coin, "daily_volatility": r.std(ddof=1), "forecasts": len(origins)}
    # The forecast is made at the close of dates[t], the last price in its window
    periods = [{"date": dates[t], "coins": 1, "daily_volatility": r.std(ddof=1)} for t in origins]
    for name, fit in MODELS.items():
        hits = {f"{name}{drift}_{level}": [] for drift in ("", "_zero_drift") for level in CONFIDENCE}
        for i, t in enumerate(origins):
            fitted = fit(r[t - TRAIN : t])
            realized = np.exp(r[t : t + HORIZON].sum()) - 1
            for drift, model in (("", fitted), ("_zero_drift", without_drift(fitted))):
                simulated = np.exp(mc.simulate_horizon(model, PATHS, HORIZON, rng)) - 1
                for level, confidence in CONFIDENCE.items():
                    q = np.quantile(simulated, 1 - confidence)
                    hits[f"{name}{drift}_{level}"].append((-q, -simulated[simulated <= q].mean(), -realized))
                    periods[i][f"{name}{drift}_exceptions_{level}"] = int(-realized > -q)
        for key, forecasts in hits.items():
            value_at_risk, expected_shortfall, loss = map(np.array, zip(*forecasts))
            exceeded = loss > value_at_risk
            stem, level = key.rsplit("_", 1)
            result[f"{stem}_var_{level}"] = value_at_risk.mean()
            result[f"{stem}_exceptions_{level}"] = int(exceeded.sum())
            # Average realized loss relative to the predicted ES, over the periods that broke VaR
            result[f"{stem}_es_ratio_{level}"] = (loss[exceeded] / expected_shortfall[exceeded]).mean() if exceeded.any() else np.nan
    return result, periods


def main() -> None:
    prices = pd.read_csv(sys.argv[1])
    with multiprocessing.Pool() as pool:
        measured = [m for m in pool.map(measure, list(prices.groupby("coin"))) if m]

    table = pd.DataFrame([result for result, _ in measured]).sort_values("coin")
    path = ROOT / "data" / "monte_carlo_cross_section.csv"
    table.to_csv(path, index=False, float_format="%.6g")

    # Only coins in the volatility filter used for the headline results, so the columns add up to those counts
    periods = pd.DataFrame([p for _, ps in measured for p in ps])
    periods = periods[periods.daily_volatility >= 0.005].drop(columns="daily_volatility")
    by_date = periods.groupby("date").sum(numeric_only=True).reset_index()
    period_path = ROOT / "data" / "monte_carlo_periods.csv"
    by_date.to_csv(period_path, index=False)

    print(f"wrote {path.relative_to(ROOT.parent)}: {len(table)} coins, {table.forecasts.sum()} forecasts per model")
    print(f"wrote {period_path.relative_to(ROOT.parent)}: {len(by_date)} forecast dates")


if __name__ == "__main__":
    main()
