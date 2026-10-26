"""Write regime fixtures consumed by backend/src/models/regime.test.ts.

    uv run scripts/make_regime_fixtures.py
"""

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from cql_validation import regime  # noqa: E402

FIXTURE_DIR = ROOT.parent / "backend" / "src" / "test" / "fixtures" / "regime"


def main() -> None:
    FIXTURE_DIR.mkdir(parents=True, exist_ok=True)
    coins = {}
    for coin in ["bitcoin", "ethereum"]:
        prices = pd.read_csv(ROOT / "data" / f"{coin}_usd_daily.csv")["price_usd"].to_numpy()
        # Each full-length series, and one ending in each month, so the fixture covers several regimes
        cases = []
        for end in [200, 230, 260, 290, 320, len(prices)]:
            p = prices[:end]
            ref = regime.regime(p)
            library = regime.pandas_regime(p)
            for key in library:
                if not np.isclose(ref[key], library[key], rtol=1e-12, atol=0):
                    raise SystemExit(f"{coin}[:{end}] {key}: reference {ref[key]!r} disagrees with pandas {library[key]!r}")
            cases.append({"closes": end, **ref})
        coins[coin] = {"prices": [float(x) for x in prices], "cases": cases}
        for c in cases:
            print(f"{coin}[:{c['closes']}] {c['trend']:4} price/SMA={c['priceToMovingAverage']:.3f} vol pct={c['volatilityPercentile']:.3f} {c['volatilityLevel']}")

    fixture = {
        "description": "Bitcoin and Ethereum daily USD closes from CoinGecko, 2025-10-23 to 2026-10-21",
        "generatedBy": "validation/scripts/make_regime_fixtures.py",
        "source": "CoinGecko market_chart, vs_currency=usd, interval=daily",
        "coins": coins,
    }
    (FIXTURE_DIR / "btc_eth_daily.json").write_text(json.dumps(fixture, indent=2) + "\n")


if __name__ == "__main__":
    main()
