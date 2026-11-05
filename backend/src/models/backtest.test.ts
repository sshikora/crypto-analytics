import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { roundTrips, shuffledPrices, strategyReturns, walkForward } from './backtest';
import { Random } from './random';
import { simpleReturns } from './returns';
import { deflatedSharpe, expectedMaximumSharpe, impliedTrials, periodSharpe, probabilisticSharpe } from './sharpeInference';
import { crossoverPositions, movingAverage } from './signals';

interface BacktestFixture {
  prices: number[];
  cost: number;
  variants: { short: number; long: number; positions: number[]; returns: number[] }[];
  start: number;
  sharpe: number[];
  best: number;
  probabilisticSharpe: number;
  expectedMaximumSharpe: number;
  deflatedSharpe: number;
  impliedTrials: number;
  deflatedSharpeImplied: number;
  walkForward: {
    train: number;
    test: number;
    chosen: number[];
    positions: number[];
    returns: number[];
    roundTrips: { start: number; end: number; ret: number; open: boolean }[];
  };
}

const fixture = JSON.parse(
  readFileSync(join(__dirname, '..', 'test', 'fixtures', 'backtest', 'btc_crossovers.json'), 'utf8'),
) as BacktestFixture;
const { prices, cost, variants, start } = fixture;

const largestGap = (a: number[], b: number[]) => Math.max(...a.map((x, i) => Math.abs(x - b[i])));
const relativeGap = (a: number, b: number) => Math.abs(a - b) / Math.abs(b);

describe('moving-average crossovers against the Python reference', () => {
  it('holds the same positions for every variant', () => {
    for (const v of variants) expect(crossoverPositions(prices, v.short, v.long)).toEqual(v.positions);
  });

  it('starts the moving average once a full window exists', () => {
    const sma = movingAverage(prices, 20);
    expect(sma.slice(0, 19).every(Number.isNaN)).toBe(true);
    expect(sma[19]).toBeCloseTo(prices.slice(0, 20).reduce((s, p) => s + p, 0) / 20, 6);
  });

  it('stays flat until the long average exists', () => {
    for (const v of variants) expect(v.positions.slice(0, v.long - 1).every(p => p === 0)).toBe(true);
  });
});

describe('costed strategy returns', () => {
  it('match the reference', () => {
    for (const v of variants) expect(largestGap(strategyReturns(prices, v.positions, cost), v.returns)).toBeLessThan(1e-15);
  });

  it('equal the coin returns when always long without costs', () => {
    expect(strategyReturns(prices, prices.map(() => 1), 0)).toEqual(simpleReturns(prices));
  });

  it('charge the cost once per unit traded', () => {
    const positions = [1, 1, 0, 0.5, 0.5];
    const flat = [100, 100, 100, 100, 100];
    expect(strategyReturns(flat, positions, 0.01)).toEqual([-0.01, 0, -0.01, -0.005]);
  });
});

describe('walk-forward selection', () => {
  const wf = walkForward(prices, variants.map(v => v.positions), {
    start,
    train: fixture.walkForward.train,
    test: fixture.walkForward.test,
    cost,
  });

  it('chooses the same variants and returns as the reference', () => {
    expect(wf.chosen).toEqual(fixture.walkForward.chosen);
    expect(wf.positions).toEqual(fixture.walkForward.positions);
    expect(largestGap(wf.returns, fixture.walkForward.returns)).toBeLessThan(1e-15);
  });

  it('chooses the best training Sharpe ratio in each fold', () => {
    const { train, test } = fixture.walkForward;
    wf.chosen.forEach((chosen, k) => {
      const a = start + k * test;
      const scores = variants.map(v => periodSharpe(v.returns.slice(a, a + train)));
      expect(scores[chosen]).toBe(Math.max(...scores));
    });
  });

  it('uses only returns after the first training window', () => {
    const { train } = fixture.walkForward;
    expect(wf.returns).toHaveLength(prices.length - 1 - start - train);
  });

  it('reproduces a single variant, apart from paying to enter', () => {
    const v = variants[0];
    const { train, test } = fixture.walkForward;
    const single = walkForward(prices, [v.positions], { start, train, test, cost });
    const first = start + train;
    const own = v.returns.slice(first);
    const entry = cost * Math.abs(v.positions[first] - v.positions[first - 1]) - cost * v.positions[first];
    expect(single.returns[0] - own[0]).toBeCloseTo(entry, 15);
    expect(largestGap(single.returns.slice(1), own.slice(1))).toBeLessThan(1e-15);
  });
});

