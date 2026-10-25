"""Write VaR fixtures consumed by backend/src/models/valueAtRisk.test.ts.

    uv run scripts/make_var_fixtures.py
"""

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from scipy import stats

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from cql_validation import returns, var  # noqa: E402

FIXTURE_DIR = ROOT.parent / "backend" / "src" / "test" / "fixtures" / "var"
WINDOW = 180
CONFIDENCE = [0.95, 0.99]


def main() -> None:
    FIXTURE_DIR.mkdir(parents=True, exist_ok=True)

    btc = pd.read_csv(ROOT / "data" / "bitcoin_usd_daily.csv")
    prices = btc["price_usd"].to_numpy()
    r = returns.simple_returns(prices)
    latest = r[-WINDOW:]

    fit = var.fit_student_t(latest)
    scipy_dof, scipy_loc, scipy_scale = stats.t.fit(latest)
    scipy_ll = float(np.sum(stats.t.logpdf(latest, scipy_dof, scipy_loc, scipy_scale)))
    if fit.log_likelihood < scipy_ll - 1e-9:
        raise SystemExit(f"polished fit {fit.log_likelihood} is below scipy's {scipy_ll}")

    levels = []
    for confidence in CONFIDENCE:
        alpha = 1 - confidence
        methods = {}
        for name in var.METHODS:
            value_at_risk, expected_shortfall = (
                var.student_t(latest, alpha, fit) if name == "studentT" else var.METHODS[name](latest, alpha)
            )
            hits = var.exceptions(r, name, alpha, WINDOW)
            lr_uc, p_uc = var.kupiec(hits, alpha)
            lr_ind, p_ind = var.christoffersen(hits)
            methods[name] = {
                "valueAtRisk": value_at_risk,
                "expectedShortfall": expected_shortfall,
                "exceptions": [i for i, h in enumerate(hits) if h],
                "days": len(hits),
                "kupiec": {"statistic": lr_uc, "pValue": p_uc},
                "christoffersen": {"statistic": lr_ind, "pValue": p_ind},
                "conditionalCoverage": {"statistic": lr_uc + lr_ind, "pValue": float(stats.chi2.sf(lr_uc + lr_ind, 2))},
            }
            print(
                f"{confidence:.0%} {name:10} VaR={value_at_risk:.4%} ES={expected_shortfall:.4%} "
                f"exceptions={sum(hits)}/{len(hits)} p_uc={p_uc:.3f} p_ind={p_ind:.3f}"
            )
        levels.append({"confidence": confidence, "methods": methods})

    fixture = {
        "name": "btc_daily",
        "description": "Bitcoin daily USD closes from CoinGecko, 2025-10-23 to 2026-10-21",
        "generatedBy": "validation/scripts/make_var_fixtures.py",
        "source": "CoinGecko market_chart, bitcoin, vs_currency=usd, interval=daily",
        "window": WINDOW,
        "prices": [float(p) for p in prices],
        "reference": {
            "studentT": {"location": fit.location, "scale": fit.scale, "dof": fit.dof, "logLikelihood": fit.log_likelihood},
            "levels": levels,
        },
        "scipyFit": {"location": float(scipy_loc), "scale": float(scipy_scale), "dof": float(scipy_dof), "logLikelihood": scipy_ll},
    }

    out = FIXTURE_DIR / "btc_daily.json"
    out.write_text(json.dumps(fixture, indent=2) + "\n")
    print(f"Student-t: dof={fit.dof:.4f} loc={fit.location:.6f} scale={fit.scale:.6f} LL={fit.log_likelihood:.6f} (scipy LL {scipy_ll:.6f})")


if __name__ == "__main__":
    main()
