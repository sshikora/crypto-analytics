import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { normalQuantile, studentTCdf } from './distributions';
import {
  GarchBootstrapModel,
  GbmModel,
  PathModel,
  SimulationSummary,
  StudentTModel,
  garchBootstrapModel,
  gbmModel,
  simulate,
  studentTModel,
  summarize,
  truncate,
} from './monteCarlo';
import { logReturns } from './returns';

interface MonteCarloFixture {
  prices: number[];
  models: PathModel[];
  paths: { paths: number; days: number; seed: number };
  summary: { paths: number; days: number; seed: number; quantiles: number[]; alpha: number; thresholds: number[] };
  simulations: { model: PathModel['kind']; antithetic: boolean; cumulative: number[][]; summary: SimulationSummary }[];
}

const fixture = JSON.parse(
  readFileSync(join(__dirname, '..', 'test', 'fixtures', 'monte_carlo', 'btc_daily.json'), 'utf8')
) as MonteCarloFixture;

const model = <K extends PathModel['kind']>(kind: K) => fixture.models.find(m => m.kind === kind) as Extract<PathModel, { kind: K }>;
const gbm = model('gbm') as GbmModel;
const studentT = model('studentT') as StudentTModel;
const garch = model('garchBootstrap') as GarchBootstrapModel;

function relativeError(actual: number, expected: number): number {
  return Math.abs(actual - expected) / Math.abs(expected);
}

// Each day's simulated log return across paths
function dailyShocks(cumulative: Float64Array, paths: number, days: number, day: number): number[] {
  return Array.from({ length: paths }, (_, p) => cumulative[p * days + day] - (day > 0 ? cumulative[p * days + day - 1] : 0));
}

function meanAndStandardError(x: number[]): { mean: number; standardError: number } {
  const m = x.reduce((s, v) => s + v, 0) / x.length;
  const variance = x.reduce((s, v) => s + (v - m) ** 2, 0) / (x.length - 1);
  return { mean: m, standardError: Math.sqrt(variance / x.length) };
}

describe.each(fixture.simulations)('simulate against the Python reference ($model, antithetic $antithetic)', (ref) => {
  const fitted = model(ref.model);

  it('draws the same paths', () => {
    const { paths, days, seed } = fixture.paths;
    const sim = simulate(fitted, { paths, days, seed, antithetic: ref.antithetic });
    const worst = Math.max(...ref.cumulative.flatMap((row, p) => row.map((x, d) => Math.abs(sim.cumulative[p * days + d] - x))));
    expect(worst).toBeLessThan(1e-12);
  });

  it('summarizes the same', () => {
    const { paths, days, seed, quantiles, alpha, thresholds } = fixture.summary;
    const summary = summarize(simulate(fitted, { paths, days, seed, antithetic: ref.antithetic }), quantiles, alpha, thresholds);
    const worstFan = Math.max(...summary.fan.flatMap((row, d) => row.map((x, q) => relativeError(x, ref.summary.fan[d][q]))));
    expect(worstFan).toBeLessThan(1e-12);
    expect(relativeError(summary.mean, ref.summary.mean)).toBeLessThan(1e-10);
    expect(relativeError(summary.standardError, ref.summary.standardError)).toBeLessThan(1e-10);
    expect(relativeError(summary.valueAtRisk, ref.summary.valueAtRisk)).toBeLessThan(1e-12);
    expect(relativeError(summary.expectedShortfall, ref.summary.expectedShortfall)).toBeLessThan(1e-12);
    expect(summary.drawdownProbabilities).toEqual(ref.summary.drawdownProbabilities);
  });
});

describe('model fits on the Bitcoin sample', () => {
  const r = logReturns(fixture.prices);

  it('estimates the normal model as the Python reference does', () => {
    const fit = gbmModel(r);
    expect(relativeError(fit.mu, gbm.mu)).toBeLessThan(1e-12);
    expect(relativeError(fit.sigma, gbm.sigma)).toBeLessThan(1e-12);
  });

  it('fits the Student-t model as the Python reference does', () => {
    const fit = studentTModel(r);
    expect(Math.abs(fit.location - studentT.location)).toBeLessThan(1e-8);
    expect(relativeError(fit.scale, studentT.scale)).toBeLessThan(1e-6);
    expect(relativeError(fit.dof, studentT.dof)).toBeLessThan(1e-5);
  });

  // The same tolerances as the GARCH fit's own tests, since the two optimizers stop at slightly different points
  it('fits the GARCH bootstrap model as the Python reference does', () => {
    const fit = garchBootstrapModel(r);
    expect(relativeError(fit.mu, garch.mu)).toBeLessThan(1e-12);
    expect(Math.abs(fit.alpha - garch.alpha)).toBeLessThan(1e-3);
    expect(Math.abs(fit.beta - garch.beta)).toBeLessThan(1e-3);
    expect(relativeError(fit.omega, garch.omega)).toBeLessThan(1e-2);
    expect(relativeError(fit.nextVariance, garch.nextVariance)).toBeLessThan(1e-3);
    expect(fit.residuals).toHaveLength(garch.residuals.length);
    fit.residuals.forEach((z, i) => expect(Math.abs(z - garch.residuals[i])).toBeLessThan(1e-3));
  });
});

