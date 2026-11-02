"""The HMM against three independent checks: enumerating every state path, hmmlearn's EM, and statsmodels' direct
maximum likelihood."""

import itertools
from pathlib import Path

import numpy as np
import pandas as pd
import pytest
import statsmodels.api as sm
from hmmlearn.hmm import GaussianHMM

from cql_batch import hmm

DATA = Path(__file__).resolve().parents[2] / "validation" / "data"


def log_returns(coin: str) -> np.ndarray:
    prices = pd.read_csv(DATA / f"{coin}_usd_daily.csv")["price_usd"].to_numpy()
    return np.diff(np.log(prices))


@pytest.fixture(params=["bitcoin", "ethereum"])
def returns(request) -> np.ndarray:
    return log_returns(request.param)


@pytest.fixture(scope="session")
def fitted():
    """Fits each series once, since a fit runs ten restarts."""
    cache = {}

    def fit(returns: np.ndarray) -> hmm.HmmFit:
        key = returns.tobytes()
        if key not in cache:
            cache[key] = hmm.fit_hmm(returns)
        return cache[key]

    return fit


def small_model():
    initial = np.array([0.5, 0.3, 0.2])
    transition = np.array([[0.8, 0.15, 0.05], [0.1, 0.7, 0.2], [0.25, 0.25, 0.5]])
    means = np.array([0.01, -0.02, 0.0])
    variances = np.array([0.0004, 0.0025, 0.01])
    returns = np.array([0.012, -0.03, 0.2, -0.004, 0.05, 0.0, -0.09, 0.015])
    return returns, initial, transition, means, variances


def enumerate_paths(returns, initial, transition, means, variances):
    """Sums over all k^n state paths, the definition the forward-backward recursions shortcut."""
    log_b = hmm.log_densities(returns, means, variances)
    n, k = log_b.shape
    total = 0.0
    state_mass = np.zeros((n, k))
    pair_mass = np.zeros((k, k))
    prefix_mass = np.zeros((n, k))
    for path in itertools.product(range(k), repeat=n):
        p = initial[path[0]] * np.exp(log_b[0, path[0]])
        prefix_mass[0, path[0]] += p if path[1:] == (0,) * (n - 1) else 0
        for t in range(1, n):
            p *= transition[path[t - 1], path[t]] * np.exp(log_b[t, path[t]])
            if path[t + 1 :] == (0,) * (n - t - 1):
                prefix_mass[t, path[t]] += p
        total += p
        state_mass[np.arange(n), path] += p
        for t in range(n - 1):
            pair_mass[path[t], path[t + 1]] += p
    filtered = prefix_mass / prefix_mass.sum(axis=1, keepdims=True)
    return np.log(total), filtered, state_mass / total, pair_mass / total


def test_recursions_match_enumerating_every_path():
    returns, initial, transition, means, variances = small_model()
    log_likelihood, filtered, smoothed, transitions = hmm.forward_backward(
        hmm.log_densities(returns, means, variances), initial, transition
    )
    expected = enumerate_paths(returns, initial, transition, means, variances)
    assert log_likelihood == pytest.approx(expected[0], abs=1e-12)
    np.testing.assert_allclose(filtered, expected[1], atol=1e-12)
    np.testing.assert_allclose(smoothed, expected[2], atol=1e-12)
    np.testing.assert_allclose(transitions, expected[3], atol=1e-12)


def test_last_filtered_equals_last_smoothed(returns, fitted):
    fit = fitted(returns)
    np.testing.assert_allclose(fit.filtered[-1], fit.smoothed[-1], atol=1e-12)


def test_a_far_tail_day_does_not_underflow():
    returns = np.r_[np.zeros(20) + 1e-3, 5.0, np.zeros(20) - 1e-3]
    log_likelihood, filtered, _, _ = hmm.forward_backward(
        hmm.log_densities(returns, np.zeros(2), np.array([1e-6, 1e-5])), np.array([0.5, 0.5]), np.full((2, 2), 0.5)
    )
    assert np.isfinite(log_likelihood)
    assert np.isfinite(filtered).all()


def test_every_em_iteration_raises_the_likelihood(returns):
    start = (np.array([0.5, 0.5]), np.array([[0.9, 0.1], [0.1, 0.9]]), np.array([0.0, 0.0]), returns.var() * np.array([0.5, 2.0]))
    previous = -np.inf
    state = start
    for _ in range(50):
        fit = hmm.expectation_maximization(returns, *state, max_iterations=1, tolerance=-np.inf)
        assert fit.log_likelihood >= previous - 1e-9
        previous = fit.log_likelihood
        state = (fit.initial, fit.transition, fit.means, fit.variances)


