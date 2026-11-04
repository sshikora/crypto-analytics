"""Reference covariance estimates and long-only portfolios matching backend/src/models/covariance.ts and portfolio.ts.

Conventions:
- Returns are simple daily returns, one row per day and one column per asset.
- The sample covariance divides by n - 1.
- Ledoit-Wolf (2004) shrinks the maximum-likelihood covariance (divided by n, after demeaning) towards a multiple of
  the identity, with the shrinkage intensity estimated from the data, as in scikit-learn's LedoitWolf.
- The constant-correlation version (Ledoit and Wolf, "Honey, I shrunk the sample covariance matrix", 2004) shrinks the
  same matrix towards one that keeps each variance and sets every correlation to the average. This is PyPortfolioOpt's
  version, except that PyPortfolioOpt divides the sample covariance by n - 1 where the authors' code divides by n.
- Portfolios are long-only and fully invested: weights are non-negative and sum to 1.
- Risk parity gives every asset the same share of variance, w_i (Sigma w)_i = w' Sigma w / n, solved as Spinu (2013).
- The frontier is the minimum variance at each target return between the minimum-variance portfolio's return and the
  largest asset mean.

The optimizers here are scipy's, independent of the backend's active-set method. Covariances are scaled to percent
squared inside them so the objective isn't tiny next to scipy's tolerances.
"""

import numpy as np
from scipy import optimize

SCALE = 1e4


def sample_covariance(returns: np.ndarray) -> np.ndarray:
    return np.cov(returns, rowvar=False)


def ledoit_wolf(returns: np.ndarray) -> tuple[np.ndarray, float]:
    """Shrunk covariance and shrinkage intensity, from the formulas in Ledoit and Wolf (2004), section 3."""
    x = returns - returns.mean(axis=0)
    n, p = x.shape
    s = x.T @ x / n
    mu = np.trace(s) / p
    target = mu * np.eye(p)
    d2 = np.sum((s - target) ** 2) / p
    b2_bar = sum(np.sum((np.outer(row, row) - s) ** 2) for row in x) / (p * n**2)
    b2 = min(b2_bar, d2)
    shrinkage = b2 / d2 if d2 > 0 else 0.0
    return shrinkage * target + (1 - shrinkage) * s, shrinkage


def constant_correlation(returns: np.ndarray) -> tuple[np.ndarray, float]:
    """Shrunk covariance and intensity, from the formulas in Ledoit and Wolf's "Honey" paper, appendix B."""
    x = returns - returns.mean(axis=0)
    n, p = x.shape
    s = x.T @ x / n
    sd = np.sqrt(np.diag(s))
    average_correlation = (np.sum(s / np.outer(sd, sd)) - p) / (p * (p - 1))
    target = average_correlation * np.outer(sd, sd)
    np.fill_diagonal(target, np.diag(s))

    pi = np.array([[np.mean((x[:, i] * x[:, j] - s[i, j]) ** 2) for j in range(p)] for i in range(p)])
    # theta[i, j] = E[(x_i^2 - s_ii)(x_i x_j - s_ij)]
    theta = np.array([[np.mean((x[:, i] ** 2 - s[i, i]) * (x[:, i] * x[:, j] - s[i, j])) for j in range(p)] for i in range(p)])
    off_diagonal = ~np.eye(p, dtype=bool)
    rho = np.trace(pi) + average_correlation * np.sum((np.outer(1 / sd, sd) * theta)[off_diagonal])
    gamma = np.sum((target - s) ** 2)
    shrinkage = max(0.0, min(1.0, (pi.sum() - rho) / gamma / n))
    return shrinkage * target + (1 - shrinkage) * s, shrinkage


def portfolio_variance(w: np.ndarray, cov: np.ndarray) -> float:
    return float(w @ cov @ w)


def risk_contributions(w: np.ndarray, cov: np.ndarray) -> np.ndarray:
    """Each asset's share of portfolio variance; the shares sum to 1."""
    return w * (cov @ w) / portfolio_variance(w, cov)


