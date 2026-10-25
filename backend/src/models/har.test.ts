import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fitHar, harForecastVariance } from './har';
import { logReturns } from './returns';

interface HarFixture {
  prices: number[];
  reference: {
    params: { intercept: number; daily: number; weekly: number; monthly: number };
    rSquared: number;
    nobs: number;
    forecastVariance: number[];
  };
}

const fixture = JSON.parse(
  readFileSync(join(__dirname, '..', 'test', 'fixtures', 'har', 'btc_daily.json'), 'utf8')
) as HarFixture;
const realizedVariance = logReturns(fixture.prices).map(r => r * r);

function relativeError(actual: number, expected: number): number {
  return Math.abs(actual - expected) / Math.abs(expected);
}

describe('HAR-RV against the Python reference (btc_daily)', () => {
  const fit = fitHar(realizedVariance);
  const ref = fixture.reference;

  it('estimates the same coefficients and fit', () => {
    expect(relativeError(fit.intercept, ref.params.intercept)).toBeLessThan(1e-9);
    expect(relativeError(fit.daily, ref.params.daily)).toBeLessThan(1e-9);
    expect(relativeError(fit.weekly, ref.params.weekly)).toBeLessThan(1e-9);
    expect(relativeError(fit.monthly, ref.params.monthly)).toBeLessThan(1e-9);
    expect(relativeError(fit.rSquared, ref.rSquared)).toBeLessThan(1e-9);
    expect(fit.nobs).toBe(ref.nobs);
  });

  it('iterates the same daily variance forecasts', () => {
    const forecasts = harForecastVariance(fit, realizedVariance, ref.forecastVariance.length);
    forecasts.forEach((v, i) => expect(relativeError(v, ref.forecastVariance[i])).toBeLessThan(1e-9));
  });
});

describe('harForecastVariance', () => {
  it('converges to the unconditional variance', () => {
    const fit = { intercept: 1e-4, daily: 0.3, weekly: 0.3, monthly: 0.2, rSquared: 0, nobs: 0 };
    const forecasts = harForecastVariance(fit, new Array(30).fill(4e-4), 2000);
    expect(forecasts[forecasts.length - 1]).toBeCloseTo(1e-4 / (1 - 0.8), 12);
  });
});
