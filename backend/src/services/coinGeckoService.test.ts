import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { coinGeckoService, CoinGeckoMarketData, CoinGeckoPriceHistory } from './coinGeckoService';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

// Mock node-cache to prevent caching from interfering with tests
vi.mock('node-cache', () => {
  return {
    default: class {
      get() { return undefined; }
      set() {}
    },
  };
});

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
    it('should fetch market data without coin IDs', async () => {
      const mockData: CoinGeckoMarketData[] = [
        {
          id: 'bitcoin',
          symbol: 'btc',
          name: 'Bitcoin',
          image: 'https://example.com/btc.png',
          current_price: 50000,
          market_cap: 1000000000,
          market_cap_rank: 1,
          total_volume: 50000000,
          high_24h: 51000,
          low_24h: 49000,
          price_change_24h: 1000,
          price_change_percentage_24h: 2.0,
          circulating_supply: 19000000,
          total_supply: 21000000,
          max_supply: 21000000,
          ath: 69000,
          ath_date: '2021-11-10',
          atl: 100,
          atl_date: '2013-07-06',
        },
      ];

      mockedAxios.get.mockResolvedValueOnce({ data: mockData });

      const result = await coinGeckoService.getMarketData();

      expect(result).toEqual(mockData);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.coingecko.com/api/v3/coins/markets',
        expect.objectContaining({
          params: expect.objectContaining({
            vs_currency: 'usd',
            order: 'market_cap_desc',
            per_page: 100,
            page: 1,
            sparkline: false,
          }),
        })
      );
    });

    it('should fetch market data with specific coin IDs', async () => {
      const mockData: CoinGeckoMarketData[] = [
        {
          id: 'bitcoin',
          symbol: 'btc',
          name: 'Bitcoin',
          image: 'https://example.com/btc.png',
          current_price: 50000,
          market_cap: 1000000000,
          market_cap_rank: 1,
          total_volume: 50000000,
          high_24h: 51000,
          low_24h: 49000,
          price_change_24h: 1000,
          price_change_percentage_24h: 2.0,
          circulating_supply: 19000000,
          total_supply: 21000000,
          max_supply: 21000000,
          ath: 69000,
          ath_date: '2021-11-10',
          atl: 100,
          atl_date: '2013-07-06',
        },
      ];

      mockedAxios.get.mockResolvedValueOnce({ data: mockData });

      const result = await coinGeckoService.getMarketData(['bitcoin', 'ethereum']);

      expect(result).toEqual(mockData);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.coingecko.com/api/v3/coins/markets',
        expect.objectContaining({
          params: expect.objectContaining({
            ids: 'bitcoin,ethereum',
          }),
        })
      );
    });

    it('should throw error with detailed message on API failure', async () => {
      mockedAxios.get.mockRejectedValueOnce({
        message: 'API Error',
        response: {
          data: {
            status: {
              error_message: 'Detailed error message',
            },
          },
        },
      });

      await expect(coinGeckoService.getMarketData()).rejects.toThrow(
        'Failed to fetch market data: Detailed error message'
      );
    });

    it('should throw error with basic message when no detailed error', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));

      await expect(coinGeckoService.getMarketData()).rejects.toThrow(
        'Failed to fetch market data: Network error'
      );
    });

    it('should include empty coin IDs array', async () => {
      const mockData: CoinGeckoMarketData[] = [];
      mockedAxios.get.mockResolvedValueOnce({ data: mockData });

      const result = await coinGeckoService.getMarketData([]);

      expect(result).toEqual(mockData);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.coingecko.com/api/v3/coins/markets',
        expect.objectContaining({
          params: expect.not.objectContaining({
            ids: expect.anything(),
          }),
        })
      );
    });
  });

  describe('getPriceHistory', () => {
    it('should fetch price history for a coin', async () => {
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

      mockedAxios.get.mockResolvedValueOnce({ data: mockData });

      const result = await coinGeckoService.getPriceHistory('bitcoin', 7);

      expect(result).toEqual(mockData);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.coingecko.com/api/v3/coins/bitcoin/market_chart',
        expect.objectContaining({
          params: {
            vs_currency: 'usd',
            days: 7,
          },
        })
      );
    });

    it('should throw specific error for rate limiting (429)', async () => {
      mockedAxios.get.mockRejectedValueOnce({
        response: {
          status: 429,
          data: { error: 'Rate limit exceeded' },
        },
        message: 'Request failed with status code 429',
      });

      await expect(coinGeckoService.getPriceHistory('bitcoin', 7)).rejects.toThrow(
        'CoinGecko API rate limit exceeded. Please try again later.'
      );
    });

    it('should throw error with response data message', async () => {
      mockedAxios.get.mockRejectedValueOnce({
        response: {
          status: 404,
          data: { error: 'Coin not found' },
        },
        message: 'Not found',
      });

      await expect(coinGeckoService.getPriceHistory('invalid-coin', 7)).rejects.toThrow(
        'Failed to fetch price history: Coin not found'
      );
    });

    it('should throw error with basic message when no response', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Network timeout'));

      await expect(coinGeckoService.getPriceHistory('bitcoin', 7)).rejects.toThrow(
        'Failed to fetch price history: Network timeout'
      );
    });

    it('should fetch price history for different time ranges', async () => {
      const mockData: CoinGeckoPriceHistory = {
        prices: [[1609459200000, 29000]],
        market_caps: [[1609459200000, 500000000000]],
        total_volumes: [[1609459200000, 50000000000]],
      };

      mockedAxios.get.mockResolvedValueOnce({ data: mockData });

      await coinGeckoService.getPriceHistory('ethereum', 30);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.coingecko.com/api/v3/coins/ethereum/market_chart',
        expect.objectContaining({
          params: {
            vs_currency: 'usd',
            days: 30,
          },
        })
      );
    });
  });

  describe('getCoinData', () => {
    it('should fetch detailed coin data', async () => {
      const mockData = {
        id: 'bitcoin',
        symbol: 'btc',
        name: 'Bitcoin',
        description: { en: 'Bitcoin is...' },
        market_data: {
          current_price: { usd: 50000 },
        },
      };

      mockedAxios.get.mockResolvedValueOnce({ data: mockData });

      const result = await coinGeckoService.getCoinData('bitcoin');

      expect(result).toEqual(mockData);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.coingecko.com/api/v3/coins/bitcoin',
        expect.objectContaining({
          params: {
            localization: false,
            tickers: false,
            community_data: false,
            developer_data: false,
          },
        })
      );
    });

    it('should throw generic error when fetch fails', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('API Error'));

      await expect(coinGeckoService.getCoinData('invalid')).rejects.toThrow(
        'Failed to fetch coin data'
      );
    });

    it('should fetch coin data for different coins', async () => {
      const mockData = { id: 'ethereum', symbol: 'eth', name: 'Ethereum' };
      mockedAxios.get.mockResolvedValueOnce({ data: mockData });

      await coinGeckoService.getCoinData('ethereum');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.coingecko.com/api/v3/coins/ethereum',
        expect.anything()
      );
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
