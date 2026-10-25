import NodeCache from 'node-cache';
import { getDailyPrices, StoredPrice } from '../repositories/priceHistoryRepository';
import { ewmaVariance, rollingVolatility } from '../models/realizedVolatility';
import { logReturns, moments, periodsPerYear } from '../models/returns';

const cache = new NodeCache({ stdTTL: 3600 });

const MS_PER_DAY = 86_400_000;
const HISTORY_DAYS = 365;
const REALIZED_WINDOWS = [7, 30, 90];
const EWMA_DECAY = 0.94;
const COIN_ID_PATTERN = /^[a-z0-9-]{1,100}$/;

export interface RealizedVolatility {
  windowDays: number;
  annualizedVolatility: number | null;
}

export interface RiskSummary {
  coinId: string;
  asOf: string | null;
  observations: number;
  missingDays: number;
  realizedVolatility: RealizedVolatility[];
  ewmaVolatility: number | null;
  returnDistribution: { skewness: number; excessKurtosis: number } | null;
}

// Volatilities are annualized percentages, like the GARCH model's. Windows count stored observations,
// so a gap in the history widens a window in calendar terms; missingDays reports how many days are absent.
export function summarizeRisk(coinId: string, prices: StoredPrice[]): RiskSummary {
  const returns = logReturns(prices.map(p => p.price));
  const annualize = (perPeriod: number) =>
    perPeriod * Math.sqrt(periodsPerYear(prices.map(p => p.timestamp))) * 100;

  const realizedVolatility = REALIZED_WINDOWS.map(windowDays => {
    const latest = returns.length >= windowDays ? rollingVolatility(returns, windowDays)[returns.length - 1] : null;
    return { windowDays, annualizedVolatility: latest === null ? null : annualize(latest) };
  });

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
