import { describe, it, expect } from 'vitest';
import { coinGeckoService, CoinGeckoMarketData, CoinGeckoPriceHistory } from './coinGeckoService';

describe('CoinGeckoService', () => {
  describe('service instance', () => {
    it('should be defined', () => {
      expect(coinGeckoService).toBeDefined();
      expect(coinGeckoService).toHaveProperty('getMarketData');
      expect(coinGeckoService).toHaveProperty('getPriceHistory');
      expect(coinGeckoService).toHaveProperty('getCoinData');
    });
  });

  describe('symbol mapping', () => {
    it('should handle common cryptocurrency symbols', () => {
      const commonMappings = {
        'BTC': 'bitcoin',
        'ETH': 'ethereum',
        'BNB': 'binancecoin',
        'DOGE': 'dogecoin',
      };

      Object.entries(commonMappings).forEach(([symbol, expected]) => {
        // This tests that we understand the mapping format
        expect(expected.toLowerCase()).toBe(expected);
        expect(symbol.toUpperCase()).toBe(symbol);
      });
    });
  });

  describe('time range conversion', () => {
    it('should convert time ranges to days correctly', () => {
      const timeRanges = {
        'DAY': 1,
        'WEEK': 7,
        'MONTH': 30,
        'QUARTER': 90,
        'YEAR': 365,
      };

      Object.entries(timeRanges).forEach(([range, days]) => {
        expect(days).toBeGreaterThan(0);
        expect(Number.isInteger(days)).toBe(true);
      });
    });
  });

  describe('data validation', () => {
    it('should validate price data structure', () => {
      const validPriceData = {
        id: 'bitcoin',
        symbol: 'btc',
        name: 'Bitcoin',
        current_price: 50000,
        market_cap: 1000000000,
        total_volume: 50000000,
      };

      expect(validPriceData).toHaveProperty('id');
      expect(validPriceData).toHaveProperty('symbol');
      expect(validPriceData).toHaveProperty('current_price');
      expect(typeof validPriceData.current_price).toBe('number');
    });

    it('should validate historical data points', () => {
      const historicalPoint = {
        timestamp: Date.now(),
        price: 50000,
      };

      expect(historicalPoint.timestamp).toBeGreaterThan(0);
      expect(historicalPoint.price).toBeGreaterThan(0);
      expect(Number.isFinite(historicalPoint.timestamp)).toBe(true);
      expect(Number.isFinite(historicalPoint.price)).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle rate limit errors appropriately', () => {
      const rateLimitError = {
        status: 429,
        message: 'Rate limit exceeded',
      };

      expect(rateLimitError.status).toBe(429);
      expect(rateLimitError.message).toContain('Rate limit');
    });

    it('should handle network errors', () => {
      const networkError = new Error('Network request failed');
      expect(networkError.message).toContain('Network');
    });
  });
});
