"""Reference GARCH(1,1) matching the backend's conventions in backend/src/models/garch.ts.

Conventions, chosen to match the backend exactly:
- Log returns, demeaned by the sample mean (mean is not estimated jointly).
- Gaussian likelihood. h[0] is the sample variance and the t = 0 term is
  excluded, so the sum runs over t = 1 .. n-1.
- Forecasts start from the one-step-ahead variance h[T+1], as in `arch`.
"""

from dataclasses import dataclass

import numpy as np
from arch import arch_model
from scipy.optimize import minimize

from .returns import log_returns

LOG_2PI = np.log(2 * np.pi)


@dataclass
class GarchFit:
    omega: float
    alpha: float
    beta: float
    log_likelihood: float
    variance: np.ndarray  # h[1..n-1], aligned with returns[1..n-1]
    next_variance: float  # h[T+1]


def demeaned_log_returns(prices: np.ndarray) -> np.ndarray:
    returns = log_returns(prices)
    return returns - returns.mean()


def variance_path(omega: float, alpha: float, beta: float, resid: np.ndarray, h0: float) -> np.ndarray:
    h = np.empty(len(resid))
    h[0] = h0
    for t in range(1, len(resid)):
        h[t] = omega + alpha * resid[t - 1] ** 2 + beta * h[t - 1]
    return h


def log_likelihood(omega: float, alpha: float, beta: float, resid: np.ndarray, h0: float) -> float:
    h = variance_path(omega, alpha, beta, resid, h0)[1:]
    e2 = resid[1:] ** 2
    return float(-0.5 * np.sum(LOG_2PI + np.log(h) + e2 / h))


def fit(prices: np.ndarray) -> GarchFit:
    return fit_log_returns(log_returns(prices))


def fit_log_returns(returns: np.ndarray) -> GarchFit:
    resid = returns - returns.mean()
    h0 = float(np.mean(resid**2))

    # Optimise in percent units so all three parameters are of similar scale.
    scale = 100.0
    r = resid * scale

    def objective(p: np.ndarray) -> float:
        omega, alpha, beta = p
        if omega <= 0 or alpha < 0 or beta < 0 or alpha + beta >= 0.9999:
            return 1e10
        return -log_likelihood(omega, alpha, beta, r, h0 * scale**2)

    best = None
    for a0 in (0.03, 0.08, 0.15, 0.25):
        for b0 in (0.6, 0.8, 0.9):
            if a0 + b0 >= 0.99:
                continue
            x0 = np.array([h0 * scale**2 * (1 - a0 - b0), a0, b0])
            res = minimize(
                objective,
                x0,
                method="SLSQP",
                bounds=[(1e-8, None), (0.0, 1.0), (0.0, 1.0)],
                constraints=[{"type": "ineq", "fun": lambda p: 0.9999 - p[1] - p[2]}],
                options={"ftol": 1e-14, "maxiter": 2000},
            )
            if best is None or res.fun < best.fun:
                best = res
    polished = minimize(objective, best.x, method="Nelder-Mead",
                        options={"xatol": 1e-12, "fatol": 1e-14, "maxiter": 20000})
    if polished.fun < best.fun:
        best = polished

    omega = float(best.x[0] / scale**2)
    alpha, beta = float(best.x[1]), float(best.x[2])
    h = variance_path(omega, alpha, beta, resid, h0)
    return GarchFit(
        omega=omega,
        alpha=alpha,
        beta=beta,
        log_likelihood=log_likelihood(omega, alpha, beta, resid, h0),
        variance=h[1:],
        next_variance=float(omega + alpha * resid[-1] ** 2 + beta * h[-1]),
    )


def forecast_variance(f: GarchFit, steps: int) -> float:
    """k-step-ahead variance h[T+k] = LR + (a+b)^(k-1) * (h[T+1] - LR)."""
    persistence = f.alpha + f.beta
    long_run = f.omega / (1 - persistence)
    return long_run + persistence ** (steps - 1) * (f.next_variance - long_run)


def arch_cross_check(prices: np.ndarray, horizon: int) -> dict:
    """Independent fit with the `arch` package on the same demeaned returns.

    `arch` backcasts the pre-sample variance and includes the t = 0 term, so its
    estimates differ slightly from the backend convention; it is a sanity check,
    not the tolerance target.
    """
    resid = demeaned_log_returns(prices)
    model = arch_model(resid * 100, mean="Zero", vol="GARCH", p=1, q=1, dist="normal", rescale=False)
    res = model.fit(disp="off", backcast=float(np.mean((resid * 100) ** 2)))
    fc = res.forecast(horizon=horizon, reindex=False).variance.to_numpy()[-1] / 1e4
    return {
        "omega": float(res.params["omega"] / 1e4),
        "alpha": float(res.params["alpha[1]"]),
        "beta": float(res.params["beta[1]"]),
        "stdErrors": {
            "omega": float(res.std_err["omega"] / 1e4),
            "alpha": float(res.std_err["alpha[1]"]),
            "beta": float(res.std_err["beta[1]"]),
        },
        "forecastVariance": [float(v) for v in fc],
    }
