import { rollingVolatility } from './realizedVolatility';
import { logReturns, mean } from './returns';

// Threshold regime, matching validation/cql_validation/regime.py: trend from the latest close against its 200-day
// simple moving average, and volatility level from where the latest 30-day volatility ranks in the coin's history

export const TREND_DAYS = 200;
const VOLATILITY_WINDOW = 30;

export type VolatilityLevel = 'low' | 'normal' | 'high';

export interface Regime {
  trend: 'up' | 'down';
  movingAverage: number;
  priceToMovingAverage: number;
  // Fraction of 30-day windows in the history with volatility at or below the latest
  volatilityPercentile: number;
  volatilityLevel: VolatilityLevel;
}

export function regime(prices: number[]): Regime {
  const latest = prices[prices.length - 1];
  const movingAverage = mean(prices.slice(-TREND_DAYS));
  const vols = rollingVolatility(logReturns(prices), VOLATILITY_WINDOW).filter((v): v is number => v !== null);
  const current = vols[vols.length - 1];
  const volatilityPercentile = vols.filter(v => v <= current).length / vols.length;

  return {
    trend: latest > movingAverage ? 'up' : 'down',
    movingAverage,
    priceToMovingAverage: latest / movingAverage,
    volatilityPercentile,
    volatilityLevel: volatilityPercentile < 1 / 3 ? 'low' : volatilityPercentile > 2 / 3 ? 'high' : 'normal',
  };
}