def test_em_iterates_match_hmmlearn(returns):
    initial = np.array([0.6, 0.4])
    transition = np.array([[0.9, 0.1], [0.2, 0.8]])
    means = np.array([0.001, -0.002])
    variances = returns.var() * np.array([0.5, 2.0])

    for iterations in [1, 5, 50]:
        ours = hmm.expectation_maximization(
            returns, initial, transition, means, variances, max_iterations=iterations, tolerance=-np.inf
        )
        theirs = GaussianHMM(
            n_components=2,
            covariance_type="diag",
            n_iter=iterations,
            tol=0,
            init_params="",
            params="stmc",
            covars_prior=0,
            covars_weight=1,
            min_covar=0,
            implementation="scaling",
        )
        theirs.startprob_ = initial
        theirs.transmat_ = transition
        theirs.means_ = means[:, None]
        theirs.covars_ = variances[:, None]
        theirs.fit(returns[:, None])

        np.testing.assert_allclose(ours.initial, theirs.startprob_, atol=1e-9)
        np.testing.assert_allclose(ours.transition, theirs.transmat_, atol=1e-9)
        np.testing.assert_allclose(ours.means, theirs.means_[:, 0], atol=1e-9)
        np.testing.assert_allclose(ours.variances, theirs.covars_[:, 0, 0], atol=1e-9)
        assert ours.log_likelihood == pytest.approx(theirs.score(returns[:, None]), abs=1e-8)


def test_likelihood_matches_statsmodels_at_the_same_parameters(returns, fitted):
    # statsmodels applies initial probabilities a day before the first return, so the two only line up from the
    # stationary distribution, which that extra step leaves unchanged
    fit = fitted(returns)
    params = np.r_[fit.transition[0, 0], fit.transition[1, 0], fit.means, fit.variances]
    stationary = hmm.stationary_distribution(fit.transition)
    ours = hmm.forward_backward(hmm.log_densities(returns, fit.means, fit.variances), stationary, fit.transition)[0]

    model = sm.tsa.MarkovRegression(returns, k_regimes=2, trend="c", switching_variance=True)
    model.initialize_steady_state()

    assert ours == pytest.approx(model.loglike(params), abs=1e-9)


def test_statsmodels_restarts_find_nothing_higher(returns, fitted):
    fit = fitted(returns)
    model = sm.tsa.MarkovRegression(returns, k_regimes=2, trend="c", switching_variance=True)
    model.initialize_steady_state()
    result = model.fit(search_reps=20, search_iter=20, disp=False)

    # Estimating the initial state as well can only add to the likelihood, and it adds little
    assert result.llf <= fit.log_likelihood + 1e-6
    assert fit.log_likelihood - result.llf < 1


def test_states_are_numbered_by_variance_with_a_reproducible_fit(returns, fitted):
    first = fitted(returns)
    second = hmm.fit_hmm(returns)
    assert first.variances[0] < first.variances[1]
    assert first.log_likelihood == second.log_likelihood
    np.testing.assert_array_equal(first.filtered, second.filtered)


def test_recovers_known_parameters_from_a_long_simulation():
    rng = np.random.default_rng(1)
    transition = np.array([[0.97, 0.03], [0.1, 0.9]])
    means = np.array([0.002, -0.004])
    sds = np.array([0.015, 0.06])
    states = [0]
    for _ in range(4_999):
        states.append(rng.choice(2, p=transition[states[-1]]))
    states = np.array(states)
    returns = means[states] + sds[states] * rng.standard_normal(len(states))

    fit = hmm.fit_hmm(returns, starts=2)

    np.testing.assert_allclose(fit.transition, transition, atol=0.02)
    np.testing.assert_allclose(fit.means, means, atol=0.004)
    np.testing.assert_allclose(np.sqrt(fit.variances), sds, atol=0.004)
    assert (fit.smoothed.argmax(axis=1) == states).mean() > 0.95


def test_the_floor_stops_a_state_collapsing_on_identical_returns():
    returns = np.r_[np.zeros(100), np.random.default_rng(2).normal(0, 0.02, 100)]
    fit = hmm.fit_hmm(returns, starts=5)
    assert np.isfinite(fit.log_likelihood)
    assert fit.variances[0] >= hmm.VARIANCE_FLOOR * returns.var(ddof=1)


def test_duration_and_stationary_distribution():
    transition = np.array([[0.9, 0.1], [0.3, 0.7]])
    np.testing.assert_allclose(hmm.expected_duration(transition), [10.0, 1 / 0.3])
    np.testing.assert_allclose(hmm.stationary_distribution(transition), [0.75, 0.25], atol=1e-12)


def test_criteria_count_seven_parameters_for_two_states(returns, fitted):
    fit = fitted(returns)
    assert fit.parameter_count == 7
    assert fit.bic(len(returns)) == pytest.approx(7 * np.log(len(returns)) - 2 * fit.log_likelihood)
    assert hmm.fit_hmm(returns, k=3, starts=2).parameter_count == 14
