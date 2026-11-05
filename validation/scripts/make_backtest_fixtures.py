"""Write signal backtest fixtures consumed by backend/src/models/backtest.test.ts.

The reference is checked first against pandas (moving averages and costed returns, computed a second way) and
against the numerical example in Bailey and López de Prado (2014): 100 trials, annualized Sharpe ratio 2.5 with
variance 1/2 across trials, 1,250 daily returns, skewness -3 and kurtosis 10 give SR0 = 0.1132 and DSR = 0.9004,
and 46 trials give 0.9505.

    uv run scripts/make_backtest_fixtures.py
"""

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from scipy import stats

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from cql_validation import backtest as bt  # noqa: E402

FIXTURE_DIR = ROOT.parent / "backend" / "src" / "test" / "fixtures" / "backtest"
SHORTS = [1, 5, 10, 20]
LONGS = [20, 30, 50, 100]
COST = 0.0015
TRAIN = 120
TEST = 30


def check(name: str, reference: np.ndarray | float, library: np.ndarray | float, rtol: float = 1e-12) -> None:
    if not np.allclose(reference, library, rtol=rtol, atol=1e-15, equal_nan=True):
        raise SystemExit(f"{name}: reference disagrees with library")


def psr_from_moments(sr: float, benchmark: float, t: int, skew: float, kurt: float) -> float:
    z = (sr - benchmark) * np.sqrt(t - 1) / np.sqrt(1 - skew * sr + (kurt - 1) / 4 * sr**2)
    return float(stats.norm.cdf(z))


def check_paper() -> None:
    sr = 2.5 / np.sqrt(250)
    variance = 0.5 / 250
    sr0 = bt.expected_maximum_sharpe(100, variance)
    for name, value, published in [
        ("SR0", sr0, 0.1132),
        ("DSR, 100 trials", psr_from_moments(sr, sr0, 1250, -3, 10), 0.9004),
        ("DSR, 46 trials", psr_from_moments(sr, bt.expected_maximum_sharpe(46, variance), 1250, -3, 10), 0.9505),
    ]:
        if round(value, 4) != published:
            raise SystemExit(f"{name}: {value:.6f} does not round to the published {published}")


def main() -> None:
    check_paper()
    FIXTURE_DIR.mkdir(parents=True, exist_ok=True)
    btc = pd.read_csv(ROOT / "data" / "bitcoin_usd_daily.csv")
    prices = btc["price_usd"].to_numpy()

    grid = [(s, l) for s in SHORTS for l in LONGS if s < l]
    variants = []
    for short, long in grid:
        check(f"SMA {long}", bt.moving_average(prices, long), pd.Series(prices).rolling(long).mean().to_numpy())
        positions = bt.crossover_positions(prices, short, long)
        net = bt.strategy_returns(prices, positions, COST)
        held = pd.Series(positions).shift(1).fillna(0)
        library = (held * pd.Series(prices).pct_change() - COST * held.diff().abs().fillna(held)).to_numpy()[1:]
        check(f"net returns {short}/{long}", net, library)
        variants.append({"short": short, "long": long, "positions": positions.tolist(), "returns": net.tolist()})

    start = max(LONGS) - 1
    evaluated = [np.array(v["returns"])[start:] for v in variants]
    sharpes = np.array([bt.sharpe(r) for r in evaluated])
    best = int(np.argmax(sharpes))
    if min(r.std() for r in evaluated) == 0:
        raise SystemExit("a variant never traded, so its correlation is undefined")
    implied = bt.implied_trials(np.array(evaluated))
    corr = pd.DataFrame(np.array(evaluated).T).corr().to_numpy()
    rho = corr[np.triu_indices_from(corr, 1)].mean()
    check("implied trials", implied, rho + (1 - rho) * len(grid))
    wf = bt.walk_forward(prices, [np.array(v["positions"]) for v in variants], start, TRAIN, TEST, COST)

    fixture = {
        "description": "Moving-average crossovers on Bitcoin daily USD closes from CoinGecko, 2025-10-23 to 2026-10-21",
        "generatedBy": "validation/scripts/make_backtest_fixtures.py",
        "prices": prices.tolist(),
        "cost": COST,
        "variants": variants,
        "start": start,
        "sharpe": sharpes.tolist(),
        "best": best,
        "probabilisticSharpe": bt.probabilistic_sharpe(evaluated[best], 0.0),
        "expectedMaximumSharpe": bt.expected_maximum_sharpe(len(grid), float(np.var(sharpes, ddof=1))),
        "deflatedSharpe": bt.deflated_sharpe(evaluated[best], sharpes),
        "impliedTrials": implied,
        "deflatedSharpeImplied": bt.deflated_sharpe(evaluated[best], sharpes, implied),
        "walkForward": {
            "train": TRAIN,
            "test": TEST,
            "chosen": wf.chosen,
            "positions": wf.positions.tolist(),
            "returns": wf.returns.tolist(),
        },
    }
    path = FIXTURE_DIR / "btc_crossovers.json"
    path.write_text(json.dumps(fixture, indent=2) + "\n")
    print(f"wrote {path.relative_to(ROOT.parent)}: best {grid[best]}, DSR {fixture['deflatedSharpe']:.4f}, "
          f"walk-forward chose {[grid[i] for i in wf.chosen]}")


if __name__ == "__main__":
    main()
