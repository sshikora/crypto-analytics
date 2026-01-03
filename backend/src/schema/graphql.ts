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

  # Notification Enums
  enum NotificationRuleType {
    MA_CROSSOVER
    PRICE_MA_CROSSOVER
  }

  enum CrossDirection {
    ABOVE
    BELOW
    BOTH
  }

  enum CrossoverType {
    GOLDEN_CROSS
    DEATH_CROSS
    PRICE_ABOVE_MA
    PRICE_BELOW_MA
  }

  # Notification Rule Type
  type NotificationRule {
    ruleId: String!
    userId: String!
    coinId: String!
    coinSymbol: String!
    ruleType: NotificationRuleType!
    maPeriods: [Int!]!
    crossDirection: CrossDirection!
    inAppEnabled: Boolean!
    emailEnabled: Boolean!
    isActive: Boolean!
    lastTriggeredAt: String
    createdAt: String!
    updatedAt: String!
  }

  # MA Value for notification details
  type MAValue {
    period: Int!
    value: Float!
  }

  # Notification Type
  type Notification {
    notificationId: String!
    userId: String!
    ruleId: String!
    coinId: String!
    coinSymbol: String!
    crossoverType: CrossoverType!
    maPeriods: [Int!]!
    priceAtCrossover: Float!
    maValuesAtCrossover: [MAValue!]!
    isRead: Boolean!
    emailSent: Boolean!
    triggeredAt: String!
    createdAt: String!
  }

  # Notification Rule Inputs
  input CreateNotificationRuleInput {
    coinId: String!
    coinSymbol: String!
    ruleType: NotificationRuleType!
    maPeriods: [Int!]!
    crossDirection: CrossDirection!
    inAppEnabled: Boolean!
    emailEnabled: Boolean!
  }

  input UpdateNotificationRuleInput {
    maPeriods: [Int!]
    crossDirection: CrossDirection
    inAppEnabled: Boolean
    emailEnabled: Boolean
    isActive: Boolean
  }

  type UserPreferences {
    userId: String!
    colorMode: String!
    enabledMAPeriods: [Int!]!
    defaultTimeRange: String!
    showDifference: Boolean!
    dashboardCoins: [String!]
  }

  input UserPreferencesInput {
    userId: String!
    colorMode: String!
    enabledMAPeriods: [Int!]!
    defaultTimeRange: String!
    showDifference: Boolean!
    dashboardCoins: [String!]
  }

  type Query {
    cryptocurrencies: [Cryptocurrency!]!
    cryptocurrency(symbol: String!): Cryptocurrency
    priceHistory(symbol: String!, timeRange: TimeRange!): PriceHistory
    marketStats(symbol: String!): MarketStats
    topCryptocurrencies(limit: Int): [Cryptocurrency!]!
    userPreferences(userId: String!): UserPreferences

    # Notification Queries
    notificationRules(coinId: String): [NotificationRule!]!
    notificationRule(ruleId: String!): NotificationRule
    notifications(limit: Int, unreadOnly: Boolean): [Notification!]!
    unreadNotificationCount: Int!
  }

  type Mutation {
    refreshCryptoData(symbol: String!): Cryptocurrency
    saveUserPreferences(input: UserPreferencesInput!): UserPreferences!

    # Notification Mutations
    createNotificationRule(input: CreateNotificationRuleInput!): NotificationRule!
    updateNotificationRule(ruleId: String!, input: UpdateNotificationRuleInput!): NotificationRule!
    deleteNotificationRule(ruleId: String!): Boolean!
    markNotificationAsRead(notificationId: String!): Notification!
    markAllNotificationsAsRead: Boolean!
  }
`;
