"""Write Monte Carlo fixtures consumed by backend/src/models/random.test.ts and monteCarlo.test.ts.

    uv run scripts/make_monte_carlo_fixtures.py
"""

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from cql_validation import monte_carlo as mc, returns  # noqa: E402

FIXTURE_DIR = ROOT.parent / "backend" / "src" / "test" / "fixtures" / "monte_carlo"
SEEDS = [0, 1, 2**32 - 1]
GAMMA_SHAPES = [1.0, 1.55, 4.0]
PATHS, DAYS, SEED = 6, 25, 2026
SUMMARY_PATHS, SUMMARY_DAYS, SUMMARY_SEED = 2000, 30, 11
QUANTILES = [0.05, 0.25, 0.5, 0.75, 0.95]
ALPHA = 0.05
THRESHOLDS = [0.1, 0.2, 0.3]


def stream_reference(seed: int) -> dict:
    s = mc.Stream(seed)
    raw = [str(s.raw()) for _ in range(4)]
    uniforms = [s.uniform() for _ in range(4)]
    normals = [s.normal() for _ in range(5)]
    gammas = {str(shape): [s.gamma(shape) for _ in range(3)] for shape in GAMMA_SHAPES}
    return {"seed": seed, "raw": raw, "uniforms": uniforms, "normals": normals, "gammas": gammas}


def model_json(model) -> dict:
    if isinstance(model, mc.Gbm):
        return {"kind": "gbm", "mu": model.mu, "sigma": model.sigma}
    if isinstance(model, mc.StudentT):
        return {"kind": "studentT", "location": model.location, "scale": model.scale, "dof": model.dof}
    return {
        "kind": "garchBootstrap",
        "mu": model.mu,
        "omega": model.omega,
        "alpha": model.alpha,
        "beta": model.beta,
        "nextVariance": model.next_variance,
        "residuals": [float(z) for z in model.residuals],
    }


def main() -> None:
    FIXTURE_DIR.mkdir(parents=True, exist_ok=True)

    btc = pd.read_csv(ROOT / "data" / "bitcoin_usd_daily.csv")
    prices = btc["price_usd"].to_numpy()
    r = returns.log_returns(prices)
    models = [mc.gbm(r), mc.student_t(r), mc.garch_bootstrap(r)]

    simulations = []
    for model in models:
        for antithetic in (False, True):
            paths = mc.simulate(model, PATHS, DAYS, SEED, antithetic)
            large = mc.simulate(model, SUMMARY_PATHS, SUMMARY_DAYS, SUMMARY_SEED, antithetic)
            summary = mc.summarize(large, antithetic, QUANTILES, ALPHA, THRESHOLDS)
            simulations.append({
                "model": model_json(model)["kind"],
                "antithetic": antithetic,
                "cumulative": paths.tolist(),
                "summary": summary,
            })
            print(
                f"{model_json(model)['kind']:15} antithetic={antithetic!s:5} mean={summary['mean']:+.4%} "
                f"se={summary['standardError']:.4%} VaR={summary['valueAtRisk']:.2%} ES={summary['expectedShortfall']:.2%} "
                f"drawdowns={summary['drawdownProbabilities']}"
            )

    fixture = {
        "name": "btc_daily",
        "description": "Bitcoin daily USD closes from CoinGecko, 2025-10-23 to 2026-10-21",
        "generatedBy": "validation/scripts/make_monte_carlo_fixtures.py",
        "source": "CoinGecko market_chart, bitcoin, vs_currency=usd, interval=daily",
        "prices": [float(p) for p in prices],
        "streams": [stream_reference(seed) for seed in SEEDS],
        "models": [model_json(m) for m in models],
        "paths": {"paths": PATHS, "days": DAYS, "seed": SEED},
        "summary": {
            "paths": SUMMARY_PATHS,
            "days": SUMMARY_DAYS,
            "seed": SUMMARY_SEED,
            "quantiles": QUANTILES,
            "alpha": ALPHA,
            "thresholds": THRESHOLDS,
        },
        "simulations": simulations,
    }

    out = FIXTURE_DIR / "btc_daily.json"
    out.write_text(json.dumps(fixture, indent=1) + "\n")
    print(f"wrote {out.relative_to(ROOT.parent)} ({out.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
