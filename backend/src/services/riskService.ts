import NodeCache from 'node-cache';
import { getDailyPrices, StoredPrice } from '../repositories/priceHistoryRepository';
import { fitHar, harForecastVariance, HarFit } from '../models/har';
import { LinearDependenceError } from '../models/linearRegression';
import { ewmaVariance, rollingVolatility } from '../models/realizedVolatility';
import { logReturns, moments, periodsPerYear } from '../models/returns';

const cache = new NodeCache({ stdTTL: 3600 });

const MS_PER_DAY = 86_400_000;
const HISTORY_DAYS = 365;
const REALIZED_WINDOWS = [7, 30, 90];
const EWMA_DECAY = 0.94;
const FORECAST_HORIZONS = [1, 7, 30];
// The 30-day component uses the first 30 returns, so this leaves 90 observations to estimate 4 coefficients
const MIN_HAR_RETURNS = 120;
const COIN_ID_PATTERN = /^[a-z0-9-]{1,100}$/;

export interface RealizedVolatility {
  windowDays: number;
  annualizedVolatility: number | null;
}

export interface VolatilityForecast {
  model: string;
  coefficients: Omit<HarFit, 'rSquared' | 'nobs'>;
  rSquared: number;
  observations: number;
  horizons: { days: number; annualizedVolatility: number }[];
}

export interface RiskSummary {
  coinId: string;
  asOf: string | null;
  observations: number;
  missingDays: number;
  realizedVolatility: RealizedVolatility[];
  ewmaVolatility: number | null;
  returnDistribution: { skewness: number; excessKurtosis: number } | null;
  volatilityForecast: VolatilityForecast | null;
}

// Volatilities are annualized percentages, like the GARCH model's. Windows count stored observations,
// so a gap in the history widens a window in calendar terms; missingDays reports how many days are absent.
// HAR-RV on squared daily returns. Returns null when the model can't be estimated (a price that never moves)
// or when a negative coefficient would push any forecast variance to zero or below.
function forecastVolatility(returns: number[], annualize: (perPeriod: number) => number): VolatilityForecast | null {
  const realizedVariance = returns.map(r => r * r);
  let fit: HarFit;
  try {
    fit = fitHar(realizedVariance);
  } catch (error) {
    if (error instanceof LinearDependenceError) return null;
    throw error;
  }

  const daily = harForecastVariance(fit, realizedVariance, Math.max(...FORECAST_HORIZONS));
  if (daily.some(v => v <= 0)) return null;

  return {
    model: 'HAR-RV',
    coefficients: { intercept: fit.intercept, daily: fit.daily, weekly: fit.weekly, monthly: fit.monthly },
    rSquared: fit.rSquared,
    observations: fit.nobs,
    // Each horizon's volatility comes from the average of its daily variance forecasts
    horizons: FORECAST_HORIZONS.map(days => ({
      days,
      annualizedVolatility: annualize(Math.sqrt(daily.slice(0, days).reduce((sum, v) => sum + v, 0) / days)),
    })),
  };
}

export function summarizeRisk(coinId: string, prices: StoredPrice[]): RiskSummary {
  const returns = logReturns(prices.map(p => p.price));
  const annualize = (perPeriod: number) =>
    perPeriod * Math.sqrt(periodsPerYear(prices.map(p => p.timestamp))) * 100;

  const realizedVolatility = REALIZED_WINDOWS.map(windowDays => {
    const latest = returns.length >= windowDays ? rollingVolatility(returns, windowDays)[returns.length - 1] : null;
    return { windowDays, annualizedVolatility: latest === null ? null : annualize(latest) };
  });

  const volatilityForecast = returns.length >= MIN_HAR_RETURNS ? forecastVolatility(returns, annualize) : null;

  const ewma = returns.length > 0 ? ewmaVariance(returns, EWMA_DECAY)[returns.length - 1] : null;
  const m = returns.length >= 4 ? moments(returns) : null;

  const first = prices[0];
  const last = prices[prices.length - 1];
  const expectedDays = last ? Math.round((last.timestamp - first.timestamp) / MS_PER_DAY) + 1 : 0;

  return {
    coinId,
    asOf: last?.date ?? null,
    observations: prices.length,
    missingDays: expectedDays - prices.length,
    realizedVolatility,
    ewmaVolatility: ewma === null ? null : annualize(Math.sqrt(ewma)),
    returnDistribution: m && { skewness: m.skewness, excessKurtosis: m.excessKurtosis },
    volatilityForecast,
  };
}

export async function getRiskSummary(coinId: string, now = Date.now()): Promise<RiskSummary> {
  if (!COIN_ID_PATTERN.test(coinId)) {
    throw new Error('Invalid coin id');
  }

  const cached = cache.get<RiskSummary>(coinId);
  if (cached) return cached;

  const fromDate = new Date(now - HISTORY_DAYS * MS_PER_DAY).toISOString().slice(0, 10);
  const summary = summarizeRisk(coinId, await getDailyPrices(coinId, fromDate));

  cache.set(coinId, summary);
  return summary;
}
