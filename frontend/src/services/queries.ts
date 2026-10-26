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

export const GET_RISK_SUMMARY = gql`
  query GetRiskSummary($coinId: String!) {
    riskSummary(coinId: $coinId) {
      coinId
      asOf
      observations
      missingDays
      realizedVolatility {
        windowDays
        annualizedVolatility
      }
      ewmaVolatility
      returnDistribution {
        skewness
        excessKurtosis
      }
      volatilityForecast {
        model
        coefficients {
          intercept
          daily
          weekly
          monthly
        }
        rSquared
        observations
        horizons {
          days
          annualizedVolatility
        }
      }
      performance {
        annualizedReturn
        sharpeRatio
        sortinoRatio
        calmarRatio
        drawdown {
          maxDrawdown
          peakDate
          troughDate
          recoveryDate
          currentDrawdown
          longestDrawdownDays
        }
        worstDays {
          date
          return
        }
        worstWeek {
          startDate
          endDate
          return
        }
        betaToBitcoin {
          windowDays
          observations
          beta
          correlation
        }
      }
      garch {
        omega
        alpha
        beta
        persistence
        logLikelihood
        aic
        bic
        observations
        halfLifeDays
        currentVolatility
        longRunVolatility
        conditionalVolatility {
          date
          annualizedVolatility
        }
        forecast {
          days
          annualizedVolatility
        }
        ljungBoxResiduals {
          statistic
          pValue
        }
        ljungBoxSquaredResiduals {
          statistic
          pValue
        }
        standardizedExcessKurtosis
        normalQq {
          theoretical
          sample
        }
      }
      valueAtRisk {
        windowDays
        studentTDegreesOfFreedom
        levels {
          confidence
          methods {
            method
            valueAtRisk
            expectedShortfall
            backtest {
              days
              exceptions
              expectedExceptions
              kupiecPValue
              christoffersenPValue
              conditionalCoveragePValue
              passes
            }
          }
        }
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