describe('Sharpe ratio inference', () => {
  const evaluated = variants.map(v => v.returns.slice(start));
  const best = evaluated[fixture.best];

  it('matches the reference', () => {
    evaluated.forEach((r, i) => expect(relativeGap(periodSharpe(r), fixture.sharpe[i])).toBeLessThan(1e-12));
    expect(relativeGap(probabilisticSharpe(best, 0), fixture.probabilisticSharpe)).toBeLessThan(1e-12);
    const sharpes = evaluated.map(periodSharpe);
    const mu = sharpes.reduce((s, x) => s + x, 0) / sharpes.length;
    const variance = sharpes.reduce((s, x) => s + (x - mu) ** 2, 0) / (sharpes.length - 1);
    expect(relativeGap(expectedMaximumSharpe(sharpes.length, variance), fixture.expectedMaximumSharpe)).toBeLessThan(1e-12);
    expect(relativeGap(deflatedSharpe(best, sharpes), fixture.deflatedSharpe)).toBeLessThan(1e-12);
    const implied = impliedTrials(evaluated);
    expect(relativeGap(implied, fixture.impliedTrials)).toBeLessThan(1e-12);
    expect(relativeGap(deflatedSharpe(best, sharpes, implied), fixture.deflatedSharpeImplied)).toBeLessThan(1e-12);
  });

  it('counts identical trials as one and uncorrelated trials as all of them', () => {
    const a = [0.01, -0.01, 0.01, -0.01];
    const b = [0.01, 0.01, -0.01, -0.01];
    expect(impliedTrials([a, a, a])).toBeCloseTo(1, 14);
    expect(impliedTrials([a, b])).toBeCloseTo(2, 14);
  });

  it('never sets the bar below zero', () => {
    expect(expectedMaximumSharpe(1.05, 1)).toBe(0);
    expect(expectedMaximumSharpe(1, 1)).toBe(0);
  });

  it("matches the paper's expected maximum Sharpe ratio", () => {
    // Bailey and López de Prado (2014): 100 trials whose annualized Sharpe ratios have variance 1/2, 250 days a year
    expect(expectedMaximumSharpe(100, 0.5 / 250)).toBeCloseTo(0.1132, 4);
  });

  it('gives an even chance against its own Sharpe ratio', () => {
    expect(probabilisticSharpe(best, periodSharpe(best))).toBeCloseTo(0.5, 15);
  });

  it('does not deflate a single trial', () => {
    expect(deflatedSharpe(best, [periodSharpe(best)])).toBe(probabilisticSharpe(best, 0));
  });

  it('raises the bar as more variants are tried', () => {
    const bars = [2, 10, 100, 1000].map(n => expectedMaximumSharpe(n, 1));
    bars.slice(1).forEach((bar, i) => expect(bar).toBeGreaterThan(bars[i]));
    expect(deflatedSharpe(best, evaluated.map(periodSharpe))).toBeLessThan(probabilisticSharpe(best, 0));
  });
});

describe('round trips', () => {
  it('match the reference on the walk-forward positions', () => {
    const { positions, returns } = fixture.walkForward;
    const trips = roundTrips(positions, returns);
    expect(trips.map(t => [t.start, t.end, t.open])).toEqual(fixture.walkForward.roundTrips.map(t => [t.start, t.end, t.open]));
    trips.forEach((t, i) => expect(Math.abs(t.return - fixture.walkForward.roundTrips[i].ret)).toBeLessThan(1e-14));
  });

  it('pay to buy and to sell, and leave a final trade open', () => {
    const positions = [0, 1, 1, 0, 0, 1, 1];
    const net = [0, -0.01 + 0.1, 0.05, -0.01, 0, -0.01, 0.02];
    const trips = roundTrips(positions, net);
    expect(trips.map(t => [t.start, t.end, t.open])).toEqual([[1, 3, false], [5, 6, true]]);
    expect(trips[0].return).toBeCloseTo(1.09 * 1.05 * 0.99 - 1, 15);
    expect(trips[1].return).toBeCloseTo(0.99 * 1.02 - 1, 15);
  });
});

describe('shuffled prices', () => {
  const shuffled = shuffledPrices(prices, new Random(7));

  it('keep the start, the end and every daily move', () => {
    expect(shuffled[0]).toBe(prices[0]);
    expect(Math.abs(shuffled[shuffled.length - 1] / prices[prices.length - 1] - 1)).toBeLessThan(1e-12);
    const moves = (x: number[]) => x.slice(1).map((p, i) => Math.log(p / x[i])).sort((a, b) => a - b);
    expect(largestGap(moves(shuffled), moves(prices))).toBeLessThan(1e-12);
  });

  it('change the order, the same way for the same seed', () => {
    expect(shuffled).not.toEqual(prices);
    expect(shuffledPrices(prices, new Random(7))).toEqual(shuffled);
  });
});
