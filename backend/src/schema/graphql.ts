export const typeDefs = `
  type Cryptocurrency {
    id: Int!
    symbol: String!
    name: String!
    coinGeckoId: String!
    imageUrl: String
    currentPrice: Float
    marketCap: Float
    volume24h: Float
    priceChange24h: Float
    priceChangePercentage24h: Float
    high24h: Float
    low24h: Float
    athPrice: Float
    athDate: String
    atlPrice: Float
    atlDate: String
    circulatingSupply: Float
    totalSupply: Float
    maxSupply: Float
  }

  type PricePoint {
    timestamp: String!
    price: Float!
    volume24h: Float
    marketCap: Float
  }

  type MarketStats {
    high24h: Float
    low24h: Float
    athPrice: Float
    athDate: String
    atlPrice: Float
    atlDate: String
    circulatingSupply: Float
    totalSupply: Float
    maxSupply: Float
  }

  type PriceHistory {
    cryptoId: Int!
    symbol: String!
    name: String!
    data: [PricePoint!]!
  }

  enum TimeRange {
    DAY
    WEEK
    MONTH
    YEAR
    ALL
  }

  type Query {
    cryptocurrencies: [Cryptocurrency!]!
    cryptocurrency(symbol: String!): Cryptocurrency
    priceHistory(symbol: String!, timeRange: TimeRange!): PriceHistory
    marketStats(symbol: String!): MarketStats
    topCryptocurrencies(limit: Int): [Cryptocurrency!]!
  }

  type Mutation {
    refreshCryptoData(symbol: String!): Cryptocurrency
  }
`;
