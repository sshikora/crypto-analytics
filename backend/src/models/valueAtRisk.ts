import { logGamma, normalPdf, normalQuantile, studentTPdf, studentTQuantile } from './distributions';
import { nelderMead } from './optimize';
import { mean } from './returns';

// One-day VaR and expected shortfall on simple returns, so a loss is exactly -R times the amount held.
// Both are positive losses as a fraction of the position at tail probability alpha = 1 - confidence.
// validation/cql_validation/var.py uses the same conventions.

const MIN_EXCESS_DOF = 1e-6;
const MAX_RESTARTS = 10;

export type VarMethod = 'historical' | 'normal' | 'studentT';

export interface TailRisk {
  valueAtRisk: number;
  expectedShortfall: number;
}

export interface StudentTFit {
  location: number;
  scale: number;
  dof: number;
  logLikelihood: number;
}

// numpy's default quantile: linear interpolation between order statistics at position (n - 1) * p
export function quantile(values: number[], p: number): number {
  const sorted = values.slice().sort((a, b) => a - b);
  const position = (sorted.length - 1) * p;
  const below = Math.floor(position);
  const above = Math.min(below + 1, sorted.length - 1);
  return sorted[below] + (position - below) * (sorted[above] - sorted[below]);
}

export function historicalTailRisk(returns: number[], alpha: number): TailRisk {
  const q = quantile(returns, alpha);
  return { valueAtRisk: -q, expectedShortfall: -mean(returns.filter(r => r <= q)) };
}

export function normalTailRisk(returns: number[], alpha: number): TailRisk {
  const mu = mean(returns);
  const sigma = Math.sqrt(returns.reduce((s, r) => s + (r - mu) ** 2, 0) / (returns.length - 1));
  const z = normalQuantile(alpha);
  return {
    valueAtRisk: -(mu + sigma * z),
    expectedShortfall: -(mu - (sigma * normalPdf(z)) / alpha),
  };
}

function studentTLogLikelihood(x: number[], location: number, scale: number, dof: number): number {
  const constant = logGamma((dof + 1) / 2) - logGamma(dof / 2) - 0.5 * Math.log(dof * Math.PI) - Math.log(scale);
  let sum = 0;
  for (const v of x) sum += Math.log1p(((v - location) / scale) ** 2 / dof);
  return x.length * constant - ((dof + 1) / 2) * sum;
}

// Maximum likelihood for location, scale and degrees of freedom. Returns are fitted in percent so the three
// parameters have similar scales, and dof = 2 + exp(p) keeps the variance finite. `start` warm-starts a refit.
// Very stable prices push dof towards 2, so dof - 2 has a floor: below it the likelihood is flat, which stops the
// search drifting towards the boundary and keeps dof - 2 from rounding to 0.
export function fitStudentT(returns: number[], start?: StudentTFit): StudentTFit {
  const x = returns.map(r => r * 100);
  const mu = mean(x);
  const sd = Math.sqrt(x.reduce((s, v) => s + (v - mu) ** 2, 0) / (x.length - 1));
  const x0 = start
    ? [start.location * 100, Math.log(start.scale * 100), Math.log(Math.max(start.dof - 2, MIN_EXCESS_DOF))]
    : [mu, Math.log(sd / Math.SQRT2), 0];

  const dofOf = (le: number) => 2 + Math.max(Math.exp(le), MIN_EXCESS_DOF);
  const negLogLikelihood = ([loc, ls, le]: number[]) => -studentTLogLikelihood(x, loc, Math.exp(ls), dofOf(le));

  // Nelder-Mead can stall on a collapsed simplex far from a poor start; restarting from its result rebuilds the
  // simplex, and stops once a restart no longer improves the likelihood
  let best = nelderMead(negLogLikelihood, x0, 2000, 1e-10);
  for (let restart = 0; restart < MAX_RESTARTS; restart++) {
    const next = nelderMead(negLogLikelihood, best, 2000, 1e-10);
    const improvement = negLogLikelihood(best) - negLogLikelihood(next);
    best = next;
    if (improvement < 1e-9) break;
  }
  const [location, logScale, logExcess] = best;

  const dof = dofOf(logExcess);
  const scale = Math.exp(logScale) / 100;
  return { location: location / 100, scale, dof, logLikelihood: studentTLogLikelihood(returns, location / 100, scale, dof) };
}

export function studentTTailRisk(fit: StudentTFit, alpha: number): TailRisk {
  const q = studentTQuantile(alpha, fit.dof);
  const tail = ((studentTPdf(q, fit.dof) / alpha) * (fit.dof + q * q)) / (fit.dof - 1);
  return {
    valueAtRisk: -(fit.location + fit.scale * q),
    expectedShortfall: -(fit.location - fit.scale * tail),
  };
}
