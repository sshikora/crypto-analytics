import { chiSquareSurvival, normalQuantile } from './distributions';
import { Garch11Fit } from './garch';
import { mean } from './returns';

// Diagnostics for a fitted GARCH(1,1), matching validation/cql_validation/garch_diagnostics.py

// Mean, omega, alpha and beta: the mean is estimated by demeaning before the fit
const GARCH_PARAMETERS = 4;

export interface TestResult {
  statistic: number;
  pValue: number;
}

// z[t] = e[t] / sqrt(h[t]) for t = 1..n-1, the terms in the likelihood
export function standardizedResiduals(returns: number[], fit: Garch11Fit): number[] {
  const mu = mean(returns);
  return fit.variance.map((h, i) => (returns[i + 1] - mu) / Math.sqrt(h));
}

export function informationCriteria(logLikelihood: number, observations: number): { aic: number; bic: number } {
  return {
    aic: 2 * GARCH_PARAMETERS - 2 * logLikelihood,
    bic: GARCH_PARAMETERS * Math.log(observations) - 2 * logLikelihood,
  };
}

// Q = n(n + 2) * sum of rho_k^2 / (n - k) for k = 1..lags, chi-square with `lags` degrees of freedom.
// Autocorrelations use the overall mean and variance, as statsmodels' acf does.
export function ljungBox(x: number[], lags: number): TestResult {
  const n = x.length;
  const mu = mean(x);
  const d = x.map(v => v - mu);
  const variance = d.reduce((s, v) => s + v * v, 0);

  let sum = 0;
  for (let k = 1; k <= lags; k++) {
    let covariance = 0;
    for (let t = k; t < n; t++) covariance += d[t] * d[t - k];
    sum += (covariance / variance) ** 2 / (n - k);
  }

  const statistic = n * (n + 2) * sum;
  return { statistic, pValue: chiSquareSurvival(statistic, lags) };
}

// Sorted values against normal quantiles at (i - 0.5) / n
export function normalQqPoints(x: number[]): { theoretical: number; sample: number }[] {
  const sorted = x.slice().sort((a, b) => a - b);
  return sorted.map((sample, i) => ({ theoretical: normalQuantile((i + 0.5) / sorted.length), sample }));
}
