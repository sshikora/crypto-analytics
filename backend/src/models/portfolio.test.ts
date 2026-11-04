import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ledoitWolf, sampleCovariance } from './covariance';
import { efficientFrontier, minimumVariance, portfolioVariance, riskContributions, riskParity } from './portfolio';
import { simpleReturns } from './returns';

interface PortfolioFixture {
  returns: number[][];
  reference: {
    ledoitWolf: { covariance: number[][] };
    minimumVariance: number[];
    riskParity: number[];
    riskContributions: { minimumVariance: number[]; equalWeight: number[] };
    frontier: { weights: number[]; expectedReturn: number; volatility: number }[];
  };
}

const fixtureDir = join(__dirname, '..', 'test', 'fixtures');
const load = (name: string) => JSON.parse(readFileSync(join(fixtureDir, 'portfolio', `${name}.json`), 'utf8')) as PortfolioFixture;

const largestGap = (a: number[], b: number[]) => Math.max(...a.map((x, i) => Math.abs(x - b[i])));
const columnMeans = (returns: number[][]) =>
  returns[0].map((_, j) => returns.reduce((s, row) => s + row[j], 0) / returns.length);

// Optimality for min w' Sigma w over the simplex: every held asset has the same marginal variance, and every asset
// left out has at least that much
function expectOptimal(w: number[], cov: number[][], linear: number[] = w.map(() => 0)) {
  const gradient = cov.map((row, i) => row.reduce((s, c, j) => s + c * w[j], 0) + linear[i]);
  const held = gradient.filter((_, i) => w[i] > 0);
  const level = held[0];
  const scale = Math.max(...gradient.map(Math.abs));
  expect(Math.min(...w)).toBeGreaterThanOrEqual(0);
  expect(Math.abs(w.reduce((s, x) => s + x, 0) - 1)).toBeLessThan(1e-14);
  expect((Math.max(...held) - Math.min(...held)) / scale).toBeLessThan(1e-12);
  gradient.forEach((g, i) => {
    if (w[i] === 0) expect((g - level) / scale).toBeGreaterThan(-1e-12);
  });
}

describe.each(['factor_250x12', 'wide_40x30'])('portfolios against the Python reference (%s)', (name) => {
  const fixture = load(name);
  const cov = fixture.reference.ledoitWolf.covariance;

  it('finds the minimum-variance portfolio', () => {
    const w = minimumVariance(cov);
    expectOptimal(w, cov);
    expect(largestGap(w, fixture.reference.minimumVariance)).toBeLessThan(1e-10);
  });

  it('gives every asset the same share of risk in risk parity', () => {
    const w = riskParity(cov);
    const contributions = riskContributions(w, cov);
    expect(Math.max(...contributions) - Math.min(...contributions)).toBeLessThan(1e-12);
    expect(largestGap(w, fixture.reference.riskParity)).toBeLessThan(1e-8);
  });

  it('splits risk as the reference does', () => {
    const n = cov.length;
    expect(largestGap(riskContributions(fixture.reference.minimumVariance, cov), fixture.reference.riskContributions.minimumVariance)).toBeLessThan(1e-12);
    expect(largestGap(riskContributions(new Array(n).fill(1 / n), cov), fixture.reference.riskContributions.equalWeight)).toBeLessThan(1e-12);
  });

  it('traces the efficient frontier', () => {
    const mean = columnMeans(fixture.returns);
    const frontier = efficientFrontier(cov, mean, fixture.reference.frontier.length);
    expect(frontier).toHaveLength(fixture.reference.frontier.length);
    // Targets are evenly spaced, and the bisection stops within 1e-12 of the largest mean's size
    const first = frontier[0].expectedReturn;
    const spacing = (frontier[frontier.length - 1].expectedReturn - first) / (frontier.length - 1);
    const tolerance = 1e-12 * Math.max(...mean.map(Math.abs));
    frontier.forEach((point, p) => {
      const ref = fixture.reference.frontier[p];
      expect(largestGap(point.weights, ref.weights), `point ${p}`).toBeLessThan(1e-9);
      expect(Math.abs(point.expectedReturn - (first + p * spacing))).toBeLessThan(tolerance);
      expect(Math.abs(point.volatility - ref.volatility) / ref.volatility).toBeLessThan(1e-10);
    });
    for (let p = 1; p < frontier.length; p++) expect(frontier[p].volatility).toBeGreaterThan(frontier[p - 1].volatility);
  });
});

describe('portfolios against closed forms', () => {
  const fixture = JSON.parse(readFileSync(join(fixtureDir, 'performance', 'btc_eth_daily.json'), 'utf8')) as {
    coins: Record<string, { prices: number[] }>;
  };
  const btc = simpleReturns(fixture.coins.bitcoin.prices);
  const eth = simpleReturns(fixture.coins.ethereum.prices);
  const cov = sampleCovariance(btc.map((r, t) => [r, eth[t]]));
  const [[a, c], [, b]] = cov;

  it('splits two assets by the textbook minimum-variance formula', () => {
    const w = minimumVariance(cov);
    const btcWeight = Math.min(1, Math.max(0, (b - c) / (a + b - 2 * c)));
    expect(Math.abs(w[0] - btcWeight)).toBeLessThan(1e-14);
  });

  // With two assets, equal risk contributions means weights inverse to volatility, whatever the correlation
  it('weights two assets inversely to volatility in risk parity', () => {
    const w = riskParity(cov);
    const inverse = [1 / Math.sqrt(a), 1 / Math.sqrt(b)];
    const total = inverse[0] + inverse[1];
    expect(largestGap(w, inverse.map(x => x / total))).toBeLessThan(1e-12);
  });

  it('weights uncorrelated assets by inverse variance and inverse volatility', () => {
    const vols = [0.01, 0.02, 0.04, 0.05];
    const diagonal = vols.map((v, i) => vols.map((_, j) => (i === j ? v * v : 0)));
    const normalize = (x: number[]) => x.map(v => v / x.reduce((s, y) => s + y, 0));
    expect(largestGap(minimumVariance(diagonal), normalize(vols.map(v => 1 / (v * v))))).toBeLessThan(1e-14);
    expect(largestGap(riskParity(diagonal), normalize(vols.map(v => 1 / v)))).toBeLessThan(1e-12);
  });

  it('beats every random long-only portfolio on variance', () => {
    const cov12 = load('factor_250x12').reference.ledoitWolf.covariance;
    const best = portfolioVariance(minimumVariance(cov12), cov12);
    let seed = 1;
    const uniform = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let trial = 0; trial < 2000; trial++) {
      const raw = cov12.map(() => -Math.log(uniform()));
      const total = raw.reduce((s, x) => s + x, 0);
      expect(portfolioVariance(raw.map(x => x / total), cov12)).toBeGreaterThanOrEqual(best);
    }
  });

  it('holds only the highest-mean asset at the top of the frontier', () => {
    const fixture12 = load('factor_250x12');
    const mean = columnMeans(fixture12.returns);
    const frontier = efficientFrontier(fixture12.reference.ledoitWolf.covariance, mean, 5);
    const top = frontier[frontier.length - 1].weights;
    expect(top[mean.indexOf(Math.max(...mean))]).toBe(1);
  });
});
