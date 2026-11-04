import { leastSquares } from './linearRegression';

// Long-only, fully invested portfolios: weights are non-negative and sum to 1. validation/cql_validation/portfolio.py
// is the reference.

const MAX_ITERATIONS = 500;
const RELATIVE_TOLERANCE = 1e-12;

export interface FrontierPoint {
  weights: number[];
  expectedReturn: number;
  volatility: number;
}

function multiply(cov: number[][], w: number[]): number[] {
  return cov.map(row => row.reduce((s, c, j) => s + c * w[j], 0));
}

function dot(a: number[], b: number[]): number {
  return a.reduce((s, x, i) => s + x * b[i], 0);
}

export function portfolioVariance(w: number[], cov: number[][]): number {
  return dot(w, multiply(cov, w));
}

// Each asset's share of portfolio variance, w_i (Sigma w)_i / w' Sigma w; the shares sum to 1
export function riskContributions(w: number[], cov: number[][]): number[] {
  const marginal = multiply(cov, w);
  const variance = dot(w, marginal);
  return w.map((x, i) => (x * marginal[i]) / variance);
}

// Minimizes w' Sigma w / 2 + c'w over the simplex by the primal active-set method (Nocedal and Wright, Algorithm 16.3),
// starting from equal weights. Each iteration solves the problem with only the sum constraint on the assets not held
// at zero, then either moves there, stops at the first weight to reach zero, or releases a zero weight whose
// multiplier is negative. Sigma must be positive definite.
function simplexQuadratic(unscaledCov: number[][], unscaledC: number[]): number[] {
  const n = unscaledCov.length;
  // Daily variances are around 1e-3; scaling to unit average variance balances them against the constraint's ones in
  // each linear solve, without changing the solution
  const scale = unscaledCov.reduce((s, row, i) => s + row[i], 0) / n;
  const cov = unscaledCov.map(row => row.map(v => v / scale));
  const c = unscaledC.map(v => v / scale);
  const w = new Array<number>(n).fill(1 / n);
  const atZero = new Set<number>();

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    const free = [...Array(n).keys()].filter(i => !atZero.has(i));
    // [Sigma_FF 1; 1' 0] [x; -nu] = [-c_F; 1]
    const k = free.length;
    const kkt = free.map(i => [...free.map(j => cov[i][j]), 1]);
    kkt.push([...new Array<number>(k).fill(1), 0]);
    const solution = leastSquares(kkt, [...free.map(i => -c[i]), 1]).coefficients;
    const target = solution.slice(0, k);

    if (target.every(x => x >= 0)) {
      free.forEach((i, f) => (w[i] = target[f]));
      // Optimal when every asset held at zero has gradient at least the common gradient of the held assets
      const gradient = multiply(cov, w).map((g, i) => g + c[i]);
      const level = -solution[k];
      const scale = Math.max(...gradient.map(Math.abs), Number.MIN_VALUE);
      let release = -1;
      let worst = -RELATIVE_TOLERANCE * scale;
      for (const i of atZero) {
        if (gradient[i] - level < worst) {
          worst = gradient[i] - level;
          release = i;
        }
      }
      if (release < 0) return w;
      atZero.delete(release);
      continue;
    }

    // Move towards the target until the first held weight reaches zero
    let step = 1;
    let blocking = -1;
    free.forEach((i, f) => {
      if (target[f] < w[i]) {
        const ratio = w[i] / (w[i] - target[f]);
        if (ratio < step) {
          step = ratio;
          blocking = i;
        }
      }
    });
    free.forEach((i, f) => (w[i] += step * (target[f] - w[i])));
    w[blocking] = 0;
    atZero.add(blocking);
  }
  throw new Error('The active-set method did not converge');
}

export function minimumVariance(cov: number[][]): number[] {
  return simplexQuadratic(cov, new Array<number>(cov.length).fill(0));
}

// The frontier at evenly spaced target returns, from the minimum-variance portfolio to the asset with the largest
// mean. For a risk aversion t the weights minimize w' Sigma w / 2 - t mean'w, whose return rises continuously with
// t, so each target's t is found by bisection.
export function efficientFrontier(cov: number[][], mean: number[], points: number): FrontierPoint[] {
  const point = (weights: number[]): FrontierPoint => ({
    weights,
    expectedReturn: dot(weights, mean),
    volatility: Math.sqrt(portfolioVariance(weights, cov)),
  });
  const solve = (t: number) => simplexQuadratic(cov, mean.map(m => -t * m));

  const lowest = point(minimumVariance(cov));
  const best = mean.indexOf(Math.max(...mean));
  const highest = point(mean.map((_, i) => (i === best ? 1 : 0)));
  if (points < 2 || highest.expectedReturn <= lowest.expectedReturn) return [lowest];

  const tolerance = RELATIVE_TOLERANCE * Math.max(...mean.map(Math.abs));
  const frontier = [lowest];
  for (let p = 1; p < points - 1; p++) {
    const target = lowest.expectedReturn + ((highest.expectedReturn - lowest.expectedReturn) * p) / (points - 1);
    let low = 0;
    let high = 1;
    while (dot(solve(high), mean) < target) high *= 2;
    let weights = solve(high);
    for (let i = 0; i < 200 && Math.abs(dot(weights, mean) - target) > tolerance; i++) {
      const middle = (low + high) / 2;
      weights = solve(middle);
      if (dot(weights, mean) < target) low = middle;
      else high = middle;
    }
    frontier.push(point(weights));
  }
  frontier.push(highest);
  return frontier;
}

// Equal risk contributions, by Spinu (2013): y minimizes y' Sigma y / 2 - sum(b log y) with b = 1/n, a strictly
// convex problem, and w = y / sum(y). Newton's method with backtracking that keeps y positive.
export function riskParity(cov: number[][]): number[] {
  const n = cov.length;
  const b = 1 / n;
  const objective = (y: number[]) => 0.5 * portfolioVariance(y, cov) - y.reduce((s, v) => s + b * Math.log(v), 0);
  let y = cov.map((row, i) => b / Math.sqrt(row[i]));

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    const sigmaY = multiply(cov, y);
    const gradient = sigmaY.map((g, i) => g - b / y[i]);
    // y_i (Sigma y)_i - b is each asset's distance from its risk budget
    if (Math.max(...y.map((v, i) => Math.abs(v * gradient[i]))) <= RELATIVE_TOLERANCE * b) {
      const total = y.reduce((s, v) => s + v, 0);
      return y.map(v => v / total);
    }
    const hessian = cov.map((row, i) => row.map((v, j) => v + (i === j ? b / (y[i] * y[i]) : 0)));
    const direction = leastSquares(hessian, gradient.map(g => -g)).coefficients;

    const current = objective(y);
    const slope = dot(gradient, direction);
    let step = 1;
    for (;;) {
      const next = y.map((v, i) => v + step * direction[i]);
      if (next.every(v => v > 0) && objective(next) <= current + 1e-4 * step * slope) {
        y = next;
        break;
      }
      step /= 2;
    }
  }
  throw new Error("Newton's method did not converge");
}
