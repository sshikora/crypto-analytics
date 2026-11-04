import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { normalCdf, regularizedGammaP, studentTCdf } from './distributions';
import { Random } from './random';

interface StreamReference {
  seed: number;
  raw: string[];
  uniforms: number[];
  normals: number[];
  gammas: Record<string, number[]>;
}

const fixture = JSON.parse(
  readFileSync(join(__dirname, '..', 'test', 'fixtures', 'monte_carlo', 'btc_daily.json'), 'utf8')
) as { streams: StreamReference[] };

function relativeError(actual: number, expected: number): number {
  return Math.abs(actual - expected) / Math.abs(expected);
}

// Largest gap between the sample's empirical CDF and the model's
function kolmogorovSmirnov(sample: number[], cdf: (x: number) => number): number {
  const sorted = sample.slice().sort((a, b) => a - b);
  const n = sorted.length;
  return Math.max(...sorted.map((x, i) => Math.max((i + 1) / n - cdf(x), cdf(x) - i / n)));
}

// Critical value at the 1% level for large samples
const ksCritical = (n: number) => 1.628 / Math.sqrt(n);

describe.each(fixture.streams)('Random against numpy (seed $seed)', (ref) => {
  const random = new Random(ref.seed);
  const raw = ref.raw.map(() => random.nextUint64().toString());
  const uniforms = ref.uniforms.map(() => random.uniform());
  const normals = ref.normals.map(() => random.normal());
  const gammas = Object.entries(ref.gammas).map(([shape, values]) => values.map(() => random.gamma(Number(shape))));

  it("matches numpy's SFC64 bit for bit", () => {
    expect(raw).toEqual(ref.raw);
  });

  it("gives numpy's Generator.random() exactly", () => {
    expect(uniforms).toEqual(ref.uniforms);
  });

  // log, sin and cos may differ in the last bit between JavaScript and the C library behind Python
  it('gives the same normals and gammas to rounding', () => {
    normals.forEach((z, i) => expect(relativeError(z, ref.normals[i])).toBeLessThan(1e-13));
    Object.values(ref.gammas).forEach((values, s) =>
      values.forEach((g, i) => expect(relativeError(gammas[s][i], g)).toBeLessThan(1e-13))
    );
  });
});

describe('Random distributions', () => {
  const n = 20000;

  it('repeats a seed and differs between seeds', () => {
    const draw = (seed: number) => {
      const random = new Random(seed);
      return Array.from({ length: 5 }, () => random.normal());
    };
    expect(draw(3)).toEqual(draw(3));
    expect(draw(3)).not.toEqual(draw(4));
  });

  it('gives uniforms in [0, 1) with the right distribution', () => {
    const random = new Random(5);
    const u = Array.from({ length: n }, () => random.uniform());
    expect(Math.min(...u)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...u)).toBeLessThan(1);
    expect(kolmogorovSmirnov(u, x => x)).toBeLessThan(ksCritical(n));
  });

  it('gives standard normals', () => {
    const random = new Random(6);
    expect(kolmogorovSmirnov(Array.from({ length: n }, () => random.normal()), normalCdf)).toBeLessThan(ksCritical(n));
  });

  it.each([1, 1.7125, 4, 25])('gives gammas with shape %s', (shape) => {
    const random = new Random(7);
    const sample = Array.from({ length: n }, () => random.gamma(shape));
    expect(kolmogorovSmirnov(sample, x => regularizedGammaP(shape, x))).toBeLessThan(ksCritical(n));
  });

  it('uses a test that rejects slightly wrong distributions', () => {
    const random = new Random(6);
    const normals = Array.from({ length: n }, () => random.normal());
    expect(kolmogorovSmirnov(normals, x => normalCdf(x / 1.05))).toBeGreaterThan(ksCritical(n));
    const gammas = Array.from({ length: n }, () => random.gamma(4));
    expect(kolmogorovSmirnov(gammas, x => regularizedGammaP(4.1, x))).toBeGreaterThan(ksCritical(n));
  });

  it('gives Student-t draws from a normal over a scaled chi-square', () => {
    const random = new Random(8);
    const dof = 3.425;
    const sample = Array.from({ length: n }, () => {
      const z = random.normal();
      return z * Math.sqrt(dof / (2 * random.gamma(dof / 2)));
    });
    expect(kolmogorovSmirnov(sample, x => studentTCdf(x, dof))).toBeLessThan(ksCritical(n));
  });
});
