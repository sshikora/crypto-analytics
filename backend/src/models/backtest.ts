import { Random } from './random';
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

export interface RoundTrip {
  start: number;
  end: number;
  return: number;
  open: boolean;
}

// A round trip runs from the day a position is opened to the day it is closed, both included, so it pays to buy
// and to sell. net[i] is the net return of holding positions[i]. A trade still open at the end has paid only to buy.
export function roundTrips(positions: number[], net: number[]): RoundTrip[] {
  const trips: RoundTrip[] = [];
  let i = 0;
  while (i < net.length) {
    if (positions[i] > 0 && (i === 0 || positions[i - 1] === 0)) {
      let j = i + 1;
      while (j < net.length && positions[j] > 0) j++;
      const closed = j < net.length;
      const end = closed ? j : net.length - 1;
      let growth = 1;
      for (let k = i; k <= end; k++) growth *= 1 + net[k];
      trips.push({ start: i, end, return: growth - 1, open: !closed });
      i = end + 1;
    } else {
      i++;
    }
  }
  return trips;
}

// The same daily log returns in random order (Fisher-Yates), rebuilt into prices from the same start. The trend
// and the distribution of daily moves survive; any order a signal could time does not.
export function shuffledPrices(prices: number[], random: Random): number[] {
  const r = prices.slice(1).map((p, i) => Math.log(p / prices[i]));
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(random.uniform() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  const out = [prices[0]];
  let total = 0;
  for (const x of r) {
    total += x;
    out.push(prices[0] * Math.exp(total));
  }
  return out;
}
