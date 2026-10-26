"""Write return, drawdown and beta fixtures consumed by backend/src/models/performance.test.ts.

Beta needs a second coin: data/ethereum_usd_daily.csv holds Ethereum closes for the same
dates as the Bitcoin sample, exported from the stored CoinGecko price history.

    uv run scripts/make_performance_fixtures.py
"""

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from scipy import stats

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from cql_validation import performance, returns  # noqa: E402

FIXTURE_DIR = ROOT.parent / "backend" / "src" / "test" / "fixtures" / "performance"
ETH_CSV = ROOT / "data" / "ethereum_usd_daily.csv"


def check(name: str, reference: float, library: float) -> None:
    if not np.isclose(reference, library, rtol=1e-12, atol=0):
        raise SystemExit(f"{name}: reference {reference!r} disagrees with library {library!r}")


def main() -> None:
    FIXTURE_DIR.mkdir(parents=True, exist_ok=True)
    btc = pd.read_csv(ROOT / "data" / "bitcoin_usd_daily.csv")
    eth = pd.read_csv(ETH_CSV)
    merged = btc.merge(eth, on=["date", "timestamp_ms"], suffixes=("_btc", "_eth"))
    if len(merged) != len(btc):
        raise SystemExit(f"Ethereum sample covers {len(merged)} of {len(btc)} Bitcoin dates")

    dates = merged["date"].tolist()
    timestamps = merged["timestamp_ms"].to_numpy()
    ppy = returns.periods_per_year(timestamps)
    coins = {}
    for name, column in [("bitcoin", "price_usd_btc"), ("ethereum", "price_usd_eth")]:
        prices = merged[column].to_numpy()
        r = returns.simple_returns(prices)
        dd = performance.drawdowns(prices, dates)
        check(f"{name} max drawdown", dd["maxDrawdown"], performance.pandas_drawdown(prices))
        worst = performance.worst_days(r, dates[1:])
        library_worst = pd.Series(r).nsmallest(5).to_numpy()
        for a, b in zip([w["return"] for w in worst], library_worst):
            check(f"{name} worst day", a, float(b))
        week = performance.worst_week(prices, dates)
        check(f"{name} worst week", week["return"], float(pd.Series(prices).pct_change(7).min()))
        annual = performance.annualized_return(prices, ppy)
        coins[name] = {
            "prices": [float(p) for p in prices],
            "annualizedReturn": annual,
            "sharpe": performance.sharpe(r, ppy),
            "sortino": performance.sortino(r, ppy),
            "calmar": annual / abs(dd["maxDrawdown"]),
            **dd,
            "worstDays": worst,
            "worstWeek": week,
        }

    btc_r = returns.simple_returns(merged["price_usd_btc"].to_numpy())
    eth_r = returns.simple_returns(merged["price_usd_eth"].to_numpy())
    full = performance.beta(eth_r, btc_r)
    recent = performance.beta(eth_r[-90:], btc_r[-90:])
    check("correlation", full["correlation"], float(np.corrcoef(eth_r, btc_r)[0, 1]))
    check("beta", full["beta"], float(np.cov(eth_r, btc_r, ddof=1)[0, 1] / np.var(btc_r, ddof=1)))

    fixture = {
        "description": "Bitcoin and Ethereum daily USD closes from CoinGecko, 2025-10-23 to 2026-10-21",
        "generatedBy": "validation/scripts/make_performance_fixtures.py",
        "source": "CoinGecko market_chart, vs_currency=usd, interval=daily",
        "dates": dates,
        "timestamps": [int(t) for t in timestamps],
        "periodsPerYear": ppy,
        "coins": coins,
        "ethereumBeta": {"days365": full, "days90": recent},
    }
    (FIXTURE_DIR / "btc_eth_daily.json").write_text(json.dumps(fixture, indent=2) + "\n")
    for name, c in coins.items():
        print(f"{name}: return={c['annualizedReturn']:.2%} sharpe={c['sharpe']:.3f} sortino={c['sortino']:.3f} "
              f"calmar={c['calmar']:.3f} maxDD={c['maxDrawdown']:.2%} {c['peakDate']}->{c['troughDate']} "
              f"recovered={c['recoveryDate']} current={c['currentDrawdown']:.2%} longest={c['longestDrawdownDays']}d")
        print(f"  worst days {[(w['date'], round(w['return'] * 100, 2)) for w in c['worstDays']]} worst week {c['worstWeek']}")
    print(f"ETH beta to BTC: 365d {full}  90d {recent}")


if __name__ == "__main__":
    main()
