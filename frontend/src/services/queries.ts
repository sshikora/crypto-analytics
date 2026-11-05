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

const REGIME_FIELDS = `
  trend
  movingAverage
  priceToMovingAverage
  volatilityPercentile
  volatilityLevel
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
      regime {
        ${REGIME_FIELDS}
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

// Small enough to load on every tab, for the badge in the coin header
export const GET_REGIME = gql`
  query GetRegime($coinId: String!) {
    riskSummary(coinId: $coinId) {
      coinId
      asOf
      regime {
        ${REGIME_FIELDS}
      }
    }
  }
`;

export const GET_REGIME_MODEL = gql`
  query GetRegimeModel($coinId: String!) {
    regimeModel(coinId: $coinId) {
      coinId
      asOf
      observations
      logLikelihood
      aic
      bic
      oneStateBic
      supported
      states {
        name
        dailyMean
        annualizedVolatility
        stayProbability
        expectedDays
        longRunShare
      }
      turbulentProbability
      nextDayTurbulentProbability
      history {
        dates
        filtered
        smoothed
      }
    }
  }
`;

export const GET_SCENARIO = gql`
  query GetScenario($coinId: String!) {
    scenario(coinId: $coinId) {
      coinId
      asOf
      startPrice
      observations
      paths
      quantiles
      models {
        model
        startingVolatility
        fan {
          day
          quantiles
        }
        horizons {
          days
          mean
          standardError
          tailRisk {
            confidence
            valueAtRisk
            expectedShortfall
          }
          drawdownProbabilities {
            threshold
            probability
          }
          distribution {
            lower
            upper
            probability
          }
        }
      }
    }
  }
`;

// The Methodology page's live line needs only each model's tail risk
export const GET_SCENARIO_TAIL_RISK = gql`
  query GetScenarioTailRisk($coinId: String!) {
    scenario(coinId: $coinId) {
      coinId
      asOf
      models {
        model
        horizons {
          days
          tailRisk {
            confidence
            valueAtRisk
            expectedShortfall
          }
        }
      }
    }
  }
`;

export const GET_MARKET_RISK = gql`
  query GetMarketRisk {
    marketRisk {
      computedAt
      rows {
        coinId
        asOf
        volatility30d
        currentDrawdown
        valueAtRisk95
        regime {
          ${REGIME_FIELDS}
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
