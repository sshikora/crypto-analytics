import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { regime, Regime } from './regime';

const fixture = JSON.parse(
  readFileSync(join(__dirname, '..', 'test', 'fixtures', 'regime', 'btc_eth_daily.json'), 'utf8')
) as { coins: Record<string, { prices: number[]; cases: (Regime & { closes: number })[] }> };

const cases = Object.entries(fixture.coins).flatMap(([coin, { prices, cases }]) =>
  cases.map(c => ({ coin, prices: prices.slice(0, c.closes), expected: c }))
);

describe('threshold regime against the Python reference', () => {
  it.each(cases)('$coin after $expected.closes closes', ({ prices, expected }) => {
    const actual = regime(prices);
    expect(actual.trend).toBe(expected.trend);
    expect(actual.volatilityLevel).toBe(expected.volatilityLevel);
    expect(Math.abs(actual.movingAverage - expected.movingAverage) / expected.movingAverage).toBeLessThan(1e-12);
    expect(Math.abs(actual.priceToMovingAverage - expected.priceToMovingAverage)).toBeLessThan(1e-12);
    expect(Math.abs(actual.volatilityPercentile - expected.volatilityPercentile)).toBeLessThan(1e-12);
  });

  it('covers both trends and all three volatility levels', () => {
    expect(new Set(cases.map(c => c.expected.trend))).toEqual(new Set(['up', 'down']));
    expect(new Set(cases.map(c => c.expected.volatilityLevel))).toEqual(new Set(['low', 'normal', 'high']));
  });
});