SUPPORT_THRESHOLD = 1e-7
KKT_TOLERANCE = 1e-10


def _exact_on_support(cov: np.ndarray, w: np.ndarray, mean: np.ndarray | None, target: float | None) -> np.ndarray:
    """SLSQP finds which assets are held; this solves the optimality conditions on them exactly and checks the rest.

    Minimizing w' S w subject to 1'w = 1 (and mean'w = target) gives 2 S w = nu 1 (+ eta mean) on the held assets,
    and every asset left out must have 2 (S w)_j >= nu (+ eta mean_j)."""
    c = cov * SCALE
    held = np.flatnonzero(w > SUPPORT_THRESHOLD)
    constraints = [np.ones(len(c))] + ([mean * SCALE] if mean is not None else [])
    rhs = [1.0] + ([target * SCALE] if mean is not None else [])
    k, m = len(held), len(constraints)
    kkt = np.zeros((k + m, k + m))
    kkt[:k, :k] = 2 * c[np.ix_(held, held)]
    for i, a in enumerate(constraints):
        kkt[:k, k + i] = -a[held]
        kkt[k + i, :k] = a[held]
    solution = np.linalg.solve(kkt, np.r_[np.zeros(k), rhs])
    exact = np.zeros(len(c))
    exact[held] = solution[:k]
    multipliers = solution[k:]

    slack = 2 * c @ exact - sum(mu * a for mu, a in zip(multipliers, constraints))
    scale = np.abs(2 * c @ exact).max()
    if exact.min() < -KKT_TOLERANCE or slack.min() < -KKT_TOLERANCE * scale:
        raise RuntimeError("the support SLSQP found is not optimal")
    return np.clip(exact, 0, None)


def _long_only(objective, n: int, extra_constraints=()) -> np.ndarray:
    result = optimize.minimize(
        objective,
        np.full(n, 1 / n),
        method="SLSQP",
        jac=True,
        bounds=[(0.0, 1.0)] * n,
        constraints=[{"type": "eq", "fun": lambda w: w.sum() - 1, "jac": lambda w: np.ones(n)}, *extra_constraints],
        options={"ftol": 1e-13, "maxiter": 2000},
    )
    # SLSQP often stops near the optimum saying it can't improve; the exact check on its support decides
    return result.x


def minimum_variance(cov: np.ndarray) -> np.ndarray:
    c = cov * SCALE
    return _exact_on_support(cov, _long_only(lambda w: (w @ c @ w, 2 * c @ w), len(c)), None, None)


def frontier_portfolio(cov: np.ndarray, mean: np.ndarray, target: float) -> np.ndarray:
    c = cov * SCALE
    constraint = {"type": "eq", "fun": lambda w: (w @ mean - target) * SCALE, "jac": lambda w: mean * SCALE}
    return _exact_on_support(cov, _long_only(lambda w: (w @ c @ w, 2 * c @ w), len(c), [constraint]), mean, target)


def efficient_frontier(cov: np.ndarray, mean: np.ndarray, points: int) -> list[np.ndarray]:
    """Evenly spaced target returns; the last point holds only the asset with the largest mean."""
    low = float(minimum_variance(cov) @ mean)
    targets = np.linspace(low, mean.max(), points)
    top = np.eye(len(mean))[np.argmax(mean)]
    return [minimum_variance(cov)] + [frontier_portfolio(cov, mean, t) for t in targets[1:-1]] + [top]


def risk_parity(cov: np.ndarray) -> np.ndarray:
    """y minimizes y' Sigma y / 2 - sum(b log y); then w = y / sum(y) has equal risk contributions."""
    c = cov * SCALE
    n = len(c)
    b = np.full(n, 1 / n)

    def objective(y):
        return 0.5 * y @ c @ y - b @ np.log(y), c @ y - b / y

    def hessian(y):
        return c + np.diag(b / y**2)

    y0 = b / np.sqrt(np.diag(c))
    result = optimize.minimize(objective, y0, jac=True, hess=hessian, method="trust-exact", options={"gtol": 1e-14})
    return result.x / result.x.sum()
