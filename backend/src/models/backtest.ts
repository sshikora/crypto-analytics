import { periodSharpe } from './sharpeInference';

// Signal backtests with trading costs and walk-forward selection, matching validation/cql_validation/backtest.py.

export interface WalkForwardOptions {
  // First return index any fold trains on, so every variant's signal exists
  start: number;
  train: number;
  test: number;
  // Fraction of the value traded, fee plus slippage
  cost: number;
}

export interface WalkForward {
  // Variant held in each fold's test days
  chosen: number[];
  positions: number[];
  // Net returns over the test days, from close start + train onwards
  returns: number[];
}

// Trades happen at the close, and the cost is charged in the period the new position is first held:
// net[t] = positions[t] * R[t + 1] - cost * |positions[t] - positions[t - 1]|, starting flat
export function strategyReturns(prices: number[], positions: number[], cost: number): number[] {
  const net: number[] = [];
  let previous = 0;
  for (let t = 0; t + 1 < prices.length; t++) {
    net.push(positions[t] * (prices[t + 1] / prices[t] - 1) - cost * Math.abs(positions[t] - previous));
    previous = positions[t];
  }
  return net;
}

// Each fold holds the variant with the highest Sharpe ratio over the training days before it (the first on ties).
// The test positions are costed as one strategy, so switching variants between folds pays for the trade.
export function walkForward(prices: number[], variants: number[][], options: WalkForwardOptions): WalkForward {
  const { start, train, test, cost } = options;
  const net = variants.map(p => strategyReturns(prices, p, cost));
  const end = prices.length - 1;
  const chosen: number[] = [];
  const positions: number[] = [];
  for (let a = start; a + train < end; a += test) {
    const scores = net.map(n => periodSharpe(n.slice(a, a + train)));
    const best = scores.indexOf(Math.max(...scores));
    chosen.push(best);
    positions.push(...variants[best].slice(a + train, Math.min(a + train + test, end)));
  }
  const first = start + train;
  const window = prices.slice(first, first + positions.length + 1);
  return { chosen, positions, returns: strategyReturns(window, positions, cost) };
}
