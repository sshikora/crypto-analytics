import { normalCdf, normalQuantile } from './distributions';
import { mean } from './returns';

// Probabilistic and deflated Sharpe ratios (Bailey and López de Prado 2012, 2014), matching
// validation/cql_validation/backtest.py. Sharpe ratios here are per period, not annualized.

const EULER_GAMMA = 0.5772156649015329;

// A series with no variation, such as a strategy that stayed flat, has a Sharpe ratio of 0
export function periodSharpe(returns: number[]): number {
  const mu = mean(returns);
  const sd = Math.sqrt(returns.reduce((s, r) => s + (r - mu) ** 2, 0) / (returns.length - 1));
  return sd === 0 ? 0 : mu / sd;
}

// Probability that the true Sharpe ratio exceeds the benchmark, allowing for skewness and fat tails. Skewness and
// kurtosis are population moments; kurtosis is not excess.
export function probabilisticSharpe(returns: number[], benchmark: number): number {
  const n = returns.length;
  const sr = periodSharpe(returns);
  const mu = mean(returns);
  let m2 = 0;
  let m3 = 0;
  let m4 = 0;
  for (const r of returns) {
    const d = r - mu;
    m2 += d * d;
    m3 += d * d * d;
    m4 += d * d * d * d;
  }
  m2 /= n;
  const skew = m3 / n / m2 ** 1.5;
  const kurt = m4 / n / m2 ** 2;
  return normalCdf(((sr - benchmark) * Math.sqrt(n - 1)) / Math.sqrt(1 - skew * sr + ((kurt - 1) / 4) * sr * sr));
}

// The Sharpe ratio expected from the best of `trials` independent strategies with no skill whose Sharpe ratios have
// this variance. One trial involves no selection. The approximation is asymptotic and turns negative for trials just
// above 1, where the true expected maximum is still at least 0, so it is floored at 0.
export function expectedMaximumSharpe(trials: number, variance: number): number {
  if (trials <= 1) return 0;
  const approximation =
    Math.sqrt(variance) *
    ((1 - EULER_GAMMA) * normalQuantile(1 - 1 / trials) + EULER_GAMMA * normalQuantile(1 - 1 / (trials * Math.E)));
  return Math.max(0, approximation);
}

// Correlated trials count as fewer independent ones: rho + (1 - rho) M for M trials whose returns have average
// pairwise correlation rho (Bailey and López de Prado 2014, Appendix A.3). Every series must vary.
export function impliedTrials(trialReturns: number[][]): number {
  const m = trialReturns.length;
  const standardized = trialReturns.map(r => {
    const mu = mean(r);
    const sd = Math.sqrt(r.reduce((s, x) => s + (x - mu) ** 2, 0));
    return r.map(x => (x - mu) / sd);
  });
  let total = 0;
  for (let i = 0; i < m; i++) {
    for (let j = i + 1; j < m; j++) {
      total += standardized[i].reduce((s, x, t) => s + x * standardized[j][t], 0);
    }
  }
  const rho = (2 * total) / (m * (m - 1));
  return rho + (1 - rho) * m;
}

// PSR against the best Sharpe ratio expected by chance from the variants tried, counted as `trials` independent ones
export function deflatedSharpe(returns: number[], trialSharpes: number[], trials = trialSharpes.length): number {
  const n = trialSharpes.length;
  const mu = mean(trialSharpes);
  const variance = n > 1 ? trialSharpes.reduce((s, x) => s + (x - mu) ** 2, 0) / (n - 1) : 0;
  return probabilisticSharpe(returns, expectedMaximumSharpe(trials, variance));
}
