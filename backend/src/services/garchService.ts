import NodeCache from 'node-cache';
import { fitGarch11, garchForecastVariance } from '../models/garch';
import { logReturns, periodsPerYear } from '../models/returns';

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
  logLikelihood: number;
  longRunVolatility: number;
  currentVolatility: number;
  conditionalVolatility: VolatilityPoint[];
  forecast: VolatilityForecast[];
}

export function fitGarch(prices: number[], timestamps: number[], symbol: string): GarchResult {
  const cacheKey = `garch_${symbol}_${timestamps[0]}_${timestamps[timestamps.length - 1]}`;
  const cached = cache.get<GarchResult>(cacheKey);
  if (cached) return cached;

  if (prices.length < 15) {
    throw new Error('Insufficient data for GARCH model (minimum 15 observations required)');
  }

  const fit = fitGarch11(logReturns(prices));
  const ppy = periodsPerYear(timestamps);
  const annFactor = Math.sqrt(ppy);

  // fit.variance[i] is the variance of returns[i + 1], the price change ending at timestamps[i + 2]
  const conditionalVol: VolatilityPoint[] = fit.variance.map((h, i) => ({
    timestamp: new Date(timestamps[i + 2]).toISOString(),
    annualizedVolatility: Math.sqrt(Math.max(h, 0)) * annFactor * 100,
  }));

  const currentVol = Math.sqrt(fit.variance[fit.variance.length - 1]) * annFactor * 100;
  const longRunVol = Math.sqrt(fit.longRunVariance) * annFactor * 100;

  // Multi-step ahead forecasts (1, 7, 14, 30 day horizons in calendar days)
  const forecastHorizons = [1, 7, 14, 30];
  const forecast: VolatilityForecast[] = forecastHorizons.map(days => {
    const periods = Math.max(1, Math.round((days / 365.25) * ppy));
    return {
      horizon: days,
      annualizedVolatility: Math.sqrt(Math.max(garchForecastVariance(fit, periods), 0)) * annFactor * 100,
    };
  });

  const result: GarchResult = {
    symbol,
    modelType: 'GARCH(1,1)',
    omega: fit.omega,
    alpha: fit.alpha,
    beta: fit.beta,
    persistence: fit.persistence,
    logLikelihood: fit.logLikelihood,
    longRunVolatility: longRunVol,
    currentVolatility: currentVol,
    conditionalVolatility: conditionalVol,
    forecast,
  };

  cache.set(cacheKey, result);
  return result;
}
