import { leastSquares } from './linearRegression';
import { mean } from './returns';

// Crypto trades every day, so the components cover 7 and 30 days rather than Corsi's 5 and 22 trading days
const WEEK = 7;
const MONTH = 30;

export interface HarFit {
  intercept: number;
  daily: number;
  weekly: number;
  monthly: number;
  rSquared: number;
  nobs: number;
}

function regressors(history: number[], t: number): number[] {
  return [
    1,
    history[t],
    mean(history.slice(t - WEEK + 1, t + 1)),
    mean(history.slice(t - MONTH + 1, t + 1)),
  ];
}

// HAR-RV (Corsi 2009): RV[t+1] = b0 + bd RV[t] + bw mean(RV over 7 days) + bm mean(RV over 30 days).
// With daily closes only, each day's realized variance is its squared log return.
// validation/cql_validation/har.py uses the same conventions.
export function fitHar(realizedVariance: number[]): HarFit {
  const X: number[][] = [];
  const y: number[] = [];
  for (let t = MONTH - 1; t < realizedVariance.length - 1; t++) {
    X.push(regressors(realizedVariance, t));
    y.push(realizedVariance[t + 1]);
  }

  const { coefficients, rSquared } = leastSquares(X, y);
  const [intercept, daily, weekly, monthly] = coefficients;
  return { intercept, daily, weekly, monthly, rSquared, nobs: y.length };
}

// Daily variance forecasts for the next `steps` days, feeding each forecast back in as that day's RV
export function harForecastVariance(fit: HarFit, realizedVariance: number[], steps: number): number[] {
  const history = realizedVariance.slice();
  const forecasts: number[] = [];
  for (let s = 0; s < steps; s++) {
    const [one, d, w, m] = regressors(history, history.length - 1);
    const next = fit.intercept * one + fit.daily * d + fit.weekly * w + fit.monthly * m;
    history.push(next);
    forecasts.push(next);
  }
  return forecasts;
}
