"""Write realized volatility fixtures consumed by backend/src/models/realizedVolatility.test.ts.

    uv run scripts/make_realized_vol_fixtures.py
"""

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from cql_validation import realized_vol, returns  # noqa: E402

FIXTURE_DIR = ROOT.parent / "backend" / "src" / "test" / "fixtures" / "realized_vol"
WINDOWS = [7, 30, 90]
DECAYS = [0.94, 0.97]


def check(name: str, reference: list[float | None], library: list[float | None]) -> None:
    for i, (r, lib) in enumerate(zip(reference, library, strict=True)):
        if (r is None) != (lib is None) or (r is not None and not np.isclose(r, lib, rtol=1e-12, atol=0)):
            raise SystemExit(f"{name}[{i}]: reference {r!r} disagrees with pandas {lib!r}")


def main() -> None:
    FIXTURE_DIR.mkdir(parents=True, exist_ok=True)

    btc = pd.read_csv(ROOT / "data" / "bitcoin_usd_daily.csv")
    prices = btc["price_usd"].to_numpy()
    log_r = returns.log_returns(prices)

    rolling = {}
    for window in WINDOWS:
        rolling[str(window)] = realized_vol.rolling_volatility(log_r, window)
        check(f"rolling {window}", rolling[str(window)], realized_vol.pandas_rolling_volatility(log_r, window))

    ewma = {}
    for decay in DECAYS:
        ewma[str(decay)] = realized_vol.ewma_variance(log_r, decay)
        check(f"ewma {decay}", ewma[str(decay)], realized_vol.pandas_ewma_variance(log_r, decay))

    fixture = {
        "name": "btc_daily",
        "description": "Bitcoin daily USD closes from CoinGecko, 2025-10-23 to 2026-10-21",
        "generatedBy": "validation/scripts/make_realized_vol_fixtures.py",
        "source": "CoinGecko market_chart, bitcoin, vs_currency=usd, interval=daily",
        "prices": [float(p) for p in prices],
        "reference": {
            "rollingVolatility": rolling,
            "ewmaVariance": ewma,
        },
        "checkedAgainst": "pandas rolling(window).std(ddof=1) and ewm(alpha=1-decay, adjust=True).mean() of squared returns, rtol 1e-12",
    }

    out = FIXTURE_DIR / "btc_daily.json"
    out.write_text(json.dumps(fixture, indent=2) + "\n")
    for window in WINDOWS:
        print(f"rolling {window}: latest {rolling[str(window)][-1]:.6f}")
    for decay in DECAYS:
        print(f"ewma {decay}: latest vol {np.sqrt(ewma[str(decay)][-1]):.6f}")


if __name__ == "__main__":
    main()
