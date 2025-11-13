import axios from 'axios';
import NodeCache from 'node-cache';

const cache = new NodeCache({ stdTTL: 300 }); // Cache for 5 minutes

const COINGECKO_API_BASE = 'https://api.coingecko.com/api/v3';

export interface CoinGeckoMarketData {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  total_volume: number;
  high_24h: number;
  low_24h: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  circulating_supply: number;
  total_supply: number;
  max_supply: number;
  ath: number;
  ath_date: string;
  atl: number;
  atl_date: string;
}

export interface CoinGeckoPriceHistory {
  prices: [number, number][];
  market_caps: [number, number][];
  total_volumes: [number, number][];
}

class CoinGeckoService {
  async getMarketData(coinIds?: string[]): Promise<CoinGeckoMarketData[]> {
    const cacheKey = `market_data_${coinIds?.join(',') || 'all'}`;
    const cached = cache.get<CoinGeckoMarketData[]>(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      const params: any = {
        vs_currency: 'usd',
        order: 'market_cap_desc',
        per_page: 100,
        page: 1,
        sparkline: false,
      };

      if (coinIds && coinIds.length > 0) {
        params.ids = coinIds.join(',');
      }

      const response = await axios.get<CoinGeckoMarketData[]>(
        `${COINGECKO_API_BASE}/coins/markets`,
        { params }
      );

      cache.set(cacheKey, response.data);
      return response.data;
    } catch (error: any) {
      console.error('Error fetching market data from CoinGecko:', error.response?.data || error.message);
      throw new Error(`Failed to fetch market data: ${error.response?.data?.status?.error_message || error.message}`);
    }
  }

  async getPriceHistory(
    coinId: string,
    days: number
  ): Promise<CoinGeckoPriceHistory> {
    const cacheKey = `price_history_${coinId}_${days}`;
    const cached = cache.get<CoinGeckoPriceHistory>(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      const response = await axios.get<CoinGeckoPriceHistory>(
        `${COINGECKO_API_BASE}/coins/${coinId}/market_chart`,
        {
          params: {
            vs_currency: 'usd',
            days,
          },
        }
      );

      cache.set(cacheKey, response.data);
      return response.data;
    } catch (error) {
      console.error('Error fetching price history from CoinGecko:', error);
      throw new Error('Failed to fetch price history');
    }
  }

  async getCoinData(coinId: string): Promise<any> {
    const cacheKey = `coin_data_${coinId}`;
    const cached = cache.get(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      const response = await axios.get(
        `${COINGECKO_API_BASE}/coins/${coinId}`,
        {
          params: {
            localization: false,
            tickers: false,
            community_data: false,
            developer_data: false,
          },
        }
      );

      cache.set(cacheKey, response.data);
      return response.data;
    } catch (error) {
      console.error('Error fetching coin data from CoinGecko:', error);
      throw new Error('Failed to fetch coin data');
    }
  }
}

export const coinGeckoService = new CoinGeckoService();
