import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fitGarch } from './garchService';

interface GarchFixture {
  name: string;
  timestamps: number[];
  prices: number[];
  reference: {
    omega: number;
    alpha: number;
    beta: number;
    persistence: number;
    logLikelihood: number;
    currentVolatility: number;
    longRunVolatility: number;
    conditionalVolatility: number[];
    forecast: { horizon: number; annualizedVolatility: number }[];
  };
}

function loadFixture(name: string): GarchFixture {
  const path = join(__dirname, '..', 'test', 'fixtures', 'garch', `${name}.json`);
  return JSON.parse(readFileSync(path, 'utf8')) as GarchFixture;
}

function relativeError(actual: number, expected: number): number {
  return Math.abs(actual - expected) / Math.abs(expected);
}

describe.each(['btc_daily', 'simulated_2000'])('fitGarch against the Python reference (%s)', (name) => {
  const fixture = loadFixture(name);
  const ref = fixture.reference;
  const result = fitGarch(fixture.prices, fixture.timestamps, `FIXTURE_${name}`);

  it('reaches the reference maximum likelihood', () => {
    expect(result.logLikelihood).toBeGreaterThan(ref.logLikelihood - 1e-4);
    expect(result.logLikelihood).toBeLessThan(ref.logLikelihood + 1e-4);
  });

  it('matches the reference parameters', () => {
    expect(Math.abs(result.alpha - ref.alpha)).toBeLessThan(1e-3);
    expect(Math.abs(result.beta - ref.beta)).toBeLessThan(1e-3);
    expect(relativeError(result.omega, ref.omega)).toBeLessThan(1e-2);
  });

  it('matches the conditional volatility path', () => {
    expect(result.conditionalVolatility).toHaveLength(ref.conditionalVolatility.length);
    const worst = Math.max(
      ...result.conditionalVolatility.map((p, i) => relativeError(p.annualizedVolatility, ref.conditionalVolatility[i]))
    );
    expect(worst).toBeLessThan(1e-3);
    expect(relativeError(result.currentVolatility, ref.currentVolatility)).toBeLessThan(1e-3);
    expect(relativeError(result.longRunVolatility, ref.longRunVolatility)).toBeLessThan(1e-3);
  });

  it('forecasts from the one-step-ahead variance', () => {
    for (const expected of ref.forecast) {
      const actual = result.forecast.find((f) => f.horizon === expected.horizon);
      expect(actual, `horizon ${expected.horizon}`).toBeDefined();
      expect(
        relativeError(actual!.annualizedVolatility, expected.annualizedVolatility),
        `horizon ${expected.horizon}`
      ).toBeLessThan(1e-3);
    }
  });
});
