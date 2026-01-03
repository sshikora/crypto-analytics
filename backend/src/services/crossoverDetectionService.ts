import { coinGeckoService } from './coinGeckoService';
import {
  NotificationRule,
  CrossoverType,
  getAllActiveRules,
  updateNotificationRule,
} from '../db/notificationDynamodb';

export interface CrossoverResult {
  type: CrossoverType;
  coinId: string;
  coinSymbol: string;
  priceAtCrossover: number;
  maValues: Record<string, number>;
  maPeriods: number[];
  triggeredAt: string;
}

export interface DetectedCrossover {
  rule: NotificationRule;
  crossover: CrossoverResult;
}

/**
 * Calculate Simple Moving Average for a given period
 * Mirrors the frontend calculation in MovingAverageChart.tsx
 */
export function calculateSMA(prices: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      result.push(sum / period);
    }
  }
  return result;
}

/**
 * Get the current SMA value (most recent non-null value)
 */
function getCurrentSMAValue(smaValues: (number | null)[]): number | null {
  for (let i = smaValues.length - 1; i >= 0; i--) {
    if (smaValues[i] !== null) {
      return smaValues[i];
    }
  }
  return null;
}

/**
 * Get the previous SMA value (second most recent non-null value)
 */
function getPreviousSMAValue(smaValues: (number | null)[]): number | null {
  let foundCurrent = false;
  for (let i = smaValues.length - 1; i >= 0; i--) {
    if (smaValues[i] !== null) {
      if (foundCurrent) {
        return smaValues[i];
      }
      foundCurrent = true;
    }
  }
  return null;
}

/**
 * Detect MA-to-MA crossover (Golden Cross / Death Cross)
 * Golden Cross: Short MA crosses above Long MA
 * Death Cross: Short MA crosses below Long MA
 */
export function detectMACrossover(
  prices: number[],
  shortPeriod: number,
  longPeriod: number
): { type: 'GOLDEN_CROSS' | 'DEATH_CROSS'; maValues: Record<string, number> } | null {
  if (shortPeriod >= longPeriod) {
    console.warn('Short period must be less than long period for MA crossover detection');
    return null;
  }

  const shortSMA = calculateSMA(prices, shortPeriod);
  const longSMA = calculateSMA(prices, longPeriod);

  const currentShort = getCurrentSMAValue(shortSMA);
  const currentLong = getCurrentSMAValue(longSMA);
  const prevShort = getPreviousSMAValue(shortSMA);
  const prevLong = getPreviousSMAValue(longSMA);

  if (currentShort === null || currentLong === null || prevShort === null || prevLong === null) {
    return null;
  }

  const maValues: Record<string, number> = {
    [`ma${shortPeriod}`]: currentShort,
    [`ma${longPeriod}`]: currentLong,
  };

  // Golden Cross: Short was below long, now short is above long
  if (prevShort <= prevLong && currentShort > currentLong) {
    return { type: 'GOLDEN_CROSS', maValues };
  }

  // Death Cross: Short was above long, now short is below long
  if (prevShort >= prevLong && currentShort < currentLong) {
    return { type: 'DEATH_CROSS', maValues };
  }

  return null;
}

/**
 * Detect Price-to-MA crossover
 */
export function detectPriceMACrossover(
  prices: number[],
  maPeriod: number
): { type: 'PRICE_ABOVE_MA' | 'PRICE_BELOW_MA'; maValues: Record<string, number> } | null {
  if (prices.length < 2) {
    return null;
  }

  const sma = calculateSMA(prices, maPeriod);
  const currentPrice = prices[prices.length - 1];
  const prevPrice = prices[prices.length - 2];
  const currentMA = getCurrentSMAValue(sma);
  const prevMA = getPreviousSMAValue(sma);

  if (currentMA === null || prevMA === null) {
    return null;
  }

  const maValues: Record<string, number> = {
    [`ma${maPeriod}`]: currentMA,
  };

  // Price crossed above MA
  if (prevPrice <= prevMA && currentPrice > currentMA) {
    return { type: 'PRICE_ABOVE_MA', maValues };
  }

  // Price crossed below MA
  if (prevPrice >= prevMA && currentPrice < currentMA) {
    return { type: 'PRICE_BELOW_MA', maValues };
  }

  return null;
}

/**
 * Get the current crossover state for a rule (used to detect changes)
 */
function getCrossoverState(
  prices: number[],
  rule: NotificationRule
): string {
  if (rule.ruleType === 'MA_CROSSOVER' && rule.maPeriods.length >= 2) {
    const sortedPeriods = [...rule.maPeriods].sort((a, b) => a - b);
    const shortSMA = calculateSMA(prices, sortedPeriods[0]);
    const longSMA = calculateSMA(prices, sortedPeriods[sortedPeriods.length - 1]);
    const currentShort = getCurrentSMAValue(shortSMA);
    const currentLong = getCurrentSMAValue(longSMA);

    if (currentShort === null || currentLong === null) {
      return 'UNKNOWN';
    }

    return currentShort > currentLong ? 'SHORT_ABOVE_LONG' : 'SHORT_BELOW_LONG';
  } else if (rule.ruleType === 'PRICE_MA_CROSSOVER' && rule.maPeriods.length >= 1) {
    const sma = calculateSMA(prices, rule.maPeriods[0]);
    const currentPrice = prices[prices.length - 1];
    const currentMA = getCurrentSMAValue(sma);

    if (currentMA === null) {
      return 'UNKNOWN';
    }

    return currentPrice > currentMA ? 'PRICE_ABOVE_MA' : 'PRICE_BELOW_MA';
  }

  return 'UNKNOWN';
}

