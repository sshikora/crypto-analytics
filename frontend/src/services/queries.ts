import { gql } from '@apollo/client';

export const GET_CRYPTOCURRENCIES = gql`
  query GetCryptocurrencies {
    cryptocurrencies {
      id
      symbol
      name
      coinGeckoId
      imageUrl
      currentPrice
      marketCap
      volume24h
      priceChange24h
      priceChangePercentage24h
      high24h
      low24h
    }
  }
`;

export const GET_TOP_CRYPTOCURRENCIES = gql`
  query GetTopCryptocurrencies($limit: Int) {
    topCryptocurrencies(limit: $limit) {
      id
      symbol
      name
      coinGeckoId
      imageUrl
      currentPrice
      marketCap
      volume24h
      priceChange24h
      priceChangePercentage24h
      high24h
      low24h
    }
  }
`;

export const GET_CRYPTOCURRENCY = gql`
  query GetCryptocurrency($symbol: String!) {
    cryptocurrency(symbol: $symbol) {
      id
      symbol
      name
      coinGeckoId
      imageUrl
      currentPrice
      marketCap
      volume24h
      priceChange24h
      priceChangePercentage24h
      high24h
      low24h
      athPrice
      athDate
      atlPrice
      atlDate
      circulatingSupply
      totalSupply
      maxSupply
    }
  }
`;

export const GET_PRICE_HISTORY = gql`
  query GetPriceHistory($symbol: String!, $timeRange: TimeRange!) {
    priceHistory(symbol: $symbol, timeRange: $timeRange) {
      cryptoId
      symbol
      name
      data {
        timestamp
        price
        volume24h
        marketCap
      }
    }
  }
`;

export const GET_MARKET_STATS = gql`
  query GetMarketStats($symbol: String!) {
    marketStats(symbol: $symbol) {
      high24h
      low24h
      athPrice
      athDate
      atlPrice
      atlDate
      circulatingSupply
      totalSupply
      maxSupply
    }
  }
`;

export const GET_VOLATILITY_MODEL = gql`
  query GetVolatilityModel($symbol: String!, $timeRange: TimeRange!) {
    volatilityModel(symbol: $symbol, timeRange: $timeRange) {
      symbol
      modelType
      omega
      alpha
      beta
      persistence
      longRunVolatility
      currentVolatility
      conditionalVolatility {
        timestamp
        annualizedVolatility
      }
      forecast {
        horizon
        annualizedVolatility
      }
    }
  }
`;

export const REFRESH_CRYPTO_DATA = gql`
  mutation RefreshCryptoData($symbol: String!) {
    refreshCryptoData(symbol: $symbol) {
      id
      symbol
      name
      currentPrice
      marketCap
      volume24h
    }
  }
`;
