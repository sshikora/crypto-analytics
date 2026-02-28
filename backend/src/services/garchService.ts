import NodeCache from 'node-cache';

const cache = new NodeCache({ stdTTL: 300 });

export interface VolatilityPoint {
  timestamp: string;
  annualizedVolatility: number;
}

export interface VolatilityForecast {
  horizon: number;
  annualizedVolatility: number;
}

export interface GarchResult {
  symbol: string;
  modelType: string;
  omega: number;
  alpha: number;
  beta: number;
  persistence: number;
  longRunVolatility: number;
  currentVolatility: number;
  conditionalVolatility: VolatilityPoint[];
  forecast: VolatilityForecast[];
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

export function fitGarch(prices: number[], timestamps: number[], symbol: string): GarchResult {
  const cacheKey = `garch_${symbol}_${timestamps[0]}_${timestamps[timestamps.length - 1]}`;
  const cached = cache.get<GarchResult>(cacheKey);
  if (cached) return cached;

  if (prices.length < 15) {
    throw new Error('Insufficient data for GARCH model (minimum 15 observations required)');
  }

  // Compute log returns: returns[t] = log(prices[t+1] / prices[t])
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    returns.push(Math.log(prices[i] / prices[i - 1]));
  }

  const n = returns.length;
  const mu = returns.reduce((s, r) => s + r, 0) / n;
  const residuals = returns.map(r => r - mu);
  const sampleVar = residuals.reduce((s, e) => s + e * e, 0) / n;

  // Fit GARCH(1,1) via maximum likelihood (Nelder-Mead on log-params)
  const x0 = [Math.log(sampleVar * 0.05), Math.log(0.08), Math.log(0.87)];
  const logParams = nelderMead(
    lp => garchNegLogLik(lp, residuals, sampleVar),
    x0
  );

  let omega = Math.exp(logParams[0]);
  let alpha = Math.exp(logParams[1]);
  let beta = Math.exp(logParams[2]);

  // Clamp to stationary region if optimizer drifted
  if (alpha + beta >= 1) {
    const scale = 0.999 / (alpha + beta);
    alpha *= scale;
    beta *= scale;
  }

  const persistence = alpha + beta;

  // Annualization factor from average inter-observation period
  const avgPeriodMs = (timestamps[timestamps.length - 1] - timestamps[0]) / (timestamps.length - 1);
  const periodsPerYear = (365.25 * 24 * 60 * 60 * 1000) / avgPeriodMs;
  const annFactor = Math.sqrt(periodsPerYear);

  // Compute conditional variance series via GARCH recursion
  // h[t] is variance of returns[t], t = 1..n-1
  let h = sampleVar;
  const conditionalVol: VolatilityPoint[] = [];

  for (let t = 1; t < n; t++) {
    h = omega + alpha * residuals[t - 1] ** 2 + beta * h;
    conditionalVol.push({
      // returns[t] corresponds to price change ending at timestamps[t+1]
      timestamp: new Date(timestamps[t + 1]).toISOString(),
      annualizedVolatility: Math.sqrt(Math.max(h, 0)) * annFactor * 100,
    });
  }

  const currentVariance = h;
  const currentVol = Math.sqrt(currentVariance) * annFactor * 100;

  // Long-run unconditional volatility
  const longRunVar = persistence < 1 ? omega / (1 - persistence) : currentVariance;
  const longRunVol = Math.sqrt(longRunVar) * annFactor * 100;

  // Multi-step ahead forecasts (1, 7, 14, 30 day horizons in calendar days)
  const forecastHorizons = [1, 7, 14, 30];
  const forecast: VolatilityForecast[] = forecastHorizons.map(days => {
    const periods = Math.max(1, Math.round((days / 365.25) * periodsPerYear));
    // k-step ahead GARCH(1,1) forecast:
    // h_{T+k} = longRunVar + persistence^(k-1) * (h_{T+1} - longRunVar)
    const forecastVar = longRunVar + Math.pow(persistence, periods - 1) * (currentVariance - longRunVar);
    return {
      horizon: days,
      annualizedVolatility: Math.sqrt(Math.max(forecastVar, 0)) * annFactor * 100,
    };
  });

  const result: GarchResult = {
    symbol,
    modelType: 'GARCH(1,1)',
    omega,
    alpha,
    beta,
    persistence,
    longRunVolatility: longRunVol,
    currentVolatility: currentVol,
    conditionalVolatility: conditionalVol,
    forecast,
  };

  cache.set(cacheKey, result);
  return result;
}
