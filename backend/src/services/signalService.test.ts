import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { getLatestSignals } from '../repositories/coinMetricsRepository';
import { getSignals, SignalSummary, SIGNALS_VERSION, summarizeSignals } from './signalService';

vi.mock('../repositories/coinMetricsRepository', () => ({ getLatestSignals: vi.fn() }));
vi.mock('../repositories/priceHistoryRepository', () => ({ getDailyPrices: vi.fn() }));

const fixtureDir = join(__dirname, '..', 'test', 'fixtures');
const performance = JSON.parse(readFileSync(join(fixtureDir, 'performance', 'btc_eth_daily.json'), 'utf8')) as {
  dates: string[];
  timestamps: number[];
  periodsPerYear: number;
  coins: { bitcoin: { prices: number[] } };
};
// The same year of Bitcoin closes, with the reference's crossover results
const backtest = JSON.parse(readFileSync(join(fixtureDir, 'backtest', 'btc_crossovers.json'), 'utf8')) as {
  prices: number[];
  sharpe: number[];
  best: number;
  impliedTrials: number;
  deflatedSharpeImplied: number;
  walkForward: { chosen: number[]; returns: number[] };
};

const prices = performance.dates.map((date, i) => ({ date, timestamp: performance.timestamps[i], price: performance.coins.bitcoin.prices[i] }));
const annual = Math.sqrt(performance.periodsPerYear);
const relativeGap = (a: number, b: number) => Math.abs(a - b) / Math.abs(b);

function series(returns: number[]) {
  let price = 100;
  return [{ date: '2025-01-01', timestamp: 0, price }].concat(
    returns.map((r, i) => {
      price *= Math.exp(r);
      const timestamp = (i + 1) * 86_400_000;
      return { date: new Date(timestamp + Date.UTC(2025, 0, 1)).toISOString().slice(0, 10), timestamp, price };
    })
  );
}

describe('summarizeSignals on Bitcoin', () => {
  let summary: SignalSummary;
  beforeAll(() => {
    summary = summarizeSignals('bitcoin', prices)!;
  });

  it('uses the same closes as the backtest reference', () => {
    expect(prices.map(p => p.price)).toEqual(backtest.prices);
  });

  it('matches the reference for every crossover, the deflated Sharpe ratio and the walk-forward', () => {
    summary.variants.forEach((v, i) => expect(relativeGap(v.sharpe, backtest.sharpe[i] * annual)).toBeLessThan(1e-12));
    expect([summary.best.short, summary.best.long]).toEqual([1, 20]);
    expect(relativeGap(summary.impliedTrials, backtest.impliedTrials)).toBeLessThan(1e-12);
    expect(relativeGap(summary.best.deflatedSharpe, backtest.deflatedSharpeImplied)).toBeLessThan(1e-12);
    expect(summary.walkForward.folds.map(f => `${f.short}/${f.long}`)).toEqual(['1/20', '10/30', '1/20', '20/50', '20/50']);
    const growth = backtest.walkForward.returns.reduce((g, r) => g * (1 + r), 1) - 1;
    expect(relativeGap(summary.walkForward.strategy.totalReturn, growth)).toBeLessThan(1e-12);
  });

  it('dates each fold and the equity curves by the closes they start from', () => {
    const { walkForward } = summary;
    expect(walkForward.from).toBe(prices[219].date);
    expect(walkForward.folds.map(f => f.from)).toEqual([219, 249, 279, 309, 339].map(i => prices[i].date));
    expect(walkForward.equity).toHaveLength(walkForward.days + 1);
    expect(walkForward.equity[0]).toEqual({ date: walkForward.from, strategy: 1, holding: 1 });
    expect(walkForward.equity[walkForward.days].date).toBe(summary.asOf);
    expect(walkForward.equity[walkForward.days].strategy - 1).toBeCloseTo(walkForward.strategy.totalReturn, 12);
  });

  it('reports the losing closed trades and the trade still open', () => {
    expect([summary.walkForward.trades, summary.walkForward.closedTrades, summary.walkForward.winRate]).toEqual([7, 6, 0]);
    expect(summary.walkForward.openTrade?.return).toBeCloseTo(0.2842, 4);
  });

  it('gives a p-value from 200 shuffles', () => {
    expect(summary.shuffles).toBe(200);
    expect(Number.isInteger(summary.timingPValue * 201 - 1)).toBe(true);
    expect(summarizeSignals('bitcoin', prices)!.timingPValue).toBe(summary.timingPValue);
  });
});

describe('summarizeSignals', () => {
  it('needs 250 closes', () => {
    expect(summarizeSignals('new-coin', prices.slice(-249))).toBeNull();
    expect(summarizeSignals('new-coin', prices.slice(-250))).not.toBeNull();
  });

  it('dates the current state from the last crossing', () => {
    // Falls for 300 days, then rises for 40, so the price ends above its 20-day average
    const closes = series([...Array(300).fill(-0.01), ...Array(40).fill(0.01)]);
    const above = closes.map((p, i) => i >= 19 && p.price > closes.slice(i - 19, i + 1).reduce((s, c) => s + c.price, 0) / 20);
    const crossed = above.findIndex((a, i) => i > 300 && a);
    const priceOver20 = summarizeSignals('trend', closes)!.variants.find(v => v.short === 1 && v.long === 20)!;
    expect(priceOver20.position).toBe(1);
    expect(crossed).toBeGreaterThan(301);
    expect(priceOver20.since).toBe(closes[crossed].date);
  });

  it('finds timing skill in prices that trend in long runs, and none in shuffled-looking ones', () => {
    const runs = Array.from({ length: 364 }, (_, i) => (Math.floor(i / 40) % 2 === 0 ? 0.01 : -0.01) + 0.002 * Math.sin(i * 7.3));
    expect(summarizeSignals('runs', series(runs))!.timingPValue).toBeLessThan(0.05);

    const noise = Array.from({ length: 364 }, (_, i) => 0.02 * Math.sin(i * 12.9898) * Math.cos(i * 78.233));
    expect(summarizeSignals('noise', series(noise))!.timingPValue).toBeGreaterThan(0.05);
  });
});

describe('getSignals', () => {
  it('serves only rows written by the current version', async () => {
    vi.mocked(getLatestSignals).mockResolvedValueOnce({ signals: { coinId: 'old' } as SignalSummary, version: SIGNALS_VERSION - 1, computedAt: '' });
    expect(await getSignals('old')).toBeNull();
    vi.mocked(getLatestSignals).mockResolvedValueOnce({ signals: { coinId: 'new' } as SignalSummary, version: SIGNALS_VERSION, computedAt: '' });
    expect(await getSignals('new')).toEqual({ coinId: 'new' });
  });

  it('rejects ids that are not coin ids', async () => {
    await expect(getSignals('__market__')).rejects.toThrow('Invalid coin id');
  });
});
