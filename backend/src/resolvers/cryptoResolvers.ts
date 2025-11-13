import { coinGeckoService } from '../services/coinGeckoService';

const TIME_RANGE_TO_DAYS: Record<string, number> = {
  DAY: 1,
  WEEK: 7,
  MONTH: 30,
  YEAR: 365,
  ALL: 'max' as any,
};

export const resolvers = {
  Query: {
    cryptocurrencies: async () => {
      try {
        // Just fetch from CoinGecko directly
        const marketData = await coinGeckoService.getMarketData();
        return marketData.slice(0, 20).map((coin) => ({
          id: 0,
          symbol: coin.symbol.toUpperCase(),
          name: coin.name,
          coinGeckoId: coin.id,
          imageUrl: coin.image,
          currentPrice: coin.current_price,
          marketCap: coin.market_cap,
          volume24h: coin.total_volume,
          priceChange24h: coin.price_change_24h,
          priceChangePercentage24h: coin.price_change_percentage_24h,
          high24h: coin.high_24h,
          low24h: coin.low_24h,
          athPrice: coin.ath,
          athDate: coin.ath_date,
          atlPrice: coin.atl,
          atlDate: coin.atl_date,
          circulatingSupply: coin.circulating_supply,
          totalSupply: coin.total_supply,
          maxSupply: coin.max_supply,
        }));
      } catch (error) {
        console.error('Error fetching cryptocurrencies:', error);
        throw error;
      }
    },

    cryptocurrency: async (_: any, { symbol }: { symbol: string }) => {
      try {
        // Fetch from CoinGecko directly
        const marketData = await coinGeckoService.getMarketData();
        const coin = marketData.find(c => c.symbol.toUpperCase() === symbol.toUpperCase());

        if (!coin) {
          throw new Error('Cryptocurrency not found');
        }

        return {
          id: 0,
          symbol: coin.symbol.toUpperCase(),
          name: coin.name,
          coinGeckoId: coin.id,
          imageUrl: coin.image,
          currentPrice: coin.current_price,
          marketCap: coin.market_cap,
          volume24h: coin.total_volume,
          priceChange24h: coin.price_change_24h,
          priceChangePercentage24h: coin.price_change_percentage_24h,
          high24h: coin.high_24h,
          low24h: coin.low_24h,
          athPrice: coin.ath,
          athDate: coin.ath_date,
          atlPrice: coin.atl,
          atlDate: coin.atl_date,
          circulatingSupply: coin.circulating_supply,
          totalSupply: coin.total_supply,
          maxSupply: coin.max_supply,
        };
      } catch (error) {
        console.error('Error fetching cryptocurrency:', error);
        throw error;
      }
    },

    priceHistory: async (_: any, { symbol, timeRange }: { symbol: string; timeRange: string }) => {
      try {
        // Find from CoinGecko
        const marketData = await coinGeckoService.getMarketData();
        const coin = marketData.find(c => c.symbol.toUpperCase() === symbol.toUpperCase());

        if (!coin) {
          throw new Error('Cryptocurrency not found');
        }

        const days = TIME_RANGE_TO_DAYS[timeRange];
        const history = await coinGeckoService.getPriceHistory(coin.id, days);

        return {
          cryptoId: 0,
          symbol: symbol.toUpperCase(),
          name: coin.name,
          data: history.prices.map((pricePoint, index) => ({
            timestamp: new Date(pricePoint[0]).toISOString(),
            price: pricePoint[1],
            volume24h: history.total_volumes[index]?.[1],
            marketCap: history.market_caps[index]?.[1],
          })),
        };
      } catch (error) {
        console.error('Error fetching price history:', error);
        throw error;
      }
    },

    marketStats: async (_: any, { symbol }: { symbol: string }) => {
      try {
        const marketData = await coinGeckoService.getMarketData();
        const coin = marketData.find(c => c.symbol.toUpperCase() === symbol.toUpperCase());

        if (!coin) {
          throw new Error('Cryptocurrency not found');
        }

        return {
          high24h: coin.high_24h,
          low24h: coin.low_24h,
          athPrice: coin.ath,
          athDate: coin.ath_date,
          atlPrice: coin.atl,
          atlDate: coin.atl_date,
          circulatingSupply: coin.circulating_supply,
          totalSupply: coin.total_supply,
          maxSupply: coin.max_supply,
        };
      } catch (error) {
        console.error('Error fetching market stats:', error);
        throw error;
      }
    },

    topCryptocurrencies: async (_: any, { limit = 10 }: { limit?: number }) => {
      try {
        console.log('Fetching top cryptocurrencies with limit:', limit);
        const marketData = await coinGeckoService.getMarketData();
        console.log('Received market data count:', marketData.length);

        const result = marketData.slice(0, limit).map((coin) => ({
          id: 0,
          symbol: coin.symbol.toUpperCase(),
          name: coin.name,
          coinGeckoId: coin.id,
          imageUrl: coin.image,
          currentPrice: coin.current_price,
          marketCap: coin.market_cap,
          volume24h: coin.total_volume,
          priceChange24h: coin.price_change_24h,
          priceChangePercentage24h: coin.price_change_percentage_24h,
          high24h: coin.high_24h,
          low24h: coin.low_24h,
          athPrice: coin.ath,
          athDate: coin.ath_date,
          atlPrice: coin.atl,
          atlDate: coin.atl_date,
          circulatingSupply: coin.circulating_supply,
          totalSupply: coin.total_supply,
          maxSupply: coin.max_supply,
        }));

        console.log('Returning result count:', result.length);
        return result;
      } catch (error) {
        console.error('Error fetching top cryptocurrencies:', error);
        throw error;
      }
    },
  },

  Mutation: {
    refreshCryptoData: async (_: any, { symbol }: { symbol: string }) => {
      try {
        const marketData = await coinGeckoService.getMarketData();
        const coin = marketData.find(c => c.symbol.toUpperCase() === symbol.toUpperCase());

        if (!coin) {
          throw new Error('Cryptocurrency not found');
        }

        return {
          id: 0,
          symbol: coin.symbol.toUpperCase(),
          name: coin.name,
          coinGeckoId: coin.id,
          imageUrl: coin.image,
          currentPrice: coin.current_price,
          marketCap: coin.market_cap,
          volume24h: coin.total_volume,
          priceChange24h: coin.price_change_24h,
          priceChangePercentage24h: coin.price_change_percentage_24h,
          high24h: coin.high_24h,
          low24h: coin.low_24h,
          athPrice: coin.ath,
          athDate: coin.ath_date,
          atlPrice: coin.atl,
          atlDate: coin.atl_date,
          circulatingSupply: coin.circulating_supply,
          totalSupply: coin.total_supply,
          maxSupply: coin.max_supply,
        };
      } catch (error) {
        console.error('Error refreshing crypto data:', error);
        throw error;
      }
    },
  },
};
