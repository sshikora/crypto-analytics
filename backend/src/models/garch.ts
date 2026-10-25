import { mean } from './returns';

export interface Garch11Fit {
  omega: number;
  alpha: number;
  beta: number;
  persistence: number;
  logLikelihood: number;
  // h[t] for t = 1..n-1, the variance of returns[t]
  variance: number[];
  // One-step-ahead variance h[T+1]
  nextVariance: number;
  longRunVariance: number;
}

// Nelder-Mead simplex optimizer for unconstrained minimization
function nelderMead(
  f: (x: number[]) => number,
  x0: number[],
  maxIter = 600,
  tol = 1e-8
): number[] {
  const n = x0.length;
  const simplex: number[][] = [x0.slice()];
  for (let i = 0; i < n; i++) {
    const v = x0.slice();
    v[i] += v[i] !== 0 ? Math.abs(v[i]) * 0.1 : 0.1;
    simplex.push(v);
  }

  let fvals = simplex.map(f);

  for (let iter = 0; iter < maxIter; iter++) {
    // Sort vertices by function value
    const order = fvals.map((v, i) => i).sort((a, b) => fvals[a] - fvals[b]);
    const s = order.map(i => simplex[i].slice());
    const fv = order.map(i => fvals[i]);
    for (let i = 0; i <= n; i++) {
      simplex[i] = s[i];
      fvals[i] = fv[i];
    }

    if (fvals[n] - fvals[0] < tol) break;

    // Centroid of all but worst
    const centroid = new Array(n).fill(0) as number[];
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) centroid[j] += simplex[i][j] / n;
    }

    // Reflect
    const xr = centroid.map((c, j) => c + (c - simplex[n][j]));
    const fr = f(xr);

    if (fr < fvals[0]) {
      // Expand
      const xe = centroid.map((c, j) => c + 2 * (xr[j] - c));
      const fe = f(xe);
      if (fe < fr) { simplex[n] = xe; fvals[n] = fe; }
      else { simplex[n] = xr; fvals[n] = fr; }
    } else if (fr < fvals[n - 1]) {
      simplex[n] = xr; fvals[n] = fr;
    } else {
      // Contract
      const xc = centroid.map((c, j) => c + 0.5 * (simplex[n][j] - c));
      const fc = f(xc);
      if (fc < fvals[n]) {
        simplex[n] = xc; fvals[n] = fc;
      } else {
        // Shrink
        for (let i = 1; i <= n; i++) {
          simplex[i] = simplex[0].map((b, j) => b + 0.5 * (simplex[i][j] - b));
          fvals[i] = f(simplex[i]);
        }
      }
    }
  }

  return simplex[0];
}

// GARCH(1,1) negative log-likelihood using log-parameterization
// logParams = [log(omega), log(alpha), log(beta)]
function garchNegLogLik(logParams: number[], residuals: number[], initVariance: number): number {
  const omega = Math.exp(logParams[0]);
  const alpha = Math.exp(logParams[1]);
  const beta = Math.exp(logParams[2]);

  if (alpha + beta >= 0.9999) return 1e10;

  const n = residuals.length;
  let h = initVariance;
  let logLik = 0;

  for (let t = 1; t < n; t++) {
    h = omega + alpha * residuals[t - 1] ** 2 + beta * h;
    if (h <= 0 || !isFinite(h)) return 1e10;
    logLik += Math.log(h) + residuals[t] ** 2 / h;
  }

  return 0.5 * logLik;
}

// Gaussian GARCH(1,1) on log returns demeaned by their sample mean. h[0] is the sample variance and the t = 0
// term is excluded from the likelihood; validation/cql_validation/garch.py uses the same conventions.
export function fitGarch11(returns: number[]): Garch11Fit {
  const n = returns.length;
  const mu = mean(returns);
  const residuals = returns.map(r => r - mu);
  const sampleVar = residuals.reduce((s, e) => s + e * e, 0) / n;

  // Fit GARCH(1,1) via maximum likelihood (Nelder-Mead on log-params)
  const x0 = [Math.log(sampleVar * 0.05), Math.log(0.08), Math.log(0.87)];
  const logParams = nelderMead(
    lp => garchNegLogLik(lp, residuals, sampleVar),
    x0
  );

  const omega = Math.exp(logParams[0]);
  let alpha = Math.exp(logParams[1]);
  let beta = Math.exp(logParams[2]);

  // Clamp to stationary region if optimizer drifted
  if (alpha + beta >= 1) {
    const scale = 0.999 / (alpha + beta);
    alpha *= scale;
    beta *= scale;
  }

  const persistence = alpha + beta;
  const logLikelihood =
    -garchNegLogLik([Math.log(omega), Math.log(alpha), Math.log(beta)], residuals, sampleVar) -
    0.5 * (n - 1) * Math.log(2 * Math.PI);

  let h = sampleVar;
  const variance: number[] = [];
  for (let t = 1; t < n; t++) {
    h = omega + alpha * residuals[t - 1] ** 2 + beta * h;
    variance.push(h);
  }

  const nextVariance = omega + alpha * residuals[n - 1] ** 2 + beta * h;
  const longRunVariance = persistence < 1 ? omega / (1 - persistence) : nextVariance;

  return { omega, alpha, beta, persistence, logLikelihood, variance, nextVariance, longRunVariance };
}

// k-step ahead forecast: h[T+k] = longRun + persistence^(k-1) * (h[T+1] - longRun)
export function garchForecastVariance(fit: Garch11Fit, steps: number): number {
  return fit.longRunVariance + Math.pow(fit.persistence, steps - 1) * (fit.nextVariance - fit.longRunVariance);
}
