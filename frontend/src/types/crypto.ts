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

export interface VolatilityPoint {
  timestamp: string;
  annualizedVolatility: number;
}

export interface VolatilityForecast {
  horizon: number;
  annualizedVolatility: number;
}

export interface VolatilityModel {
  symbol: string;
  modelType: string;
  omega: number;
  alpha: number;
  beta: number;
  persistence: number;
  longRunVolatility: number;
  currentVolatility: number;
  conditionalVolatility: VolatilityPoint[];
  forecast: VolatilityForecast[];
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
}

export type VarMethod = 'historical' | 'normal' | 'studentT';

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
