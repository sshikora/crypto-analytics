"""Write returns fixtures consumed by backend/src/models/returns.test.ts.

    uv run scripts/make_returns_fixtures.py
"""

import json
import sys
from dataclasses import asdict
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from cql_validation import returns  # noqa: E402

FIXTURE_DIR = ROOT.parent / "backend" / "src" / "test" / "fixtures" / "returns"


def check(name: str, reference: float, library: float) -> None:
    if not np.isclose(reference, library, rtol=1e-12, atol=0):
        raise SystemExit(f"{name}: reference {reference!r} disagrees with library {library!r}")


def main() -> None:
    FIXTURE_DIR.mkdir(parents=True, exist_ok=True)

    btc = pd.read_csv(ROOT / "data" / "bitcoin_usd_daily.csv")
    prices = btc["price_usd"].to_numpy()
    timestamps = btc["timestamp_ms"].to_numpy()

    log_r = returns.log_returns(prices)
    m = returns.moments(log_r)
    libraries = returns.library_moments(log_r)
    for lib, values in libraries.items():
        check(f"{lib} standard deviation", m.standard_deviation, values["standardDeviation"])
        check(f"{lib} skewness", m.skewness, values["skewness"])
        check(f"{lib} excess kurtosis", m.excess_kurtosis, values["excessKurtosis"])

    fixture = {
        "name": "btc_daily",
        "description": "Bitcoin daily USD closes from CoinGecko, 2025-10-23 to 2026-10-21",
        "generatedBy": "validation/scripts/make_returns_fixtures.py",
        "source": "CoinGecko market_chart, bitcoin, vs_currency=usd, interval=daily",
        "timestamps": [int(t) for t in timestamps],
        "prices": [float(p) for p in prices],
        "reference": {
            "logReturns": [float(r) for r in log_r],
            "simpleReturns": [float(r) for r in returns.simple_returns(prices)],
            "periodsPerYear": returns.periods_per_year(timestamps),
            "logReturnMoments": {
                "mean": m.mean,
                "standardDeviation": m.standard_deviation,
                "skewness": m.skewness,
                "excessKurtosis": m.excess_kurtosis,
            },
        },
        "libraries": libraries,
    }

    out = FIXTURE_DIR / "btc_daily.json"
    out.write_text(json.dumps(fixture, indent=2) + "\n")
    print(f"btc_daily: {len(log_r)} returns, {asdict(m)}")


if __name__ == "__main__":
    main()
