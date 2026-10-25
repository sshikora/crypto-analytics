"""Reference one-day VaR, expected shortfall and backtests matching backend/src/models/valueAtRisk.ts.

Conventions:
- Simple returns, so a loss is exactly -R times the amount held.
- VaR and ES are positive losses as a fraction of the position, at tail
  probability alpha = 1 - confidence.
- Historical: numpy's default (linear) quantile; ES is the mean of returns at
  or below it.
- Normal: sample mean and sample standard deviation (n - 1).
- Student-t: location, scale and degrees of freedom by maximum likelihood.
- Backtests are out of sample: each day's VaR uses only the `window` returns
  before it. Kupiec (1995) tests the exception rate, Christoffersen (1998) tests
  whether exceptions cluster, and their sum tests conditional coverage.
"""

from dataclasses import dataclass

import numpy as np
from scipy import optimize, stats


@dataclass
class StudentTFit:
    location: float
    scale: float
    dof: float
    log_likelihood: float


def historical(returns: np.ndarray, alpha: float) -> tuple[float, float]:
    q = float(np.quantile(returns, alpha))
    return -q, -float(returns[returns <= q].mean())


def normal(returns: np.ndarray, alpha: float) -> tuple[float, float]:
    mu, sigma = returns.mean(), returns.std(ddof=1)
    z = stats.norm.ppf(alpha)
    return float(-(mu + sigma * z)), float(-(mu - sigma * stats.norm.pdf(z) / alpha))


def fit_student_t(returns: np.ndarray) -> StudentTFit:
    """scipy's MLE, polished with a tight Nelder-Mead so the reference sits at the maximum."""
    x = returns * 100
    dof0, loc0, scale0 = stats.t.fit(x)

    def neg_ll(p: np.ndarray) -> float:
        loc, log_scale, log_excess = p
        return -float(np.sum(stats.t.logpdf(x, 2 + np.exp(log_excess), loc, np.exp(log_scale))))

    start = np.array([loc0, np.log(scale0), np.log(max(dof0 - 2, 1e-3))])
    res = optimize.minimize(neg_ll, start, method="Nelder-Mead", options={"xatol": 1e-12, "fatol": 1e-13, "maxiter": 20000})
    loc, log_scale, log_excess = res.x
    dof = 2 + float(np.exp(log_excess))
    scale = float(np.exp(log_scale)) / 100
    ll = float(np.sum(stats.t.logpdf(returns, dof, loc / 100, scale)))
    return StudentTFit(location=float(loc) / 100, scale=scale, dof=dof, log_likelihood=ll)


def student_t(returns: np.ndarray, alpha: float, fit: StudentTFit | None = None) -> tuple[float, float]:
    f = fit or fit_student_t(returns)
    q = stats.t.ppf(alpha, f.dof)
    tail = stats.t.pdf(q, f.dof) / alpha * (f.dof + q**2) / (f.dof - 1)
    return float(-(f.location + f.scale * q)), float(-(f.location - f.scale * tail))


METHODS = {"historical": historical, "normal": normal, "studentT": student_t}


def exceptions(returns: np.ndarray, method: str, alpha: float, window: int) -> list[bool]:
    out = []
    for t in range(window, len(returns)):
        var, _ = METHODS[method](returns[t - window : t], alpha)
        out.append(bool(returns[t] < -var))
    return out


def xlogy(x: float, y: float) -> float:
    return 0.0 if x == 0 else x * np.log(y)


def kupiec(hits: list[bool], alpha: float) -> tuple[float, float]:
    n, x = len(hits), sum(hits)
    lr = -2 * (xlogy(n - x, 1 - alpha) + xlogy(x, alpha)) + 2 * (xlogy(n - x, 1 - x / n) + xlogy(x, x / n))
    return float(lr), float(stats.chi2.sf(lr, 1))


def christoffersen(hits: list[bool]) -> tuple[float, float]:
    counts = {(i, j): 0 for i in (0, 1) for j in (0, 1)}
    for prev, cur in zip(hits[:-1], hits[1:]):
        counts[(int(prev), int(cur))] += 1
    n00, n01, n10, n11 = counts[(0, 0)], counts[(0, 1)], counts[(1, 0)], counts[(1, 1)]
    pi0 = n01 / (n00 + n01) if n00 + n01 else 0.0
    pi1 = n11 / (n10 + n11) if n10 + n11 else 0.0
    pi = (n01 + n11) / (n00 + n01 + n10 + n11)
    restricted = xlogy(n00 + n10, 1 - pi) + xlogy(n01 + n11, pi)
    unrestricted = xlogy(n00, 1 - pi0) + xlogy(n01, pi0) + xlogy(n10, 1 - pi1) + xlogy(n11, pi1)
    lr = -2 * (restricted - unrestricted)
    return float(lr), float(stats.chi2.sf(lr, 1))