describe('simulated paths against closed forms', () => {
  const paths = 20000;

  it('pairs antithetic normal paths so each pair averages exactly the drift', () => {
    const days = 10;
    const sim = simulate(gbm, { paths: 200, days, seed: 1, antithetic: true });
    for (let p = 0; p < 200; p += 2) {
      for (let d = 0; d < days; d++) {
        const pairMean = (sim.cumulative[p * days + d] + sim.cumulative[(p + 1) * days + d]) / 2;
        expect(Math.abs(pairMean - gbm.mu * (d + 1))).toBeLessThan(1e-15);
      }
    }
  });

  it('gives normal log returns their mean and variance over the horizon', () => {
    const days = 10;
    const sim = simulate(gbm, { paths, days, seed: 2, antithetic: false });
    const terminal = Array.from({ length: paths }, (_, p) => sim.cumulative[p * days + days - 1]);
    const { mean, standardError } = meanAndStandardError(terminal);
    const variance = terminal.reduce((s, x) => s + (x - mean) ** 2, 0) / (paths - 1);
    const expectedVariance = days * gbm.sigma ** 2;

    expect(Math.abs(mean - days * gbm.mu)).toBeLessThan(4 * standardError);
    expect(Math.abs(variance - expectedVariance)).toBeLessThan(4 * expectedVariance * Math.sqrt(2 / (paths - 1)));
  });

  it("puts the normal model's fan on the lognormal quantiles", () => {
    const days = 30;
    const quantiles = [0.05, 0.5, 0.95];
    const { fan } = summarize(simulate(gbm, { paths, days, seed: 3, antithetic: false }), quantiles, 0.05, []);
    for (const day of [1, 10, 30]) {
      quantiles.forEach((q, i) => {
        const z = normalQuantile(q);
        const expected = Math.exp(day * gbm.mu + Math.sqrt(day) * gbm.sigma * z);
        // Standard error of a sample quantile, sqrt(q (1 - q) / n) / density, on the log scale
        const tolerance = (4 * Math.sqrt((q * (1 - q)) / paths) * Math.sqrt(day) * gbm.sigma) / Math.exp(-0.5 * z * z) * Math.sqrt(2 * Math.PI);
        expect(Math.abs(Math.log(fan[day - 1][i]) - Math.log(expected)), `day ${day}, q ${q}`).toBeLessThan(tolerance);
      });
    }
  });

  it('draws Student-t daily returns from the fitted distribution', () => {
    const sim = simulate(studentT, { paths, days: 2, seed: 4, antithetic: false });
    for (const day of [0, 1]) {
      const standardized = dailyShocks(sim.cumulative, paths, 2, day).map(x => (x - studentT.location) / studentT.scale);
      const sorted = standardized.sort((a, b) => a - b);
      const ks = Math.max(...sorted.map((x, i) => Math.max((i + 1) / paths - studentTCdf(x, studentT.dof), studentTCdf(x, studentT.dof) - i / paths)));
      expect(ks).toBeLessThan(1.628 / Math.sqrt(paths));
    }
  });

  // E[e_d^2] = E[h_d] m2 with m2 the residuals' mean square, so E[h_{d+1}] = omega + (alpha m2 + beta) E[h_d]
  it("follows the GARCH model's expected variance day by day", () => {
    const days = 20;
    const sim = simulate(garch, { paths, days, seed: 5, antithetic: false });
    const m2 = garch.residuals.reduce((s, z) => s + z * z, 0) / garch.residuals.length;
    let expectedH = garch.nextVariance;
    for (let day = 0; day < days; day++) {
      const squares = dailyShocks(sim.cumulative, paths, days, day).map(x => (x - garch.mu) ** 2);
      const { mean, standardError } = meanAndStandardError(squares);
      expect(Math.abs(mean - expectedH * m2), `day ${day + 1}`).toBeLessThan(4 * standardError);
      expectedH = garch.omega + (garch.alpha * m2 + garch.beta) * expectedH;
    }
  });

  it('resamples only the residuals, starting from the next-day variance', () => {
    const sim = simulate(garch, { paths: 50, days: 1, seed: 6, antithetic: false });
    const allowed = new Set(garch.residuals.map(z => (garch.mu + Math.sqrt(garch.nextVariance) * z).toPrecision(12)));
    for (let p = 0; p < 50; p++) expect(allowed.has(sim.cumulative[p].toPrecision(12))).toBe(true);
  });
});

describe('summarize', () => {
  it('measures drawdowns from a running peak that includes the start', () => {
    // Prices 1.1, 0.88, 1.21: the worst fall is 20% from 1.1, and the path ends up 21%
    const cumulative = new Float64Array([Math.log(1.1), Math.log(0.88), Math.log(1.21), Math.log(0.95), Math.log(0.9), Math.log(0.85)]);
    const summary = summarize({ paths: 2, days: 3, antithetic: false, cumulative }, [0.5], 0.5, [0.1, 0.15, 0.2, 0.21]);
    expect(summary.drawdownProbabilities).toEqual([1, 1, 0.5, 0]);
    expect(summary.mean).toBeCloseTo((0.21 - 0.15) / 2, 12);
  });

  it('shrinks the standard error with antithetic pairs', () => {
    for (const m of fixture.models) {
      const without = fixture.simulations.find(s => s.model === m.kind && !s.antithetic)!.summary.standardError;
      const withPairs = fixture.simulations.find(s => s.model === m.kind && s.antithetic)!.summary.standardError;
      expect(withPairs, m.kind).toBeLessThan(without / 4);
    }
  });

  it('needs an even number of antithetic paths', () => {
    expect(() => simulate(gbm, { paths: 3, days: 2, seed: 1, antithetic: true })).toThrow();
  });
});

describe('truncate', () => {
  it('keeps the first days of every path', () => {
    const sim = simulate(gbm, { paths: 6, days: 10, seed: 3, antithetic: true });
    const short = truncate(sim, 4);
    expect([short.paths, short.days, short.antithetic]).toEqual([6, 4, true]);
    for (let p = 0; p < 6; p++) {
      expect(Array.from(short.cumulative.subarray(p * 4, p * 4 + 4))).toEqual(Array.from(sim.cumulative.subarray(p * 10, p * 10 + 4)));
    }
  });
});
