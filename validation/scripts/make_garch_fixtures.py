"""Write GARCH fixtures consumed by backend/src/services/garchService.test.ts.

    uv run scripts/make_garch_fixtures.py
"""

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from cql_validation import garch  # noqa: E402

FIXTURE_DIR = ROOT.parent / "backend" / "src" / "test" / "fixtures" / "garch"
FORECAST_DAYS = [1, 7, 14, 30]


def simulated_series(n: int, omega: float, alpha: float, beta: float, seed: int) -> tuple[np.ndarray, np.ndarray]:
    rng = np.random.default_rng(seed)
    h = omega / (1 - alpha - beta)
    returns = np.empty(n)
    prev = 0.0
    for t in range(n):
        h = omega + alpha * prev**2 + beta * h
        prev = np.sqrt(h) * rng.standard_normal()
        returns[t] = prev
    prices = 100.0 * np.exp(np.concatenate([[0.0], np.cumsum(returns)]))
    start = pd.Timestamp("2020-01-01", tz="UTC").value // 1_000_000
    timestamps = start + 86_400_000 * np.arange(n + 1)
    return prices, timestamps


def build(name: str, description: str, prices: np.ndarray, timestamps: np.ndarray, extra: dict) -> None:
    f = garch.fit(prices)
    ppy = garch.periods_per_year(timestamps)
    ann = np.sqrt(ppy) * 100

    forecasts = []
    for days in FORECAST_DAYS:
        steps = max(1, round(days / 365.25 * ppy))
        forecasts.append({
            "horizon": days,
            "steps": steps,
            "annualizedVolatility": float(np.sqrt(garch.forecast_variance(f, steps)) * ann),
        })

    persistence = f.alpha + f.beta
    fixture = {
        "name": name,
        "description": description,
        "generatedBy": "validation/scripts/make_garch_fixtures.py",
        "timestamps": [int(t) for t in timestamps],
        "prices": [float(p) for p in prices],
        "reference": {
            "omega": f.omega,
            "alpha": f.alpha,
            "beta": f.beta,
            "persistence": persistence,
            "logLikelihood": f.log_likelihood,
            "currentVolatility": float(np.sqrt(f.variance[-1]) * ann),
            "longRunVolatility": float(np.sqrt(f.omega / (1 - persistence)) * ann),
            "conditionalVolatility": [float(v) for v in np.sqrt(f.variance) * ann],
            "forecast": forecasts,
        },
        "arch": garch.arch_cross_check(prices, max(fc["steps"] for fc in forecasts)),
        **extra,
    }

    out = FIXTURE_DIR / f"{name}.json"
    out.write_text(json.dumps(fixture, indent=2) + "\n")
    print(f"{name}: omega={f.omega:.6e} alpha={f.alpha:.5f} beta={f.beta:.5f} LL={f.log_likelihood:.6f}")
    print(f"  arch:  omega={fixture['arch']['omega']:.6e} alpha={fixture['arch']['alpha']:.5f} beta={fixture['arch']['beta']:.5f}")


def main() -> None:
    FIXTURE_DIR.mkdir(parents=True, exist_ok=True)

    btc = pd.read_csv(ROOT / "data" / "bitcoin_usd_daily.csv")
    build(
        "btc_daily",
        "Bitcoin daily USD closes from CoinGecko, 2025-10-23 to 2026-10-21",
        btc["price_usd"].to_numpy(),
        btc["timestamp_ms"].to_numpy(),
        {"source": "CoinGecko market_chart, bitcoin, vs_currency=usd, interval=daily"},
    )

    truth = {"omega": 4.5e-5, "alpha": 0.10, "beta": 0.85}
    prices, timestamps = simulated_series(2000, **truth, seed=20261022)
    build(
        "simulated_2000",
        "2,000 daily steps simulated from GARCH(1,1) with known parameters",
        prices,
        timestamps,
        {"trueParameters": truth, "seed": 20261022},
    )


if __name__ == "__main__":
    main()
