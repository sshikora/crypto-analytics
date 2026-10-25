import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fitGarch11, garchForecastVariance } from './garch';
import { logReturns, periodsPerYear } from './returns';

interface GarchFixture {
  timestamps: number[];
  prices: number[];
  reference: {
    omega: number;
    alpha: number;
    beta: number;
    logLikelihood: number;
    currentVolatility: number;
    longRunVolatility: number;
    conditionalVolatility: number[];
    forecast: { horizon: number; steps: number; annualizedVolatility: number }[];
  };
}

function loadFixture(name: string): GarchFixture {
  return JSON.parse(readFileSync(join(__dirname, '..', 'test', 'fixtures', 'garch', `${name}.json`), 'utf8')) as GarchFixture;
}

function relativeError(actual: number, expected: number): number {
  return Math.abs(actual - expected) / Math.abs(expected);
}

describe.each(['btc_daily', 'simulated_2000'])('fitGarch11 against the Python reference (%s)', (name) => {
  const fixture = loadFixture(name);
  const ref = fixture.reference;
  const fit = fitGarch11(logReturns(fixture.prices));
  // The fixture reports annualized percentages
  const annualize = (variance: number) => Math.sqrt(variance * periodsPerYear(fixture.timestamps)) * 100;

  it('reaches the reference maximum likelihood', () => {
    expect(Math.abs(fit.logLikelihood - ref.logLikelihood)).toBeLessThan(1e-4);
  });

  it('matches the reference parameters', () => {
    expect(Math.abs(fit.alpha - ref.alpha)).toBeLessThan(1e-3);
    expect(Math.abs(fit.beta - ref.beta)).toBeLessThan(1e-3);
    expect(relativeError(fit.omega, ref.omega)).toBeLessThan(1e-2);
  });

  it('matches the conditional volatility path', () => {
    expect(fit.variance).toHaveLength(ref.conditionalVolatility.length);
    const worst = Math.max(...fit.variance.map((h, i) => relativeError(annualize(h), ref.conditionalVolatility[i])));
    expect(worst).toBeLessThan(1e-3);
    expect(relativeError(annualize(fit.variance[fit.variance.length - 1]), ref.currentVolatility)).toBeLessThan(1e-3);
    expect(relativeError(annualize(fit.longRunVariance), ref.longRunVolatility)).toBeLessThan(1e-3);
  });

  it('forecasts from the one-step-ahead variance', () => {
    for (const expected of ref.forecast) {
      expect(
        relativeError(annualize(garchForecastVariance(fit, expected.steps)), expected.annualizedVolatility),
        `horizon ${expected.horizon}`
      ).toBeLessThan(1e-3);
    }
  });
});
