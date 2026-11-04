"""Write covariance and portfolio fixtures consumed by backend/src/models/covariance.test.ts and portfolio.test.ts.

    uv run scripts/make_portfolio_fixtures.py

The returns are simulated from a two-factor model, so the fixtures hold no market data. One case has more assets than
days, where the sample covariance is singular and only the shrunk one can be optimized.
"""

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from pypfopt import risk_models
from sklearn.covariance import LedoitWolf

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from cql_validation import portfolio as pf  # noqa: E402

FIXTURE_DIR = ROOT.parent / "backend" / "src" / "test" / "fixtures" / "portfolio"
CASES = {"factor_250x12": (250, 12), "wide_40x30": (40, 30)}
FRONTIER_POINTS = 7


def simulated_returns(days: int, assets: int, rng: np.random.Generator) -> np.ndarray:
    factors = rng.standard_normal((days, 2)) * [0.03, 0.015]
    loadings = rng.uniform(0.5, 1.5, (2, assets))
    idiosyncratic = rng.standard_normal((days, assets)) * rng.uniform(0.005, 0.04, assets)
    return 0.0005 + factors @ loadings + idiosyncratic


def main() -> None:
    FIXTURE_DIR.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(2026)

    for name, (days, assets) in CASES.items():
        r = simulated_returns(days, assets, rng)
        cov, shrinkage = pf.ledoit_wolf(r)
        library = LedoitWolf().fit(r)
        gap = np.abs(cov - library.covariance_).max() / np.abs(cov).max()
        if gap > 1e-12 or abs(shrinkage - library.shrinkage_) > 1e-12:
            raise SystemExit(f"{name}: Ledoit-Wolf differs from scikit-learn by {gap:.2e}")

        correlated, correlated_shrinkage = pf.constant_correlation(r)
        # PyPortfolioOpt divides the sample covariance by n - 1; give it the authors' divide-by-n version to compare
        other = risk_models.CovarianceShrinkage(pd.DataFrame(r), returns_data=True, frequency=1)
        other.S = (r - r.mean(axis=0)).T @ (r - r.mean(axis=0)) / len(r)
        other_cov, other_shrinkage = other._ledoit_wolf_constant_correlation()
        correlated_gap = np.abs(correlated - other_cov).max() / np.abs(correlated).max()
        if correlated_gap > 1e-12 or abs(correlated_shrinkage - other_shrinkage) > 1e-12:
            raise SystemExit(f"{name}: constant-correlation shrinkage differs from PyPortfolioOpt by {correlated_gap:.2e}")

        mean = r.mean(axis=0)
        minimum = pf.minimum_variance(cov)
        parity = pf.risk_parity(cov)
        frontier = pf.efficient_frontier(cov, mean, FRONTIER_POINTS)
        fixture = {
            "name": name,
            "generatedBy": "validation/scripts/make_portfolio_fixtures.py",
            "returns": r.tolist(),
            "reference": {
                "sampleCovariance": pf.sample_covariance(r).tolist(),
                "ledoitWolf": {"covariance": cov.tolist(), "shrinkage": shrinkage},
                "constantCorrelation": {"covariance": correlated.tolist(), "shrinkage": correlated_shrinkage},
                "minimumVariance": minimum.tolist(),
                "riskParity": parity.tolist(),
                "riskContributions": {
                    "minimumVariance": pf.risk_contributions(minimum, cov).tolist(),
                    "equalWeight": pf.risk_contributions(np.full(assets, 1 / assets), cov).tolist(),
                },
                "frontier": [
                    {"weights": w.tolist(), "expectedReturn": float(w @ mean), "volatility": float(np.sqrt(w @ cov @ w))}
                    for w in frontier
                ],
            },
            "scikitLearn": {"shrinkage": float(library.shrinkage_), "largestRelativeGap": float(gap)},
            "pyPortfolioOpt": {"shrinkage": float(other_shrinkage), "largestRelativeGap": float(correlated_gap)},
        }
        out = FIXTURE_DIR / f"{name}.json"
        out.write_text(json.dumps(fixture, indent=1) + "\n")
        print(
            f"{name}: shrinkage {shrinkage:.4f} (scikit-learn gap {gap:.1e}), constant correlation {correlated_shrinkage:.4f} "
            f"(PyPortfolioOpt gap {correlated_gap:.1e}); minimum variance holds "
            f"{(minimum > 0).sum()} of {assets}; risk parity contributions within {np.ptp(pf.risk_contributions(parity, cov)):.1e}; "
            f"frontier holds {[int((w > 0).sum()) for w in frontier]}"
        )


if __name__ == "__main__":
    main()
