// Trading signals as positions on daily closes, matching validation/cql_validation/backtest.py.
// positions[t] is the fraction of capital held from close t to close t + 1, decided from closes up to t.

export function movingAverage(prices: number[], period: number): number[] {
  return prices.map((_, i) => {
    if (i < period - 1) return NaN;
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += prices[j];
    return sum / period;
  });
}

// Long while the short average is above the long one, flat otherwise and before the long average exists. A short
// period of 1 compares the price with its average.
export function crossoverPositions(prices: number[], short: number, long: number): number[] {
  const fast = movingAverage(prices, short);
  const slow = movingAverage(prices, long);
  return prices.map((_, i) => (fast[i] > slow[i] ? 1 : 0));
}
