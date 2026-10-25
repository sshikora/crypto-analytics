import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fitGarch11 } from './garch';
import { informationCriteria, ljungBox, normalQqPoints, standardizedResiduals } from './garchDiagnostics';
import { logReturns, moments } from './returns';

interface DiagnosticsFixture {
  prices: number[];
  reference: {
    logLikelihood: number;
    observations: number;
    aic: number;
    bic: number;
    standardizedResiduals: number[];
    ljungBoxResiduals: { statistic: number; pValue: number };
    ljungBoxSquaredResiduals: { statistic: number; pValue: number };
    normalQq: { theoretical: number; sample: number }[];
    standardizedExcessKurtosis: number;
  };
}

const fixture = JSON.parse(
  readFileSync(join(__dirname, '..', 'test', 'fixtures', 'garch', 'btc_daily_diagnostics.json'), 'utf8')
) as DiagnosticsFixture;
const ref = fixture.reference;
const returns = logReturns(fixture.prices);
const fit = fitGarch11(returns);
const z = standardizedResiduals(returns, fit);

function relativeError(actual: number, expected: number): number {
  return Math.abs(actual - expected) / Math.abs(expected);
}

describe('GARCH diagnostics against the Python reference (btc_daily)', () => {
  // The fit itself matches the reference to the tolerances in garch.test.ts, so the diagnostics are compared
  // at a tolerance that allows for those small parameter differences
  it('computes the standardized residuals', () => {
    expect(z).toHaveLength(ref.observations);
    z.forEach((v, i) => expect(Math.abs(v - ref.standardizedResiduals[i])).toBeLessThan(1e-3));
  });

  it('computes AIC and BIC with four parameters', () => {
    const { aic, bic } = informationCriteria(fit.logLikelihood, z.length);
    expect(Math.abs(aic - ref.aic)).toBeLessThan(2e-4);
    expect(Math.abs(bic - ref.bic)).toBeLessThan(2e-4);
  });

  it('computes Ljung-Box on the residuals and squared residuals at 10 lags', () => {
    const plain = ljungBox(z, 10);
    const squared = ljungBox(z.map(v => v * v), 10);
    expect(relativeError(plain.statistic, ref.ljungBoxResiduals.statistic)).toBeLessThan(1e-3);
    expect(Math.abs(plain.pValue - ref.ljungBoxResiduals.pValue)).toBeLessThan(1e-3);
    expect(relativeError(squared.statistic, ref.ljungBoxSquaredResiduals.statistic)).toBeLessThan(1e-3);
    expect(Math.abs(squared.pValue - ref.ljungBoxSquaredResiduals.pValue)).toBeLessThan(1e-3);
  });

  it('pairs sorted residuals with normal quantiles', () => {
    const qq = normalQqPoints(z);
    qq.forEach((p, i) => {
      expect(Math.abs(p.theoretical - ref.normalQq[i].theoretical)).toBeLessThan(1e-12);
      expect(Math.abs(p.sample - ref.normalQq[i].sample)).toBeLessThan(1e-3);
    });
  });

  it('measures the fat tails left in the residuals', () => {
    expect(relativeError(moments(z).excessKurtosis, ref.standardizedExcessKurtosis)).toBeLessThan(1e-3);
  });
});

describe('diagnostics on the reference residuals exactly', () => {
  // Fed the reference's own residuals, the formulas must agree with statsmodels to rounding
  it('Ljung-Box matches statsmodels', () => {
    const plain = ljungBox(ref.standardizedResiduals, 10);
    const squared = ljungBox(ref.standardizedResiduals.map(v => v * v), 10);
    expect(relativeError(plain.statistic, ref.ljungBoxResiduals.statistic)).toBeLessThan(1e-12);
    expect(relativeError(plain.pValue, ref.ljungBoxResiduals.pValue)).toBeLessThan(1e-12);
    expect(relativeError(squared.statistic, ref.ljungBoxSquaredResiduals.statistic)).toBeLessThan(1e-12);
    expect(relativeError(squared.pValue, ref.ljungBoxSquaredResiduals.pValue)).toBeLessThan(1e-12);
  });

  it('AIC and BIC match for the reference likelihood', () => {
    const { aic, bic } = informationCriteria(ref.logLikelihood, ref.observations);
    expect(relativeError(aic, ref.aic)).toBeLessThan(1e-14);
    expect(relativeError(bic, ref.bic)).toBeLessThan(1e-14);
  });
});

describe('ljungBox', () => {
  it('finds strong autocorrelation in a trending series', () => {
    expect(ljungBox(Array.from({ length: 100 }, (_, i) => i), 5).pValue).toBeLessThan(1e-10);
  });
});
