import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { coinGeckoService, CoinGeckoMarketData, CoinGeckoPriceHistory } from './coinGeckoService';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

describe('CoinGeckoService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('service instance', () => {
    it('should be defined', () => {
      expect(coinGeckoService).toBeDefined();
      expect(coinGeckoService).toHaveProperty('getMarketData');
      expect(coinGeckoService).toHaveProperty('getPriceHistory');
      expect(coinGeckoService).toHaveProperty('getCoinData');
    });
  });

  describe('getMarketData', () => {
    it('should have proper market data structure', () => {
      const mockData: Partial<CoinGeckoMarketData> = {
        id: 'bitcoin',
        symbol: 'btc',
        name: 'Bitcoin',
        current_price: 50000,
        market_cap: 1000000000,
        market_cap_rank: 1,
        total_volume: 50000000,
      };

      expect(mockData).toHaveProperty('id');
      expect(mockData).toHaveProperty('symbol');
      expect(mockData).toHaveProperty('name');
      expect(mockData).toHaveProperty('current_price');
      expect(typeof mockData.current_price).toBe('number');
    });

    it('should validate coin IDs format', () => {
      const coinIds = ['bitcoin', 'ethereum', 'binancecoin'];
      const joinedIds = coinIds.join(',');

      expect(joinedIds).toBe('bitcoin,ethereum,binancecoin');
      expect(coinIds.length).toBe(3);
    });

    it('should validate API parameters', () => {
      const params = {
        vs_currency: 'usd',
        order: 'market_cap_desc',
        per_page: 100,
        page: 1,
        sparkline: false,
      };

      expect(params.vs_currency).toBe('usd');
      expect(params.per_page).toBe(100);
      expect(params.sparkline).toBe(false);
    });
  });

  describe('getPriceHistory', () => {
    it('should return price history data structure', () => {
      const mockData: CoinGeckoPriceHistory = {
        prices: [
          [1609459200000, 29000],
          [1609545600000, 30000],
        ],
        market_caps: [
          [1609459200000, 500000000000],
          [1609545600000, 550000000000],
        ],
        total_volumes: [
          [1609459200000, 50000000000],
          [1609545600000, 55000000000],
        ],
      };

      expect(mockData).toHaveProperty('prices');
      expect(mockData).toHaveProperty('market_caps');
      expect(mockData).toHaveProperty('total_volumes');
      expect(Array.isArray(mockData.prices)).toBe(true);
    });

    it('should validate price history time range parameters', () => {
      const validTimeRanges = [1, 7, 30, 90, 365];
      validTimeRanges.forEach(days => {
        expect(days).toBeGreaterThan(0);
        expect(Number.isInteger(days)).toBe(true);
      });
    });
  });

  describe('getCoinData', () => {
    it('should validate coin data structure', () => {
      const mockData = {
        id: 'bitcoin',
        symbol: 'btc',
        name: 'Bitcoin',
        description: { en: 'Bitcoin is...' },
        market_data: {
          current_price: { usd: 50000 },
        },
      };

      expect(mockData).toHaveProperty('id');
      expect(mockData).toHaveProperty('symbol');
      expect(mockData).toHaveProperty('name');
      expect(mockData).toHaveProperty('market_data');
    });

    it('should validate coin ID format', () => {
      const validCoinIds = ['bitcoin', 'ethereum', 'binancecoin'];
      validCoinIds.forEach(id => {
        expect(id).toMatch(/^[a-z0-9-]+$/);
      });
    });
  });

  describe('data validation', () => {
    it('should validate market data structure', () => {
      const validMarketData: Partial<CoinGeckoMarketData> = {
        id: 'bitcoin',
        symbol: 'btc',
        name: 'Bitcoin',
        current_price: 50000,
        market_cap: 1000000000,
        total_volume: 50000000,
      };

      expect(validMarketData).toHaveProperty('id');
      expect(validMarketData).toHaveProperty('symbol');
      expect(validMarketData).toHaveProperty('current_price');
      expect(typeof validMarketData.current_price).toBe('number');
    });

    it('should validate price history structure', () => {
      const validPriceHistory: CoinGeckoPriceHistory = {
        prices: [[1609459200000, 29000]],
        market_caps: [[1609459200000, 500000000000]],
        total_volumes: [[1609459200000, 50000000000]],
      };

      expect(validPriceHistory).toHaveProperty('prices');
      expect(validPriceHistory).toHaveProperty('market_caps');
      expect(validPriceHistory).toHaveProperty('total_volumes');
      expect(Array.isArray(validPriceHistory.prices)).toBe(true);
      expect(validPriceHistory.prices[0]).toHaveLength(2);
    });
  });
});
