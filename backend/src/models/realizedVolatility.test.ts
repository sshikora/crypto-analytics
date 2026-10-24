import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ewmaVariance, rollingVolatility } from './realizedVolatility';
import { logReturns } from './returns';

interface RealizedVolFixture {
  prices: number[];
  reference: {
    rollingVolatility: Record<string, (number | null)[]>;
    ewmaVariance: Record<string, number[]>;
  };
}

const fixture = JSON.parse(
  readFileSync(join(__dirname, '..', 'test', 'fixtures', 'realized_vol', 'btc_daily.json'), 'utf8')
) as RealizedVolFixture;
const returns = logReturns(fixture.prices);

function relativeError(actual: number, expected: number): number {
  return Math.abs(actual - expected) / Math.abs(expected);
}

describe('realized volatility against the Python reference (btc_daily)', () => {
  it.each(Object.keys(fixture.reference.rollingVolatility))('rolling %s-day close-to-close volatility', (window) => {
    const expected = fixture.reference.rollingVolatility[window];
    const actual = rollingVolatility(returns, Number(window));

    expect(actual).toHaveLength(expected.length);
    actual.forEach((v, i) => {
      if (expected[i] === null) {
        expect(v).toBeNull();
      } else {
        expect(relativeError(v as number, expected[i] as number)).toBeLessThan(1e-12);
      }
    });
  });

  it.each(Object.keys(fixture.reference.ewmaVariance))('EWMA variance with decay %s', (decay) => {
    const expected = fixture.reference.ewmaVariance[decay];
    const actual = ewmaVariance(returns, Number(decay));

    expect(actual).toHaveLength(expected.length);
    actual.forEach((v, i) => expect(relativeError(v, expected[i])).toBeLessThan(1e-12));
  });
});

describe('realized volatility', () => {
  it('is zero for constant returns, before and after demeaning', () => {
    expect(rollingVolatility([0.01, 0.01, 0.01, 0.01], 3)).toEqual([null, null, 0, 0]);
    ewmaVariance([0.01, 0.01, 0.01]).forEach((v) => expect(v).toBeCloseTo(0.0001, 15));
  });

  it('starts EWMA from the first squared return with no seed', () => {
    expect(ewmaVariance([0.02, 0], 0.9)).toEqual([0.0004, 0.0004 * 0.9 / 1.9]);
  });

  it('returns only nulls when the window is longer than the series', () => {
    expect(rollingVolatility([0.01, -0.02], 3)).toEqual([null, null]);
  });
});
