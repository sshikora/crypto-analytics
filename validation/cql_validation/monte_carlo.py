"""Reference Monte Carlo paths matching backend/src/models/random.ts and backend/src/models/monteCarlo.ts.

Conventions, chosen so the backend reproduces these paths draw for draw:
- Uniforms come from numpy's SFC64 bit generator. A seed s sets the state to a = b = c = s with counter 1 and
  discards 12 outputs, the seeding of the generator's author. A uniform is (x >> 11) * 2^-53, numpy's
  Generator.random(), so it lies in [0, 1).
- Normals by Box-Muller: u1 = 1 - U, u2 = U, z1 = sqrt(-2 log u1) cos(2 pi u2), and the matching sine value is kept
  for the next call.
- Gamma(shape >= 1) by Marsaglia and Tsang (2000), with its squeeze, using 1 - U as the uniform.
- Student-t: t = z sqrt(dof / (2 g)) with z drawn first and g ~ Gamma(dof / 2), so 2g is chi-square with dof degrees
  of freedom.
- Paths are cumulative daily log returns, drawn path by path: every day of the first path, then the next.
- Antithetic paths come in pairs that share draws. The second path uses -z for the normal model, -t with the same
  gamma for the Student-t model, and residual n - 1 - k for the bootstrap, whose residuals are sorted ascending.
- GARCH bootstrap: k = floor(U n) picks a standardized residual z; with h_1 the one-step-ahead variance,
  r_t = mu + sqrt(h_t) z_t and h_{t+1} = omega + alpha (r_t - mu)^2 + beta h_t.
"""

import math
from dataclasses import dataclass

import numpy as np

from . import garch, var

DISCARDED_OUTPUTS = 12


class Stream:
    def __init__(self, seed: int):
        self.bits = np.random.SFC64()
        state = self.bits.state
        state["state"]["state"] = np.array([seed, seed, seed, 1], dtype=np.uint64)
        state["has_uint32"] = 0
        state["uinteger"] = 0
        self.bits.state = state
        self.bits.random_raw(DISCARDED_OUTPUTS)
        self.generator = np.random.Generator(self.bits)
        self.spare: float | None = None

    def raw(self) -> int:
        return int(self.bits.random_raw())

    def uniform(self) -> float:
        return float(self.generator.random())

    def normal(self) -> float:
        if self.spare is not None:
            z, self.spare = self.spare, None
            return z
        radius = math.sqrt(-2 * math.log(1 - self.uniform()))
        angle = 2 * math.pi * self.uniform()
        self.spare = radius * math.sin(angle)
        return radius * math.cos(angle)

    def gamma(self, shape: float) -> float:
        d = shape - 1 / 3
        c = 1 / math.sqrt(9 * d)
        while True:
            x = self.normal()
            v = 1 + c * x
            while v <= 0:
                x = self.normal()
                v = 1 + c * x
            # Products rather than ** so both languages round identically
            v = v * v * v
            u = 1 - self.uniform()
            if u < 1 - 0.0331 * x * x * x * x:
                return d * v
            if math.log(u) < 0.5 * x * x + d * (1 - v + math.log(v)):
                return d * v


@dataclass
class Gbm:
    mu: float
    sigma: float


@dataclass
class StudentT:
    location: float
    scale: float
    dof: float


@dataclass
class GarchBootstrap:
    mu: float
    omega: float
    alpha: float
    beta: float
    next_variance: float
    residuals: np.ndarray


def gbm(r: np.ndarray) -> Gbm:
    return Gbm(mu=float(r.mean()), sigma=float(r.std(ddof=1)))


def student_t(r: np.ndarray) -> StudentT:
    f = var.fit_student_t(r)
    return StudentT(location=f.location, scale=f.scale, dof=f.dof)


def garch_bootstrap(r: np.ndarray) -> GarchBootstrap:
    f = garch.fit_log_returns(r)
    resid = r - r.mean()
    return GarchBootstrap(
        mu=float(r.mean()),
        omega=f.omega,
        alpha=f.alpha,
        beta=f.beta,
        next_variance=f.next_variance,
        residuals=resid[1:] / np.sqrt(f.variance),
    )


def simulate(model, paths: int, days: int, seed: int, antithetic: bool = False) -> np.ndarray:
    """Cumulative log returns, shape (paths, days)."""
    stream = Stream(seed)
    out = np.empty((paths, days))
    width = 2 if antithetic else 1
    if isinstance(model, GarchBootstrap):
        z_sorted = np.sort(model.residuals)
        n = len(z_sorted)

    for first in range(0, paths, width):
        total = np.zeros(width)
        if isinstance(model, GarchBootstrap):
            h = np.full(width, model.next_variance)
        for day in range(days):
            if isinstance(model, Gbm):
                z = stream.normal()
                shocks = model.mu + model.sigma * np.array([z, -z][:width])
            elif isinstance(model, StudentT):
                z = stream.normal()
                t = z * math.sqrt(model.dof / (2 * stream.gamma(model.dof / 2)))
                shocks = model.location + model.scale * np.array([t, -t][:width])
            else:
                k = math.floor(stream.uniform() * n)
                e = np.sqrt(h) * z_sorted[[k, n - 1 - k][:width]]
                shocks = model.mu + e
                h = model.omega + model.alpha * e**2 + model.beta * h
            total = total + shocks
            out[first : first + width, day] = total
    return out


def simulate_horizon(model, paths: int, days: int, rng: np.random.Generator) -> np.ndarray:
    """Each path's total log return over `days`, drawn with numpy's own generators. The same models as `simulate`,
    vectorized across paths for studies too large for the draw-for-draw reference."""
    if isinstance(model, Gbm):
        return model.mu * days + model.sigma * rng.standard_normal((paths, days)).sum(axis=1)
    if isinstance(model, StudentT):
        return model.location * days + model.scale * rng.standard_t(model.dof, (paths, days)).sum(axis=1)
    total = np.zeros(paths)
    h = np.full(paths, model.next_variance)
    for _ in range(days):
        e = np.sqrt(h) * rng.choice(model.residuals, paths)
        total += model.mu + e
        h = model.omega + model.alpha * e**2 + model.beta * h
    return total


def summarize(log_paths: np.ndarray, antithetic: bool, quantiles, alpha: float, thresholds) -> dict:
    """Fan quantiles of the price relative each day, the horizon's simple return and the chance of each drawdown."""
    prices = np.exp(log_paths)
    terminal = prices[:, -1] - 1
    independent = terminal.reshape(-1, 2).mean(axis=1) if antithetic else terminal
    value_at_risk, expected_shortfall = var.historical(terminal, alpha)
    peaks = np.maximum(np.maximum.accumulate(prices, axis=1), 1.0)
    max_drawdown = (1 - prices / peaks).max(axis=1)
    return {
        "fan": np.quantile(prices, quantiles, axis=0).T.tolist(),
        "mean": float(terminal.mean()),
        "standardError": float(independent.std(ddof=1) / np.sqrt(len(independent))),
        "valueAtRisk": value_at_risk,
        "expectedShortfall": expected_shortfall,
        "drawdownProbabilities": [float((max_drawdown >= t).mean()) for t in thresholds],
    }
