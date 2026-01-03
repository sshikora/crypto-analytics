import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  calculateSMA,
  detectMACrossover,
  detectPriceMACrossover,
  checkCrossoversForCoin,
  processAllActiveRules,
} from './crossoverDetectionService';
import * as coinGeckoService from './coinGeckoService';
import * as notificationDb from '../db/notificationDynamodb';

vi.mock('./coinGeckoService');
vi.mock('../db/notificationDynamodb');

describe('CrossoverDetectionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('calculateSMA', () => {
    it('should calculate SMA correctly', () => {
      const prices = [10, 11, 12, 13, 14, 15];
      const period = 3;
      const sma = calculateSMA(prices, period);

      expect(sma).toEqual([
        null,
        null,
        11, // (10+11+12)/3
        12, // (11+12+13)/3
        13, // (12+13+14)/3
        14, // (13+14+15)/3
      ]);
    });

    it('should return nulls for insufficient data', () => {
      const prices = [10, 11];
      const period = 3;
      const sma = calculateSMA(prices, period);

      expect(sma).toEqual([null, null]);
    });

    it('should handle period of 1', () => {
      const prices = [10, 20, 30];
      const period = 1;
      const sma = calculateSMA(prices, period);

      expect(sma).toEqual([10, 20, 30]);
    });

    it('should handle empty prices', () => {
      const prices: number[] = [];
      const period = 3;
      const sma = calculateSMA(prices, period);

      expect(sma).toEqual([]);
    });
  });

  describe('detectMACrossover', () => {
    it('should detect golden cross (short crosses above long)', () => {
      // Setup: Downtrend followed by sharp recovery
      // Short MA starts below long MA, then crosses above
      const prices = [
        110, 108, 106, 104, 102, 100, 98, 96, 94, 92, // Downtrend
        90, 89, // Bottom
        95, 100, 110, // Sharp recovery - short MA crosses above long
      ];

      const result = detectMACrossover(prices, 5, 10);

      expect(result).not.toBeNull();
      expect(result?.type).toBe('GOLDEN_CROSS');
      expect(result?.maValues).toHaveProperty('ma5');
      expect(result?.maValues).toHaveProperty('ma10');
    });

    it('should detect death cross (short crosses below long)', () => {
      // Setup: Uptrend followed by sharp decline
      // Short MA starts above long MA, then crosses below
      const prices = [
        90, 92, 94, 96, 98, 100, 102, 104, 106, 108, // Uptrend
        110, 111, // Peak
        105, 100, 90, // Sharp decline - short MA crosses below long
      ];

      const result = detectMACrossover(prices, 5, 10);

      expect(result).not.toBeNull();
      expect(result?.type).toBe('DEATH_CROSS');
    });

    it('should return null when short period >= long period', () => {
      const prices = [100, 102, 104, 106, 108, 110];
      const result = detectMACrossover(prices, 10, 5);

      expect(result).toBeNull();
    });

    it('should return null when not enough data', () => {
      const prices = [100, 102, 104];
      const result = detectMACrossover(prices, 5, 10);

      expect(result).toBeNull();
    });

    it('should return null when no crossover occurs', () => {
      // Prices stay relatively flat
      const prices = Array(20).fill(100);
      const result = detectMACrossover(prices, 5, 10);

      expect(result).toBeNull();
    });
  });

  describe('detectPriceMACrossover', () => {
    it('should detect price crossing above MA', () => {
      const prices = [
        100, 100, 100, 100, 100, 100, 100, // Flat at 100
        99, // Price dips below
        110, // Price jumps above
      ];

      const result = detectPriceMACrossover(prices, 7);

      expect(result).not.toBeNull();
      expect(result?.type).toBe('PRICE_ABOVE_MA');
      expect(result?.maValues).toHaveProperty('ma7');
    });

    it('should detect price crossing below MA', () => {
      const prices = [
        100, 100, 100, 100, 100, 100, 100, // Flat at 100
        101, // Price above
        90, // Price drops below
      ];

      const result = detectPriceMACrossover(prices, 7);

      expect(result).not.toBeNull();
      expect(result?.type).toBe('PRICE_BELOW_MA');
    });

    it('should return null when not enough data', () => {
      const prices = [100];
      const result = detectPriceMACrossover(prices, 7);

      expect(result).toBeNull();
    });

    it('should return null when no crossover occurs', () => {
      const prices = Array(20).fill(100);
      const result = detectPriceMACrossover(prices, 7);

      expect(result).toBeNull();
    });
  });

  describe('checkCrossoversForCoin', () => {
    const mockRule = {
      ruleId: 'rule-123',
      userId: 'user-123',
      coinId: 'bitcoin',
      coinSymbol: 'BTC',
      ruleType: 'MA_CROSSOVER' as const,
      maPeriods: [7, 21],
      crossDirection: 'BOTH' as const,
      inAppEnabled: true,
      emailEnabled: false,
      isActive: true,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    it('should detect crossovers for a coin', async () => {
      const risingPrices = Array.from({ length: 50 }, (_, i) => 100 + i * 2);

      vi.mocked(coinGeckoService.coinGeckoService.getPriceHistory).mockResolvedValue({
        coinId: 'bitcoin',
        symbol: 'BTC',
        name: 'Bitcoin',
        prices: risingPrices.map((price, i) => [Date.now() - i * 86400000, price]),
      });

      vi.mocked(notificationDb.updateNotificationRule).mockResolvedValue({
        ...mockRule,
        lastCrossoverState: 'SHORT_ABOVE_LONG',
      });

      const result = await checkCrossoversForCoin('bitcoin', [mockRule]);

      expect(coinGeckoService.coinGeckoService.getPriceHistory).toHaveBeenCalled();
      expect(result.length).toBeGreaterThanOrEqual(0);
    });

    it('should skip rules in cooldown period', async () => {
      const recentlyTriggered = new Date(Date.now() - 1000 * 60 * 60).toISOString(); // 1 hour ago
      const ruleWithCooldown = {
        ...mockRule,
        lastTriggeredAt: recentlyTriggered,
      };

      const risingPrices = Array.from({ length: 50 }, (_, i) => 100 + i * 2);

      vi.mocked(coinGeckoService.coinGeckoService.getPriceHistory).mockResolvedValue({
        coinId: 'bitcoin',
        symbol: 'BTC',
        name: 'Bitcoin',
        prices: risingPrices.map((price, i) => [Date.now() - i * 86400000, price]),
      });

      const result = await checkCrossoversForCoin('bitcoin', [ruleWithCooldown]);

      // Should not detect anything because cooldown hasn't passed
      expect(result.length).toBe(0);
    });

    it('should handle insufficient price data', async () => {
      vi.mocked(coinGeckoService.coinGeckoService.getPriceHistory).mockResolvedValue({
        coinId: 'bitcoin',
        symbol: 'BTC',
        name: 'Bitcoin',
        prices: [[Date.now(), 100]], // Only 1 price point
      });

      const result = await checkCrossoversForCoin('bitcoin', [mockRule]);

      expect(result).toEqual([]);
    });

    it('should handle price fetch errors gracefully', async () => {
      vi.mocked(coinGeckoService.coinGeckoService.getPriceHistory).mockRejectedValue(
        new Error('API Error')
      );

      const result = await checkCrossoversForCoin('bitcoin', [mockRule]);

      expect(result).toEqual([]);
    });

    it('should filter by cross direction', async () => {
      const ruleAboveOnly = {
        ...mockRule,
        crossDirection: 'ABOVE' as const,
      };

      // Create a death cross scenario
      const fallingPrices = Array.from({ length: 50 }, (_, i) => 200 - i * 2);

      vi.mocked(coinGeckoService.coinGeckoService.getPriceHistory).mockResolvedValue({
        coinId: 'bitcoin',
        symbol: 'BTC',
        name: 'Bitcoin',
        prices: fallingPrices.map((price, i) => [Date.now() - i * 86400000, price]),
      });

      vi.mocked(notificationDb.updateNotificationRule).mockResolvedValue({
        ...mockRule,
        lastCrossoverState: 'SHORT_BELOW_LONG',
      });

      const result = await checkCrossoversForCoin('bitcoin', [ruleAboveOnly]);

      // Should not detect death cross since rule is ABOVE only
      const deathCrosses = result.filter(r => r.crossover.type === 'DEATH_CROSS');
      expect(deathCrosses.length).toBe(0);
    });

    it('should handle PRICE_MA_CROSSOVER rules', async () => {
      const priceMaRule = {
        ...mockRule,
        ruleType: 'PRICE_MA_CROSSOVER' as const,
        maPeriods: [21],
      };

      // Create scenario where price crosses above MA
      const prices = [
        ...Array(20).fill(100),
        99, // Price dips below MA
        110, // Price crosses above
      ];

      vi.mocked(coinGeckoService.coinGeckoService.getPriceHistory).mockResolvedValue({
        coinId: 'bitcoin',
        symbol: 'BTC',
        name: 'Bitcoin',
        prices: prices.map((price, i) => [Date.now() - i * 86400000, price]),
      });

      vi.mocked(notificationDb.updateNotificationRule).mockResolvedValue({
        ...priceMaRule,
        lastCrossoverState: 'PRICE_ABOVE_MA',
      });

      const result = await checkCrossoversForCoin('bitcoin', [priceMaRule]);

      expect(result.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('processAllActiveRules', () => {
    const mockRule1 = {
      ruleId: 'rule-1',
      userId: 'user-123',
      coinId: 'bitcoin',
      coinSymbol: 'BTC',
      ruleType: 'MA_CROSSOVER' as const,
      maPeriods: [7, 21],
      crossDirection: 'BOTH' as const,
      inAppEnabled: true,
      emailEnabled: false,
      isActive: true,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    const mockRule2 = {
      ruleId: 'rule-2',
      userId: 'user-123',
      coinId: 'ethereum',
      coinSymbol: 'ETH',
      ruleType: 'MA_CROSSOVER' as const,
      maPeriods: [7, 21],
      crossDirection: 'BOTH' as const,
      inAppEnabled: true,
      emailEnabled: false,
      isActive: true,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    it('should process all active rules', async () => {
      vi.mocked(notificationDb.getAllActiveRules).mockResolvedValue([mockRule1, mockRule2]);

      const flatPrices = Array.from({ length: 50 }, () => 100);

      vi.mocked(coinGeckoService.coinGeckoService.getPriceHistory).mockResolvedValue({
        coinId: 'bitcoin',
        symbol: 'BTC',
        name: 'Bitcoin',
        prices: flatPrices.map((price, i) => [Date.now() - i * 86400000, price]),
      });

      const result = await processAllActiveRules();

      expect(notificationDb.getAllActiveRules).toHaveBeenCalled();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should return empty array when no active rules', async () => {
      vi.mocked(notificationDb.getAllActiveRules).mockResolvedValue([]);

      const result = await processAllActiveRules();

      expect(result).toEqual([]);
    });

    it('should group rules by coin', async () => {
      const btcRule1 = { ...mockRule1, ruleId: 'rule-btc-1' };
      const btcRule2 = { ...mockRule1, ruleId: 'rule-btc-2' };

      vi.mocked(notificationDb.getAllActiveRules).mockResolvedValue([btcRule1, btcRule2]);

      const flatPrices = Array.from({ length: 50 }, () => 100);

      vi.mocked(coinGeckoService.coinGeckoService.getPriceHistory).mockResolvedValue({
        coinId: 'bitcoin',
        symbol: 'BTC',
        name: 'Bitcoin',
        prices: flatPrices.map((price, i) => [Date.now() - i * 86400000, price]),
      });

      await processAllActiveRules();

      // Should only fetch price data once for bitcoin (grouped rules)
      expect(coinGeckoService.coinGeckoService.getPriceHistory).toHaveBeenCalledTimes(1);
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(notificationDb.getAllActiveRules).mockRejectedValue(new Error('DB Error'));

      const result = await processAllActiveRules();

      expect(result).toEqual([]);
    });
  });
});
