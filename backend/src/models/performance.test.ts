import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { annualizedReturn, betaTo, drawdowns, sharpeRatio, sortinoRatio, worstDays, worstWeek } from './performance';
import { simpleReturns } from './returns';

interface CoinReference {
  prices: number[];
  annualizedReturn: number;
  sharpe: number;
  sortino: number;
  calmar: number;
  maxDrawdown: number;
  peakDate: string;
  troughDate: string;
  recoveryDate: string | null;
  currentDrawdown: number;
  longestDrawdownDays: number;
  worstDays: { date: string; return: number }[];
  worstWeek: { startDate: string; endDate: string; return: number };
}

const fixture = JSON.parse(
  readFileSync(join(__dirname, '..', 'test', 'fixtures', 'performance', 'btc_eth_daily.json'), 'utf8')
) as {
  dates: string[];
  periodsPerYear: number;
  coins: Record<'bitcoin' | 'ethereum', CoinReference>;
  ethereumBeta: Record<'days365' | 'days90', { beta: number; correlation: number }>;
};

function relativeError(actual: number, expected: number): number {
  return Math.abs(actual - expected) / Math.abs(expected);
}

describe.each(['bitcoin', 'ethereum'] as const)('return and drawdown metrics against the Python reference (%s)', (coin) => {
  const ref = fixture.coins[coin];
  const series = ref.prices.map((price, i) => ({ date: fixture.dates[i], price }));
  const returns = simpleReturns(ref.prices);

  it('annualizes return and the Sharpe and Sortino ratios', () => {
    expect(relativeError(annualizedReturn(ref.prices, fixture.periodsPerYear), ref.annualizedReturn)).toBeLessThan(1e-12);
    expect(relativeError(sharpeRatio(returns, fixture.periodsPerYear), ref.sharpe)).toBeLessThan(1e-12);
    expect(relativeError(sortinoRatio(returns, fixture.periodsPerYear), ref.sortino)).toBeLessThan(1e-12);
  });

  it('finds the maximum, current and longest drawdowns with their dates', () => {
    const d = drawdowns(series);
    expect(relativeError(d.maxDrawdown, ref.maxDrawdown)).toBeLessThan(1e-12);
    expect(relativeError(d.currentDrawdown, ref.currentDrawdown)).toBeLessThan(1e-12);
    expect([d.peakDate, d.troughDate, d.recoveryDate, d.longestDrawdownDays]).toEqual([
      ref.peakDate,
      ref.troughDate,
      ref.recoveryDate,
      ref.longestDrawdownDays,
    ]);
  });

  it('lists the worst days and the worst week', () => {
    const days = worstDays(series, 5);
    expect(days.map(d => d.date)).toEqual(ref.worstDays.map(d => d.date));
    days.forEach((d, i) => expect(relativeError(d.return, ref.worstDays[i].return)).toBeLessThan(1e-12));
    const week = worstWeek(series);
    expect([week.startDate, week.endDate]).toEqual([ref.worstWeek.startDate, ref.worstWeek.endDate]);
    expect(relativeError(week.return, ref.worstWeek.return)).toBeLessThan(1e-12);
  });
});

describe('beta to Bitcoin against scipy linregress (ethereum)', () => {
  const eth = simpleReturns(fixture.coins.ethereum.prices);
  const btc = simpleReturns(fixture.coins.bitcoin.prices);

  it.each([
    ['days365', eth, btc],
    ['days90', eth.slice(-90), btc.slice(-90)],
  ] as const)('%s', (window, coin, benchmark) => {
    const result = betaTo([...coin], [...benchmark]);
    expect(relativeError(result.beta, fixture.ethereumBeta[window].beta)).toBeLessThan(1e-12);
    expect(relativeError(result.correlation, fixture.ethereumBeta[window].correlation)).toBeLessThan(1e-12);
  });
});

describe('drawdowns', () => {
  it('records the recovery date and the days spent below the high', () => {
    const series = [100, 120, 90, 110, 125, 130].map((price, i) => ({ date: `d${i}`, price }));
    expect(drawdowns(series)).toEqual({
      maxDrawdown: 90 / 120 - 1,
      peakDate: 'd1',
      troughDate: 'd2',
      recoveryDate: 'd4',
      currentDrawdown: 0,
      longestDrawdownDays: 2,
    });
  });

  it('is zero for a price that only rises', () => {
    const series = [1, 2, 3].map((price, i) => ({ date: `d${i}`, price }));
    expect(drawdowns(series)).toMatchObject({ maxDrawdown: 0, currentDrawdown: 0, longestDrawdownDays: 0 });
  });
});
