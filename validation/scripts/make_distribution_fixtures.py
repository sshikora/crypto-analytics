"""Write probability-function fixtures consumed by backend/src/models/distributions.test.ts.

The TypeScript implementations are checked against scipy at points spread
across the body and far into the tails.

    uv run scripts/make_distribution_fixtures.py
"""

import json
from pathlib import Path

import numpy as np
from scipy import special, stats

ROOT = Path(__file__).resolve().parent.parent
FIXTURE_DIR = ROOT.parent / "backend" / "src" / "test" / "fixtures" / "distributions"

NORMAL_X = [-37.5, -20.0, -10.0, -8.0, -5.0, -3.0, -1.96, -1.0, -0.1, 0.0, 0.5, 1.0, 1.6448536269514722, 2.5, 4.0, 7.0]
PROBABILITIES = [1e-12, 1e-8, 1e-5, 0.001, 0.01, 0.025, 0.05, 0.1, 0.3, 0.5, 0.7, 0.95, 0.975, 0.99, 0.999, 1 - 1e-8]
T_DOF = [2.1, 2.5, 3.0, 4.7, 10.0, 30.0, 200.0]
T_X = [-50.0, -10.0, -4.0, -2.0, -1.0, -0.25, 0.0, 0.7, 1.5, 3.0, 8.0]
GAMMA_ARGS = [0.1, 0.5, 1.0, 1.5, 2.5, 7.3, 10.0, 50.5, 171.0, 1000.0]
GAMMA_INC = [(0.5, 0.01), (0.5, 3.0), (1.0, 2.0), (2.5, 0.8), (2.5, 9.0), (5.0, 5.0), (10.0, 3.0), (10.0, 25.0), (30.0, 28.0)]
BETA_INC = [(0.5, 0.5, 0.1), (0.5, 2.0, 0.3), (2.0, 3.0, 0.4), (1.25, 0.5, 0.95), (5.0, 0.5, 0.2), (15.0, 0.5, 0.99), (100.0, 0.5, 0.9)]
CHI2 = [(1, 0.004), (1, 3.841458820694124), (1, 6.634896601021214), (1, 30.0), (2, 0.1), (2, 5.991464547107979), (2, 12.0), (5, 11.07), (10, 4.0), (10, 23.209), (20, 31.41)]


def main() -> None:
    FIXTURE_DIR.mkdir(parents=True, exist_ok=True)
    fixture = {
        "generatedBy": "validation/scripts/make_distribution_fixtures.py",
        "library": f"scipy {__import__('scipy').__version__}",
        "logGamma": [{"x": x, "value": float(special.gammaln(x))} for x in GAMMA_ARGS],
        "gammaP": [{"a": a, "x": x, "value": float(special.gammainc(a, x))} for a, x in GAMMA_INC],
        "gammaQ": [{"a": a, "x": x, "value": float(special.gammaincc(a, x))} for a, x in GAMMA_INC],
        "betaRegularized": [{"a": a, "b": b, "x": x, "value": float(special.betainc(a, b, x))} for a, b, x in BETA_INC],
        "normalPdf": [{"x": x, "value": float(stats.norm.pdf(x))} for x in NORMAL_X],
        "normalCdf": [{"x": x, "value": float(stats.norm.cdf(x))} for x in NORMAL_X],
        "normalQuantile": [{"p": p, "value": float(stats.norm.ppf(p))} for p in PROBABILITIES],
        "studentTPdf": [{"dof": v, "x": x, "value": float(stats.t.pdf(x, v))} for v in T_DOF for x in T_X],
        "studentTCdf": [{"dof": v, "x": x, "value": float(stats.t.cdf(x, v))} for v in T_DOF for x in T_X],
        "studentTQuantile": [
            {"dof": v, "p": p, "value": float(stats.t.ppf(p, v))} for v in T_DOF for p in PROBABILITIES if p >= 1e-8
        ],
        "chiSquareSurvival": [{"dof": k, "x": x, "value": float(stats.chi2.sf(x, k))} for k, x in CHI2],
    }
    out = FIXTURE_DIR / "scipy.json"
    out.write_text(json.dumps(fixture, indent=2) + "\n")
    print(f"wrote {sum(len(v) for v in fixture.values() if isinstance(v, list))} reference values from {fixture['library']}")


if __name__ == "__main__":
    main()