/**
 * Check if a crossover matches the rule's direction
 */
function matchesCrossDirection(
  crossoverType: CrossoverType,
  direction: 'ABOVE' | 'BELOW' | 'BOTH'
): boolean {
  if (direction === 'BOTH') {
    return true;
  }

  if (direction === 'ABOVE') {
    return crossoverType === 'GOLDEN_CROSS' || crossoverType === 'PRICE_ABOVE_MA';
  }

  if (direction === 'BELOW') {
    return crossoverType === 'DEATH_CROSS' || crossoverType === 'PRICE_BELOW_MA';
  }

  return false;
}

/**
 * Check if 24 hours have passed since last trigger (cooldown)
 */
function hasCooldownPassed(lastTriggeredAt?: string): boolean {
  if (!lastTriggeredAt) {
    return true;
  }

  const lastTrigger = new Date(lastTriggeredAt);
  const now = new Date();
  const hoursDiff = (now.getTime() - lastTrigger.getTime()) / (1000 * 60 * 60);

  return hoursDiff >= 24;
}

/**
 * Check crossovers for a single coin
 */
export async function checkCrossoversForCoin(
  coinId: string,
  rules: NotificationRule[]
): Promise<DetectedCrossover[]> {
  const detectedCrossovers: DetectedCrossover[] = [];

  try {
    // Fetch enough price history for longest MA period + buffer
    const maxPeriod = Math.max(...rules.flatMap((r) => r.maPeriods));
    const days = Math.max(maxPeriod * 2, 30); // At least 30 days or 2x the longest period

    const priceHistory = await coinGeckoService.getPriceHistory(coinId, days);
    const prices = priceHistory.prices.map(([_, price]) => price);

    if (prices.length < maxPeriod) {
      console.log(`[CrossoverDetection] Not enough price data for ${coinId}`);
      return [];
    }

    const currentPrice = prices[prices.length - 1];

    for (const rule of rules) {
      // Check cooldown
      if (!hasCooldownPassed(rule.lastTriggeredAt)) {
        continue;
      }

      // Get current state
      const currentState = getCrossoverState(prices, rule);

      // Check if state has changed since last check
      if (rule.lastCrossoverState === currentState) {
        continue;
      }

      let crossoverResult: { type: CrossoverType; maValues: Record<string, number> } | null = null;

      if (rule.ruleType === 'MA_CROSSOVER' && rule.maPeriods.length >= 2) {
        // Sort periods to get short and long
        const sortedPeriods = [...rule.maPeriods].sort((a, b) => a - b);
        const shortPeriod = sortedPeriods[0];
        const longPeriod = sortedPeriods[sortedPeriods.length - 1];

        crossoverResult = detectMACrossover(prices, shortPeriod, longPeriod);
      } else if (rule.ruleType === 'PRICE_MA_CROSSOVER' && rule.maPeriods.length >= 1) {
        crossoverResult = detectPriceMACrossover(prices, rule.maPeriods[0]);
      }

      if (crossoverResult && matchesCrossDirection(crossoverResult.type, rule.crossDirection)) {
        detectedCrossovers.push({
          rule,
          crossover: {
            type: crossoverResult.type,
            coinId: rule.coinId,
            coinSymbol: rule.coinSymbol,
            priceAtCrossover: currentPrice,
            maValues: crossoverResult.maValues,
            maPeriods: rule.maPeriods,
            triggeredAt: new Date().toISOString(),
          },
        });

        // Update rule with new state and trigger time
        await updateNotificationRule(rule.ruleId, {
          lastCrossoverState: currentState,
          lastTriggeredAt: new Date().toISOString(),
        });
      } else {
        // Update state even if no crossover detected (to track state changes)
        if (rule.lastCrossoverState !== currentState) {
          await updateNotificationRule(rule.ruleId, {
            lastCrossoverState: currentState,
          });
        }
      }
    }
  } catch (error) {
    console.error(`[CrossoverDetection] Error checking crossovers for ${coinId}:`, error);
  }

  return detectedCrossovers;
}

/**
 * Process all active notification rules
 */
export async function processAllActiveRules(): Promise<DetectedCrossover[]> {
  console.log('[CrossoverDetection] Starting crossover check...');

  try {
    const allRules = await getAllActiveRules();
    console.log(`[CrossoverDetection] Found ${allRules.length} active rules`);

    if (allRules.length === 0) {
      return [];
    }

    // Group rules by coinId
    const rulesByCoin: Record<string, NotificationRule[]> = {};
    for (const rule of allRules) {
      if (!rulesByCoin[rule.coinId]) {
        rulesByCoin[rule.coinId] = [];
      }
      rulesByCoin[rule.coinId].push(rule);
    }

    const coinIds = Object.keys(rulesByCoin);
    console.log(`[CrossoverDetection] Checking ${coinIds.length} unique coins`);

    const allDetectedCrossovers: DetectedCrossover[] = [];

    // Process coins sequentially to respect API rate limits
    for (const coinId of coinIds) {
      const coinRules = rulesByCoin[coinId];
      const detectedCrossovers = await checkCrossoversForCoin(coinId, coinRules);
      allDetectedCrossovers.push(...detectedCrossovers);

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    console.log(`[CrossoverDetection] Detected ${allDetectedCrossovers.length} crossovers`);
    return allDetectedCrossovers;
  } catch (error) {
    console.error('[CrossoverDetection] Error processing rules:', error);
    return [];
  }
}

export const crossoverDetectionService = {
  calculateSMA,
  detectMACrossover,
  detectPriceMACrossover,
  checkCrossoversForCoin,
  processAllActiveRules,
};
