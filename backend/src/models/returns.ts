const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

export interface Moments {
  mean: number;
  standardDeviation: number;
  skewness: number;
  excessKurtosis: number;
}

// returns[i] is the change from prices[i] to prices[i + 1]
export function logReturns(prices: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    returns.push(Math.log(prices[i] / prices[i - 1]));
  }
  return returns;
}

export function simpleReturns(prices: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    returns.push(prices[i] / prices[i - 1] - 1);
  }
  return returns;
}

// Annualization uses the average spacing of the observations
export function periodsPerYear(timestamps: number[]): number {
  const avgPeriodMs = (timestamps[timestamps.length - 1] - timestamps[0]) / (timestamps.length - 1);
  return MS_PER_YEAR / avgPeriodMs;
}

export function mean(x: number[]): number {
  return x.reduce((s, v) => s + v, 0) / x.length;
}

// Sample standard deviation and the bias-adjusted skewness (G1) and excess kurtosis (G2), as in pandas and scipy
export function moments(x: number[]): Moments {
  const n = x.length;
  if (n < 4) {
    throw new Error('At least 4 observations are required for sample moments');
  }

  const mu = mean(x);
  let s2 = 0;
  let s3 = 0;
  let s4 = 0;
  for (const v of x) {
    const d = v - mu;
    s2 += d * d;
    s3 += d * d * d;
    s4 += d * d * d * d;
  }

  const m2 = s2 / n;
  const g1 = s3 / n / m2 ** 1.5;
  const g2 = s4 / n / m2 ** 2 - 3;

  return {
    mean: mu,
    standardDeviation: Math.sqrt(s2 / (n - 1)),
    skewness: (g1 * Math.sqrt(n * (n - 1))) / (n - 2),
    excessKurtosis: (((n + 1) * g2 + 6) * (n - 1)) / ((n - 2) * (n - 3)),
  };
}
