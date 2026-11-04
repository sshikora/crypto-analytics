import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { constantCorrelationShrinkage, ledoitWolf, sampleCovariance } from './covariance';

interface ShrunkReference {
  covariance: number[][];
  shrinkage: number;
}

interface PortfolioFixture {
  name: string;
  returns: number[][];
  reference: { sampleCovariance: number[][]; ledoitWolf: ShrunkReference; constantCorrelation: ShrunkReference };
}

const load = (name: string) =>
  JSON.parse(readFileSync(join(__dirname, '..', 'test', 'fixtures', 'portfolio', `${name}.json`), 'utf8')) as PortfolioFixture;

function largestRelativeGap(actual: number[][], expected: number[][]): number {
  const scale = Math.max(...expected.flat().map(Math.abs));
  return Math.max(...actual.flatMap((row, i) => row.map((v, j) => Math.abs(v - expected[i][j])))) / scale;
}

describe.each(['factor_250x12', 'wide_40x30'])('covariance against the Python reference (%s)', (name) => {
  const fixture = load(name);

  it('matches the sample covariance', () => {
    expect(largestRelativeGap(sampleCovariance(fixture.returns), fixture.reference.sampleCovariance)).toBeLessThan(1e-12);
  });

  // The reference is itself checked against scikit-learn's LedoitWolf when the fixture is written
  it("matches Ledoit-Wolf's covariance and shrinkage", () => {
    const shrunk = ledoitWolf(fixture.returns);
    expect(Math.abs(shrunk.shrinkage - fixture.reference.ledoitWolf.shrinkage)).toBeLessThan(1e-12);
    expect(largestRelativeGap(shrunk.covariance, fixture.reference.ledoitWolf.covariance)).toBeLessThan(1e-12);
  });

  // The reference is itself checked against PyPortfolioOpt when the fixture is written
  it("matches constant-correlation shrinkage's covariance and intensity", () => {
    const shrunk = constantCorrelationShrinkage(fixture.returns);
    expect(Math.abs(shrunk.shrinkage - fixture.reference.constantCorrelation.shrinkage)).toBeLessThan(1e-12);
    expect(largestRelativeGap(shrunk.covariance, fixture.reference.constantCorrelation.covariance)).toBeLessThan(1e-12);
  });
});

describe('constantCorrelationShrinkage', () => {
  it('keeps every variance and gives the target the average correlation', () => {
    const { returns } = load('factor_250x12');
    const n = returns.length;
    const s = sampleCovariance(returns).map(row => row.map(v => (v * (n - 1)) / n));
    const { covariance, shrinkage } = constantCorrelationShrinkage(returns);
    covariance.forEach((row, i) => expect(row[i]).toBeCloseTo(s[i][i], 15));

    // Off the diagonal, shrunk = delta * rbar * sd_i sd_j + (1 - delta) s_ij, so every pair implies the same rbar
    const p = s.length;
    const implied = (i: number, j: number) => (covariance[i][j] - (1 - shrinkage) * s[i][j]) / (shrinkage * Math.sqrt(s[i][i] * s[j][j]));
    let sum = 0;
    for (let i = 0; i < p; i++) for (let j = 0; j < p; j++) if (i !== j) sum += s[i][j] / Math.sqrt(s[i][i] * s[j][j]);
    const average = sum / (p * (p - 1));
    expect(implied(0, 1)).toBeCloseTo(average, 12);
    expect(implied(3, 7)).toBeCloseTo(average, 12);
  });
});

describe('ledoitWolf', () => {
  it('keeps the average variance and pulls covariances towards zero', () => {
    const { returns } = load('factor_250x12');
    const sample = sampleCovariance(returns).map(row => row.map(v => (v * (returns.length - 1)) / returns.length));
    const { covariance, shrinkage } = ledoitWolf(returns);
    const trace = (m: number[][]) => m.reduce((s, row, i) => s + row[i], 0);
    expect(trace(covariance)).toBeCloseTo(trace(sample), 15);
    expect(covariance[0][1]).toBeCloseTo((1 - shrinkage) * sample[0][1], 15);
  });

  it('shrinks more when there are more assets than days', () => {
    expect(ledoitWolf(load('wide_40x30').returns).shrinkage).toBeGreaterThan(ledoitWolf(load('factor_250x12').returns).shrinkage);
  });
});
