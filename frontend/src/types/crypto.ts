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
