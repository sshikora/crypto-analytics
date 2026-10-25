import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  filteredHistoricalTailRisk,
  fitFilteredModel,
  fitStudentT,
  historicalTailRisk,
  normalTailRisk,
  quantile,
  studentTTailRisk,
  VarMethod,
} from './valueAtRisk';
import { christoffersenTest, conditionalCoverageTest, kupiecTest, varExceptions } from './varBacktest';
import { simpleReturns } from './returns';

interface MethodReference {
  valueAtRisk: number;
  expectedShortfall: number;
  exceptions: number[];
  days: number;
  kupiec: { statistic: number; pValue: number };
  christoffersen: { statistic: number; pValue: number };
  conditionalCoverage: { statistic: number; pValue: number };
}

interface VarFixture {
  window: number;
  prices: number[];
  reference: {
    studentT: { location: number; scale: number; dof: number; logLikelihood: number };
    filteredHistorical: { mu: number; sigma: number; residuals: number[] };
    levels: { confidence: number; methods: Record<VarMethod, MethodReference> }[];
  };
}

const fixture = JSON.parse(
  readFileSync(join(__dirname, '..', 'test', 'fixtures', 'var', 'btc_daily.json'), 'utf8')
) as VarFixture;
const returns = simpleReturns(fixture.prices);
const latest = returns.slice(-fixture.window);
const fit = fitStudentT(latest);
const filtered = fitFilteredModel(latest);

function relativeError(actual: number, expected: number): number {
  return Math.abs(actual - expected) / Math.abs(expected);
}

describe('Student-t maximum likelihood against the Python reference (btc_daily)', () => {
  const ref = fixture.reference.studentT;

  it('reaches the reference maximum likelihood', () => {
    expect(Math.abs(fit.logLikelihood - ref.logLikelihood)).toBeLessThan(1e-8);
  });

  it('estimates the same location, scale and degrees of freedom', () => {
    expect(Math.abs(fit.location - ref.location)).toBeLessThan(1e-8);
    expect(relativeError(fit.scale, ref.scale)).toBeLessThan(1e-6);
    expect(relativeError(fit.dof, ref.dof)).toBeLessThan(1e-5);
  });
});

describe('GARCH-filtered model against the Python reference (btc_daily)', () => {
  const ref = fixture.reference.filteredHistorical;

  it('scales tomorrow by the GARCH volatility and draws shapes from the standardized residuals', () => {
    expect(Math.abs(filtered.mu - ref.mu)).toBeLessThan(1e-15);
    expect(relativeError(filtered.sigma, ref.sigma)).toBeLessThan(1e-4);
    expect(filtered.residuals).toHaveLength(ref.residuals.length);
    filtered.residuals.forEach((z, i) => expect(Math.abs(z - ref.residuals[i])).toBeLessThan(1e-3));
  });
});

describe.each(fixture.reference.levels)('VaR at $confidence confidence (btc_daily)', ({ confidence, methods }) => {
  const alpha = 1 - confidence;
  const headline = {
    historical: historicalTailRisk(latest, alpha),
    normal: normalTailRisk(latest, alpha),
    studentT: studentTTailRisk(fit, alpha),
    filteredHistorical: filteredHistoricalTailRisk(filtered, alpha),
  };

  it.each(Object.keys(methods) as VarMethod[])('%s VaR and expected shortfall', method => {
    // The fitted methods agree to the precision of their optimizers; the closed-form ones to rounding
    const tolerance = { historical: 1e-12, normal: 1e-12, studentT: 1e-6, filteredHistorical: 1e-5 }[method];
    expect(relativeError(headline[method].valueAtRisk, methods[method].valueAtRisk)).toBeLessThan(tolerance);
    expect(relativeError(headline[method].expectedShortfall, methods[method].expectedShortfall)).toBeLessThan(tolerance);
  });

  it.each(Object.keys(methods) as VarMethod[])('%s backtest exceptions and tests', method => {
    const ref = methods[method];
    const [hits] = varExceptions(returns, [alpha], fixture.window, method);

    expect(hits).toHaveLength(ref.days);
    expect(hits.flatMap((hit, i) => (hit ? [i] : []))).toEqual(ref.exceptions);
    for (const [name, result] of [
      ['kupiec', kupiecTest(hits, alpha)],
      ['christoffersen', christoffersenTest(hits)],
      ['conditionalCoverage', conditionalCoverageTest(hits, alpha)],
    ] as const) {
      expect(Math.abs(result.statistic - ref[name].statistic)).toBeLessThan(1e-10);
      expect(Math.abs(result.pValue - ref[name].pValue)).toBeLessThan(1e-10);
    }
  });
});

describe('fitStudentT', () => {
  // A stablecoin's fit can end with dof - 2 below double precision, and the next day warm-starts from it
  it("refits from the previous day's fit when its degrees of freedom rounded to exactly 2", () => {
    const previous = { ...fixture.reference.studentT, dof: 2 + 1e-18 };
    expect(previous.dof).toBe(2);

    const refit = fitStudentT(latest, previous);

    expect(Math.abs(refit.logLikelihood - fixture.reference.studentT.logLikelihood)).toBeLessThan(1e-8);
  });

  it('reaches the maximum from a distant start', () => {
    const refit = fitStudentT(latest, { location: 0.01, scale: 0.05, dof: 30, logLikelihood: 0 });
    expect(Math.abs(refit.logLikelihood - fixture.reference.studentT.logLikelihood)).toBeLessThan(1e-8);
  });
});

describe('quantile', () => {
  it('interpolates linearly between order statistics, as numpy does', () => {
    expect(quantile([4, 1, 3, 2], 0.5)).toBe(2.5);
    expect(quantile([4, 1, 3, 2], 0.1)).toBeCloseTo(1.3, 12);
    expect(quantile([4, 1, 3, 2], 1)).toBe(4);
  });
});

describe('backtest statistics', () => {
  it('are zero when the exception rate is exactly alpha and exceptions do not cluster', () => {
    const hits = Array.from({ length: 100 }, (_, i) => i % 20 === 10);
    expect(kupiecTest(hits, 0.05).statistic).toBeCloseTo(0, 12);
    expect(kupiecTest(hits, 0.05).pValue).toBeCloseTo(1, 12);
  });

  it('flag clustered exceptions', () => {
    const hits = Array.from({ length: 200 }, (_, i) => i >= 100 && i < 110);
    expect(christoffersenTest(hits).pValue).toBeLessThan(0.001);
  });

  it('handle a run with no exceptions', () => {
    const hits = new Array(183).fill(false);
    expect(christoffersenTest(hits)).toEqual({ statistic: 0, pValue: 1 });
    // LR = -2 * 183 * ln(0.99) = 3.679, chi-square(1) tail 0.05512
    expect(kupiecTest(hits, 0.01).pValue).toBeCloseTo(0.05512, 5);
  });
});
