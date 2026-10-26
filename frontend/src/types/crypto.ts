export interface Cryptocurrency {
  id: number;
  symbol: string;
  name: string;
  coinGeckoId: string;
  imageUrl?: string;
  currentPrice?: number;
  marketCap?: number;
  volume24h?: number;
  priceChange24h?: number;
  priceChangePercentage24h?: number;
  high24h?: number;
  low24h?: number;
  athPrice?: number;
  athDate?: string;
  atlPrice?: number;
  atlDate?: string;
  circulatingSupply?: number;
  totalSupply?: number;
  maxSupply?: number;
}

export interface PricePoint {
  timestamp: string;
  price: number;
  volume24h?: number;
  marketCap?: number;
}

export interface PriceHistory {
  cryptoId: number;
  symbol: string;
  name: string;
  data: PricePoint[];
}

export interface MarketStats {
  high24h?: number;
  low24h?: number;
  athPrice?: number;
  athDate?: string;
  atlPrice?: number;
  atlDate?: string;
  circulatingSupply?: number;
  totalSupply?: number;
  maxSupply?: number;
}

export enum TimeRange {
  DAY = 'DAY',
  WEEK = 'WEEK',
  MONTH = 'MONTH',
  YEAR = 'YEAR',
  ALL = 'ALL',
}

export interface RiskSummary {
  coinId: string;
  asOf: string | null;
  observations: number;
  missingDays: number;
  realizedVolatility: { windowDays: number; annualizedVolatility: number | null }[];
  ewmaVolatility: number | null;
  returnDistribution: { skewness: number; excessKurtosis: number } | null;
  volatilityForecast: {
    model: string;
    coefficients: { intercept: number; daily: number; weekly: number; monthly: number };
    rSquared: number;
    observations: number;
    horizons: { days: number; annualizedVolatility: number }[];
  } | null;
  valueAtRisk: ValueAtRiskSummary | null;
  garch: GarchSummary | null;
  performance: PerformanceSummary | null;
  regime: Regime | null;
}

export interface Regime {
  trend: 'up' | 'down';
  movingAverage: number;
  priceToMovingAverage: number;
  volatilityPercentile: number;
  volatilityLevel: 'low' | 'normal' | 'high';
}

export interface MarketRiskRow {
  coinId: string;
  asOf: string;
  volatility30d: number | null;
  currentDrawdown: number | null;
  valueAtRisk95: number | null;
  regime: Regime | null;
}

export interface PerformanceSummary {
  annualizedReturn: number;
  sharpeRatio: number | null;
  sortinoRatio: number | null;
  calmarRatio: number | null;
  drawdown: {
    maxDrawdown: number;
    peakDate: string;
    troughDate: string;
    recoveryDate: string | null;
    currentDrawdown: number;
    longestDrawdownDays: number;
  };
  worstDays: { date: string; return: number }[];
  worstWeek: { startDate: string; endDate: string; return: number };
  betaToBitcoin: { windowDays: number; observations: number; beta: number; correlation: number }[] | null;
}

export interface TestResult {
  statistic: number;
  pValue: number;
}

export interface GarchSummary {
  omega: number;
  alpha: number;
  beta: number;
  persistence: number;
  logLikelihood: number;
  aic: number;
  bic: number;
  observations: number;
  halfLifeDays: number;
  currentVolatility: number;
  longRunVolatility: number;
  conditionalVolatility: { date: string; annualizedVolatility: number }[];
  forecast: { days: number; annualizedVolatility: number }[];
  ljungBoxResiduals: TestResult;
  ljungBoxSquaredResiduals: TestResult;
  standardizedExcessKurtosis: number;
  normalQq: { theoretical: number; sample: number }[];
}

export type VarMethod = 'historical' | 'normal' | 'studentT' | 'filteredHistorical';

export interface VarMethodResult {
  method: VarMethod;
  valueAtRisk: number;
  expectedShortfall: number;
  backtest: {
    days: number;
    exceptions: number;
    expectedExceptions: number;
    kupiecPValue: number;
    christoffersenPValue: number;
    conditionalCoveragePValue: number;
    passes: boolean;
  };
}

export interface ValueAtRiskSummary {
  windowDays: number;
  studentTDegreesOfFreedom: number;
  levels: { confidence: number; methods: VarMethodResult[] }[];
}
