import { mean } from './returns';

// Per-period close-to-close volatility: the sample standard deviation of the last `window` returns.
// Positions before the first full window are null.
export function rollingVolatility(returns: number[], window: number): (number | null)[] {
  return returns.map((_, t) => {
    if (t < window - 1) return null;
    const slice = returns.slice(t - window + 1, t + 1);
    const mu = mean(slice);
    const ss = slice.reduce((s, r) => s + (r - mu) ** 2, 0);
    return Math.sqrt(ss / (window - 1));
  });
}

// RiskMetrics EWMA variance with zero mean, normalised by the weights so early estimates need no seed:
// sum(decay^i * r[t-i]^2) / sum(decay^i)
export function ewmaVariance(returns: number[], decay = 0.94): number[] {
  let weightedSum = 0;
  let weightTotal = 0;
  return returns.map(r => {
    weightedSum = r * r + decay * weightedSum;
    weightTotal = 1 + decay * weightTotal;
    return weightedSum / weightTotal;
  });
}
