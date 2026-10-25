import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { logReturns, moments, periodsPerYear, simpleReturns } from './returns';

interface ReturnsFixture {
  timestamps: number[];
  prices: number[];
  reference: {
    logReturns: number[];
    simpleReturns: number[];
    periodsPerYear: number;
    logReturnMoments: {
      mean: number;
      standardDeviation: number;
      skewness: number;
      excessKurtosis: number;
    };
  };
}

const fixture = JSON.parse(
  readFileSync(join(__dirname, '..', 'test', 'fixtures', 'returns', 'btc_daily.json'), 'utf8')
) as ReturnsFixture;
const ref = fixture.reference;

function relativeError(actual: number, expected: number): number {
  return Math.abs(actual - expected) / Math.abs(expected);
}

describe('returns against the Python reference (btc_daily)', () => {
  it('computes log and simple returns', () => {
    const log = logReturns(fixture.prices);
    const simple = simpleReturns(fixture.prices);

    // numpy differences the logs of prices near 1e5, so its last digits differ from log(p1 / p0) by a few ulps
    expect(log).toHaveLength(ref.logReturns.length);
    log.forEach((r, i) => expect(Math.abs(r - ref.logReturns[i])).toBeLessThan(1e-14));
    simple.forEach((r, i) => expect(Math.abs(r - ref.simpleReturns[i])).toBeLessThan(1e-14));
  });

  it('annualizes from the average observation spacing', () => {
    expect(relativeError(periodsPerYear(fixture.timestamps), ref.periodsPerYear)).toBeLessThan(1e-12);
  });

  it('matches the sample moments of the log returns', () => {
    const m = moments(logReturns(fixture.prices));
    const expected = ref.logReturnMoments;

    expect(relativeError(m.mean, expected.mean)).toBeLessThan(1e-10);
    expect(relativeError(m.standardDeviation, expected.standardDeviation)).toBeLessThan(1e-10);
    expect(relativeError(m.skewness, expected.skewness)).toBeLessThan(1e-10);
    expect(relativeError(m.excessKurtosis, expected.excessKurtosis)).toBeLessThan(1e-10);
  });
});

describe('returns', () => {
  it('aligns each return with the price it ends on', () => {
    expect(simpleReturns([100, 110, 99])).toEqual([0.10000000000000009, -0.09999999999999998]);
    expect(logReturns([100, 100 * Math.E])).toEqual([1]);
  });

  it('gives zero skewness for symmetric data', () => {
    expect(moments([-2, -1, 0, 1, 2]).skewness).toBeCloseTo(0, 15);
  });

  it('needs at least four observations for moments', () => {
    expect(() => moments([1, 2, 3])).toThrow('At least 4 observations');
  });
});
