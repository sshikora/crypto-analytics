"""Write GARCH diagnostics fixtures consumed by backend/src/models/garchDiagnostics.test.ts.

    uv run scripts/make_garch_diagnostics_fixtures.py
"""

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from scipy import stats

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from cql_validation import garch, garch_diagnostics, returns  # noqa: E402

FIXTURE_DIR = ROOT.parent / "backend" / "src" / "test" / "fixtures" / "garch"
FORECAST_DAYS = [1, 7, 30]


def main() -> None:
    btc = pd.read_csv(ROOT / "data" / "bitcoin_usd_daily.csv")
    prices = btc["price_usd"].to_numpy()
    timestamps = btc["timestamp_ms"].to_numpy()

    f = garch.fit(prices)
    z = garch_diagnostics.standardized_residuals(prices, f)
    ann = np.sqrt(returns.periods_per_year(timestamps)) * 100
    persistence = f.alpha + f.beta

    fixture = {
        "name": "btc_daily",
        "description": "Bitcoin daily USD closes from CoinGecko, 2025-10-23 to 2026-10-21",
        "generatedBy": "validation/scripts/make_garch_diagnostics_fixtures.py",
        "source": "CoinGecko market_chart, bitcoin, vs_currency=usd, interval=daily",
        "prices": [float(p) for p in prices],
        "timestamps": [int(t) for t in timestamps],
        "reference": {
            "logLikelihood": f.log_likelihood,
            "observations": len(z),
            **garch_diagnostics.information_criteria(f, len(z)),
            "standardizedResiduals": [float(v) for v in z],
            "ljungBoxResiduals": garch_diagnostics.ljung_box(z),
            "ljungBoxSquaredResiduals": garch_diagnostics.ljung_box(z**2),
            "normalQq": garch_diagnostics.normal_qq(z),
            "standardizedExcessKurtosis": float(stats.kurtosis(z, fisher=True, bias=False)),
            "halfLifeDays": float(np.log(0.5) / np.log(persistence)),
            # Average daily variance over each horizon, annualized, as for the HAR-RV forecasts
            "forecast": [
                {
                    "days": days,
                    "annualizedVolatility": float(
                        np.sqrt(np.mean([garch.forecast_variance(f, k) for k in range(1, days + 1)])) * ann
                    ),
                }
                for days in FORECAST_DAYS
            ],
        },
    }

    out = FIXTURE_DIR / "btc_daily_diagnostics.json"
    out.write_text(json.dumps(fixture, indent=2) + "\n")
    ref = fixture["reference"]
    print(f"n={ref['observations']} LL={ref['logLikelihood']:.4f} AIC={ref['aic']:.4f} BIC={ref['bic']:.4f}")
    print(f"Ljung-Box z: {ref['ljungBoxResiduals']}  z^2: {ref['ljungBoxSquaredResiduals']}")
    print(f"half-life={ref['halfLifeDays']:.2f} days  z excess kurtosis={ref['standardizedExcessKurtosis']:.3f}")
    print(f"forecast: {ref['forecast']}")


if __name__ == "__main__":
    main()
