import { fitGarch11 } from './garch';
import { standardizedResiduals } from './garchDiagnostics';
import { Random } from './random';
import { mean } from './returns';
import { fitStudentT, historicalTailRisk } from './valueAtRisk';

// Price paths from three models of daily log returns. validation/cql_validation/monte_carlo.py uses the same
// conventions, including the order of draws, so both give the same paths from the same seed.
//
// Paths are drawn one at a time, every day of a path before the next. Antithetic paths come in pairs that share
// draws: the second path uses -z for the normal model, -t with the same gamma for the Student-t model, and the
// mirrored residual n - 1 - k for the bootstrap, whose residuals are sorted ascending.

export interface GbmModel {
  kind: 'gbm';
  mu: number;
  sigma: number;
}

export interface StudentTModel {
  kind: 'studentT';
  location: number;
  scale: number;
  dof: number;
}

// GARCH(1,1) variance with standardized residuals resampled in place of normal shocks
export interface GarchBootstrapModel {
  kind: 'garchBootstrap';
  mu: number;
  omega: number;
  alpha: number;
  beta: number;
  nextVariance: number;
  residuals: number[];
}

export type PathModel = GbmModel | StudentTModel | GarchBootstrapModel;

export interface SimulationOptions {
  paths: number;
  days: number;
  seed: number;
  antithetic: boolean;
}

export interface Simulation {
  paths: number;
  days: number;
  antithetic: boolean;
  // Cumulative log return of path p after day d + 1, at p * days + d
  cumulative: Float64Array;
}

export interface SimulationSummary {
  // fan[d][q]: the price relative after day d + 1 at the q-th requested probability
  fan: number[][];
  // The horizon's simple return: its mean, the mean's standard error, and VaR and ES as positive losses
  mean: number;
  standardError: number;
  valueAtRisk: number;
  expectedShortfall: number;
  // Share of paths whose largest fall from a running peak, counting the start, reaches each threshold
  drawdownProbabilities: number[];
}

export function gbmModel(logReturns: number[]): GbmModel {
  const mu = mean(logReturns);
  const variance = logReturns.reduce((s, r) => s + (r - mu) ** 2, 0) / (logReturns.length - 1);
  return { kind: 'gbm', mu, sigma: Math.sqrt(variance) };
}

export function studentTModel(logReturns: number[]): StudentTModel {
  const { location, scale, dof } = fitStudentT(logReturns);
  return { kind: 'studentT', location, scale, dof };
}

export function garchBootstrapModel(logReturns: number[]): GarchBootstrapModel {
  const fit = fitGarch11(logReturns);
  return {
    kind: 'garchBootstrap',
    mu: mean(logReturns),
    omega: fit.omega,
    alpha: fit.alpha,
    beta: fit.beta,
    nextVariance: fit.nextVariance,
    residuals: standardizedResiduals(logReturns, fit),
  };
}

export function simulate(model: PathModel, { paths, days, seed, antithetic }: SimulationOptions): Simulation {
  if (antithetic && paths % 2 !== 0) throw new Error('Antithetic paths come in pairs, so paths must be even');

  const random = new Random(seed);
  const cumulative = new Float64Array(paths * days);
  const width = antithetic ? 2 : 1;
  const sorted = model.kind === 'garchBootstrap' ? model.residuals.slice().sort((a, b) => a - b) : [];
  const n = sorted.length;

  for (let first = 0; first < paths; first += width) {
    let total = 0;
    let mirrorTotal = 0;
    let h = model.kind === 'garchBootstrap' ? model.nextVariance : 0;
    let mirrorH = h;

    for (let day = 0; day < days; day++) {
      let shock: number;
      let mirror: number;
      if (model.kind === 'gbm') {
        const z = random.normal();
        shock = model.mu + model.sigma * z;
        mirror = model.mu + model.sigma * -z;
      } else if (model.kind === 'studentT') {
        const z = random.normal();
        const t = z * Math.sqrt(model.dof / (2 * random.gamma(model.dof / 2)));
        shock = model.location + model.scale * t;
        mirror = model.location + model.scale * -t;
      } else {
        const k = Math.floor(random.uniform() * n);
        const e = Math.sqrt(h) * sorted[k];
        const mirrorE = Math.sqrt(mirrorH) * sorted[n - 1 - k];
        shock = model.mu + e;
        mirror = model.mu + mirrorE;
        h = model.omega + model.alpha * e * e + model.beta * h;
        mirrorH = model.omega + model.alpha * mirrorE * mirrorE + model.beta * mirrorH;
      }

      total += shock;
      cumulative[first * days + day] = total;
      if (antithetic) {
        mirrorTotal += mirror;
        cumulative[(first + 1) * days + day] = mirrorTotal;
      }
    }
  }

  return { paths, days, antithetic, cumulative };
}

// numpy's default quantile on already sorted values
function sortedQuantile(sorted: Float64Array, p: number): number {
  const position = (sorted.length - 1) * p;
  const below = Math.floor(position);
  const above = Math.min(below + 1, sorted.length - 1);
  return sorted[below] + (position - below) * (sorted[above] - sorted[below]);
}

export function summarize(simulation: Simulation, quantiles: number[], alpha: number, thresholds: number[]): SimulationSummary {
  const { paths, days, antithetic, cumulative } = simulation;

  const fan: number[][] = [];
  const column = new Float64Array(paths);
  for (let day = 0; day < days; day++) {
    for (let p = 0; p < paths; p++) column[p] = Math.exp(cumulative[p * days + day]);
    column.sort();
    fan.push(quantiles.map(q => sortedQuantile(column, q)));
  }

  const terminal: number[] = [];
  const drawdowns = new Array<number>(thresholds.length).fill(0);
  for (let p = 0; p < paths; p++) {
    let peak = 1;
    let worst = 0;
    let price = 1;
    for (let day = 0; day < days; day++) {
      price = Math.exp(cumulative[p * days + day]);
      peak = Math.max(peak, price);
      worst = Math.max(worst, 1 - price / peak);
    }
    terminal.push(price - 1);
    thresholds.forEach((threshold, i) => {
      if (worst >= threshold) drawdowns[i]++;
    });
  }

  // Antithetic pairs are dependent, so the standard error comes from the pair averages
  const independent = antithetic ? terminal.filter((_, i) => i % 2 === 0).map((r, i) => (r + terminal[2 * i + 1]) / 2) : terminal;
  const average = mean(independent);
  const variance = independent.reduce((s, r) => s + (r - average) ** 2, 0) / (independent.length - 1);
  const { valueAtRisk, expectedShortfall } = historicalTailRisk(terminal, alpha);

  return {
    fan,
    mean: mean(terminal),
    standardError: Math.sqrt(variance / independent.length),
    valueAtRisk,
    expectedShortfall,
    drawdownProbabilities: drawdowns.map(count => count / paths),
  };
}
