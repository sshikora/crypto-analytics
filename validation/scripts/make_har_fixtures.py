"""Write HAR-RV fixtures consumed by backend/src/models/har.test.ts.

    uv run scripts/make_har_fixtures.py
"""

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from cql_validation import har, returns  # noqa: E402

FIXTURE_DIR = ROOT.parent / "backend" / "src" / "test" / "fixtures" / "har"
FORECAST_STEPS = 30


def main() -> None:
    FIXTURE_DIR.mkdir(parents=True, exist_ok=True)

    btc = pd.read_csv(ROOT / "data" / "bitcoin_usd_daily.csv")
    prices = btc["price_usd"].to_numpy()
    rv = returns.log_returns(prices) ** 2

    f = har.fit(rv)
    library = har.statsmodels_cross_check(rv)
    for name, value in zip(["intercept", "daily", "weekly", "monthly"], f.params):
        if not np.isclose(value, library["params"][name], rtol=1e-10, atol=0):
            raise SystemExit(f"{name}: reference {value!r} disagrees with statsmodels {library['params'][name]!r}")
    if not np.isclose(f.r_squared, library["rSquared"], rtol=1e-10, atol=0):
        raise SystemExit(f"R squared: reference {f.r_squared!r} disagrees with statsmodels {library['rSquared']!r}")

    fixture = {
        "name": "btc_daily",
        "description": "Bitcoin daily USD closes from CoinGecko, 2025-10-23 to 2026-10-21",
        "generatedBy": "validation/scripts/make_har_fixtures.py",
        "source": "CoinGecko market_chart, bitcoin, vs_currency=usd, interval=daily",
        "prices": [float(p) for p in prices],
        "reference": {
            "params": {
                "intercept": float(f.params[0]),
                "daily": float(f.params[1]),
                "weekly": float(f.params[2]),
                "monthly": float(f.params[3]),
            },
            "rSquared": f.r_squared,
            "nobs": f.nobs,
            "forecastVariance": [float(v) for v in har.forecast(f, rv, FORECAST_STEPS)],
        },
        "statsmodels": library,
    }

    out = FIXTURE_DIR / "btc_daily.json"
    out.write_text(json.dumps(fixture, indent=2) + "\n")
    print(f"btc_daily: params={f.params} R2={f.r_squared:.6f} nobs={f.nobs}")
    print(f"  HAC t: {library['hacTStatistics']}")


if __name__ == "__main__":
    main()
