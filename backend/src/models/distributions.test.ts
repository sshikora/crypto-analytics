import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  chiSquareSurvival,
  logGamma,
  normalCdf,
  normalPdf,
  normalQuantile,
  regularizedGammaP,
  regularizedGammaQ,
  regularizedIncompleteBeta,
  studentTCdf,
  studentTPdf,
  studentTQuantile,
} from './distributions';

type Case = Record<string, number>;
const scipy = JSON.parse(
  readFileSync(join(__dirname, '..', 'test', 'fixtures', 'distributions', 'scipy.json'), 'utf8')
) as Record<string, Case[]>;

function relativeError(actual: number, expected: number): number {
  return expected === 0 ? Math.abs(actual) : Math.abs(actual - expected) / Math.abs(expected);
}

function expectAll(cases: Case[], compute: (c: Case) => number, tolerance: number) {
  const failures = cases
    .map(c => ({ ...c, actual: compute(c), error: relativeError(compute(c), c.value) }))
    .filter(c => !(c.error <= tolerance));
  expect(failures).toEqual([]);
}

describe('probability functions against scipy', () => {
  it('logGamma', () => expectAll(scipy.logGamma, c => logGamma(c.x), 1e-13));
  it('regularizedGammaP', () => expectAll(scipy.gammaP, c => regularizedGammaP(c.a, c.x), 1e-13));
  it('regularizedGammaQ', () => expectAll(scipy.gammaQ, c => regularizedGammaQ(c.a, c.x), 1e-12));
  it('regularizedIncompleteBeta', () =>
    expectAll(scipy.betaRegularized, c => regularizedIncompleteBeta(c.a, c.b, c.x), 1e-12));
  it('normalPdf', () => expectAll(scipy.normalPdf, c => normalPdf(c.x), 1e-14));
  it('normalCdf, including the far lower tail', () => expectAll(scipy.normalCdf, c => normalCdf(c.x), 1e-12));
  it('normalQuantile', () => expectAll(scipy.normalQuantile, c => normalQuantile(c.p), 1e-13));
  it('studentTPdf', () => expectAll(scipy.studentTPdf, c => studentTPdf(c.x, c.dof), 1e-12));
  it('studentTCdf', () => expectAll(scipy.studentTCdf, c => studentTCdf(c.x, c.dof), 1e-12));
  it('studentTQuantile', () => expectAll(scipy.studentTQuantile, c => studentTQuantile(c.p, c.dof), 1e-12));
  it('chiSquareSurvival', () => expectAll(scipy.chiSquareSurvival, c => chiSquareSurvival(c.x, c.dof), 1e-12));
});

describe('probability functions', () => {
  it('are symmetric where they should be', () => {
    expect(normalQuantile(0.975)).toBeCloseTo(-normalQuantile(0.025), 14);
    expect(studentTCdf(-1.3, 5) + studentTCdf(1.3, 5)).toBeCloseTo(1, 14);
  });

  it('handle the edges of the probability range', () => {
    expect(normalQuantile(0)).toBe(-Infinity);
    expect(normalQuantile(1)).toBe(Infinity);
    expect(studentTQuantile(0.5, 4)).toBe(0);
    expect(regularizedIncompleteBeta(2, 3, 0)).toBe(0);
    expect(regularizedIncompleteBeta(2, 3, 1)).toBe(1);
  });
});
