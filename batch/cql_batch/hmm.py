"""Gaussian hidden Markov model of daily log returns, fitted by expectation-maximization.

Each day's return is drawn from one of k normal distributions, and the state follows a first-order Markov chain.
States are numbered by variance, so state 0 is always the calmest and labels stay comparable between refits.

References: Hamilton (1989), Rabiner (1989).
"""

from dataclasses import dataclass

import numpy as np

# A normal likelihood grows without bound as a state's variance shrinks onto a few identical returns. The floor rules
# out those solutions, and scaling it to the sample keeps the same rule for a stablecoin and a small-cap coin.
VARIANCE_FLOOR = 1e-3


@dataclass
class HmmFit:
    initial: np.ndarray
    transition: np.ndarray
    means: np.ndarray
    variances: np.ndarray
    log_likelihood: float
    iterations: int
    converged: bool
    # P(state | returns up to and including that day), which is what could have been known at the time
    filtered: np.ndarray
    # P(state | all returns), which uses later data
    smoothed: np.ndarray

    @property
    def parameter_count(self) -> int:
        k = len(self.means)
        return 2 * k + k * (k - 1) + (k - 1)

    def aic(self) -> float:
        return 2 * self.parameter_count - 2 * self.log_likelihood

    def bic(self, observations: int) -> float:
        return self.parameter_count * np.log(observations) - 2 * self.log_likelihood


def log_densities(returns: np.ndarray, means: np.ndarray, variances: np.ndarray) -> np.ndarray:
    residuals = returns[:, None] - means
    return -0.5 * (np.log(2 * np.pi * variances) + residuals**2 / variances)


def forward_backward(
    log_b: np.ndarray, initial: np.ndarray, transition: np.ndarray
) -> tuple[float, np.ndarray, np.ndarray, np.ndarray]:
    """Scaled forward-backward recursions. Returns the log-likelihood, filtered and smoothed state probabilities, and
    the expected count of each transition."""
    n, k = log_b.shape
    # Shifting each day's densities by their largest keeps a far-tail day, unlikely in every state, from underflowing
    shift = log_b.max(axis=1)
    b = np.exp(log_b - shift[:, None])

    alpha = np.empty((n, k))
    scale = np.empty(n)
    predicted = initial
    for t in range(n):
        joint = predicted * b[t]
        scale[t] = joint.sum()
        alpha[t] = joint / scale[t]
        predicted = alpha[t] @ transition

    beta = np.ones((n, k))
    for t in range(n - 2, -1, -1):
        beta[t] = transition @ (b[t + 1] * beta[t + 1]) / scale[t + 1]

    gamma = alpha * beta
    gamma /= gamma.sum(axis=1, keepdims=True)

    ahead = b[1:] * beta[1:] / scale[1:, None]
    transitions = transition * (alpha[:-1].T @ ahead)

    return float(np.log(scale).sum() + shift.sum()), alpha, gamma, transitions


def _maximize(
    returns: np.ndarray, gamma: np.ndarray, transitions: np.ndarray, floor: float
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    weights = gamma.sum(axis=0)
    means = gamma.T @ returns / weights
    variances = (gamma * (returns[:, None] - means) ** 2).sum(axis=0) / weights
    return (
        gamma[0],
        transitions / transitions.sum(axis=1, keepdims=True),
        means,
        np.maximum(variances, floor),
    )


def expectation_maximization(
    returns: np.ndarray,
    initial: np.ndarray,
    transition: np.ndarray,
    means: np.ndarray,
    variances: np.ndarray,
    max_iterations: int = 1000,
    tolerance: float = 1e-8,
    floor: float = 0.0,
) -> HmmFit:
    """Baum-Welch from the given starting values. Stops when an iteration gains less than `tolerance` in
    log-likelihood. The reported likelihood and probabilities belong to the returned parameters."""
    previous = -np.inf
    converged = False
    iteration = 0
    for iteration in range(1, max_iterations + 1):
        log_likelihood, _, gamma, transitions = forward_backward(log_densities(returns, means, variances), initial, transition)
        if log_likelihood - previous < tolerance:
            converged = True
            break
        previous = log_likelihood
        initial, transition, means, variances = _maximize(returns, gamma, transitions, floor)

    log_likelihood, filtered, smoothed, _ = forward_backward(log_densities(returns, means, variances), initial, transition)
    return HmmFit(initial, transition, means, variances, log_likelihood, iteration, converged, filtered, smoothed)


def _starting_values(returns: np.ndarray, k: int, rng: np.random.Generator, start: int) -> tuple[np.ndarray, ...]:
    # The first start splits days by size of move, which finds a calm and a turbulent state in nearly every series.
    # The rest assign days to states at random so that other local maxima get a chance.
    n = len(returns)
    if start == 0:
        ranks = np.argsort(np.argsort(np.abs(returns - returns.mean())))
        states = ranks * k // n
    else:
        states = rng.integers(0, k, n)

    gamma = np.full((n, k), 0.1 / k)
    gamma[np.arange(n), states] += 0.9
    weights = gamma.sum(axis=0)
    means = gamma.T @ returns / weights
    variances = (gamma * (returns[:, None] - means) ** 2).sum(axis=0) / weights
    transition = np.full((k, k), 0.1 / (k - 1)) + np.eye(k) * (0.9 - 0.1 / (k - 1))
    return np.full(k, 1 / k), transition, means, variances


def _sort_by_variance(fit: HmmFit) -> HmmFit:
    order = np.argsort(fit.variances)
    return HmmFit(
        fit.initial[order],
        fit.transition[np.ix_(order, order)],
        fit.means[order],
        fit.variances[order],
        fit.log_likelihood,
        fit.iterations,
        fit.converged,
        fit.filtered[:, order],
        fit.smoothed[:, order],
    )


def fit_hmm(returns: np.ndarray, k: int = 2, starts: int = 10, seed: int = 0) -> HmmFit:
    """Keeps the highest likelihood over `starts` restarts. The seed is fixed so that a rerun gives the same numbers."""
    rng = np.random.default_rng(seed)
    floor = VARIANCE_FLOOR * float(returns.var(ddof=1))
    best = None
    for start in range(starts):
        fit = expectation_maximization(returns, *_starting_values(returns, k, rng, start), floor=floor)
        if best is None or fit.log_likelihood > best.log_likelihood:
            best = fit
    return _sort_by_variance(best)


def expected_duration(transition: np.ndarray) -> np.ndarray:
    """Expected days in each state once entered: a geometric distribution with stay probability a_ii."""
    return 1 / (1 - np.diag(transition))


def stationary_distribution(transition: np.ndarray) -> np.ndarray:
    k = len(transition)
    equations = np.vstack([transition.T - np.eye(k), np.ones(k)])
    return np.linalg.lstsq(equations, np.r_[np.zeros(k), 1.0], rcond=None)[0]
