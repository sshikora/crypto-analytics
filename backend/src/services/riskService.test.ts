import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getRiskSummary, summarizeRisk } from './riskService';
import { getDailyPrices, StoredPrice } from '../repositories/priceHistoryRepository';
import { harForecastVariance } from '../models/har';

vi.mock('../repositories/priceHistoryRepository', () => ({ getDailyPrices: vi.fn() }));
vi.mock('../models/har', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../models/har')>();
  return { ...actual, harForecastVariance: vi.fn(actual.harForecastVariance) };
});

function loadFixture<T>(model: string): T {
  return JSON.parse(readFileSync(join(__dirname, '..', 'test', 'fixtures', model, 'btc_daily.json'), 'utf8')) as T;
}

const returnsFixture = loadFixture<{
  timestamps: number[];
  prices: number[];
  reference: { periodsPerYear: number; logReturnMoments: { skewness: number; excessKurtosis: number } };
}>('returns');
const harFixture = loadFixture<{
  reference: { params: Record<string, number>; rSquared: number; forecastVariance: number[] };
}>('har');
const varFixture = loadFixture<{
  reference: {
    studentT: { dof: number };
    levels: {
      confidence: number;
      methods: Record<string, { valueAtRisk: number; expectedShortfall: number; exceptions: number[]; days: number; kupiec: { pValue: number }; conditionalCoverage: { pValue: number } }>;
    }[];
  };
}>('var');
const volFixture = loadFixture<{
  reference: { rollingVolatility: Record<string, (number | null)[]>; ewmaVariance: Record<string, number[]> };
}>('realized_vol');

const btcPrices: StoredPrice[] = returnsFixture.prices.map((price, i) => ({
  date: new Date(returnsFixture.timestamps[i]).toISOString().slice(0, 10),
  timestamp: returnsFixture.timestamps[i],
  price,
}));

function daily(prices: number[], start = Date.UTC(2026, 0, 1)): StoredPrice[] {
  return prices.map((price, i) => ({
    date: new Date(start + i * 86_400_000).toISOString().slice(0, 10),
    timestamp: start + i * 86_400_000,
    price,
  }));
}

function relativeError(actual: number, expected: number): number {
  return Math.abs(actual - expected) / Math.abs(expected);
}

describe('summarizeRisk on the validated BTC sample', () => {
  const summary = summarizeRisk('bitcoin', btcPrices);
  const annualFactor = Math.sqrt(returnsFixture.reference.periodsPerYear) * 100;

  it('annualizes the latest rolling volatility for each window', () => {
    for (const { windowDays, annualizedVolatility } of summary.realizedVolatility) {
      const series = volFixture.reference.rollingVolatility[String(windowDays)];
      const expected = (series[series.length - 1] as number) * annualFactor;
      expect(relativeError(annualizedVolatility as number, expected)).toBeLessThan(1e-12);
    }
  });

  it('annualizes the latest EWMA variance with decay 0.94', () => {
    const series = volFixture.reference.ewmaVariance['0.94'];
    const expected = Math.sqrt(series[series.length - 1]) * annualFactor;
    expect(relativeError(summary.ewmaVolatility as number, expected)).toBeLessThan(1e-12);
  });

  it('forecasts volatility with HAR-RV over 1, 7 and 30 days', () => {
    const forecast = summary.volatilityForecast!;
    const daily = harFixture.reference.forecastVariance;

    expect(relativeError(forecast.coefficients.daily, harFixture.reference.params.daily)).toBeLessThan(1e-9);
    expect(relativeError(forecast.rSquared, harFixture.reference.rSquared)).toBeLessThan(1e-9);
    for (const { days, annualizedVolatility } of forecast.horizons) {
      const average = daily.slice(0, days).reduce((sum, v) => sum + v, 0) / days;
      expect(relativeError(annualizedVolatility, Math.sqrt(average) * annualFactor)).toBeLessThan(1e-9);
    }
    expect(forecast.horizons.map(h => h.days)).toEqual([1, 7, 30]);
  });

  it('reports one-day VaR, expected shortfall and backtests for each method', () => {
    const summary = summarizeRisk('bitcoin', btcPrices);
    const v = summary.valueAtRisk!;

    expect(v.windowDays).toBe(180);
    expect(relativeError(v.studentTDegreesOfFreedom, varFixture.reference.studentT.dof)).toBeLessThan(1e-5);
    v.levels.forEach((level, i) => {
      const ref = varFixture.reference.levels[i];
      expect(level.confidence).toBe(ref.confidence);
      for (const m of level.methods) {
        const r = ref.methods[m.method];
        expect(relativeError(m.valueAtRisk, r.valueAtRisk)).toBeLessThan(1e-6);
        expect(relativeError(m.expectedShortfall, r.expectedShortfall)).toBeLessThan(1e-6);
        expect(m.backtest.days).toBe(r.days);
        expect(m.backtest.exceptions).toBe(r.exceptions.length);
        expect(m.backtest.expectedExceptions).toBeCloseTo(r.days * (1 - ref.confidence), 10);
        expect(m.backtest.passes).toBe(r.kupiec.pValue >= 0.05 && r.conditionalCoverage.pValue >= 0.05);
      }
    });
    // The normal model's 95% VaR was too cautious over the test period: 3 exceptions where 9 were expected
    expect(v.levels[0].methods.find(m => m.method === 'normal')!.backtest.passes).toBe(false);
  });

  it('reports the return distribution, date and coverage', () => {
    const expected = returnsFixture.reference.logReturnMoments;
    expect(relativeError(summary.returnDistribution!.skewness, expected.skewness)).toBeLessThan(1e-10);
    expect(relativeError(summary.returnDistribution!.excessKurtosis, expected.excessKurtosis)).toBeLessThan(1e-10);
    expect(summary.asOf).toBe('2026-10-21');
    expect(summary.observations).toBe(364);
    expect(summary.missingDays).toBe(0);
  });
});

describe('summarizeRisk', () => {
  it('leaves windows longer than the history empty', () => {
    const summary = summarizeRisk('newcoin', daily([1, 1.1, 1.05, 1.2, 1.15, 1.3, 1.25, 1.4, 1.35, 1.5]));

    expect(summary.realizedVolatility.map(v => v.annualizedVolatility === null)).toEqual([false, true, true]);
    expect(summary.ewmaVolatility).not.toBeNull();
    expect(summary.returnDistribution).not.toBeNull();
  });

  it('needs 120 returns before forecasting', () => {
    expect(summarizeRisk('btc-short', btcPrices.slice(-120)).volatilityForecast).toBeNull();
    expect(summarizeRisk('btc-enough', btcPrices.slice(-121)).volatilityForecast).not.toBeNull();
  });

  it('skips the forecast for a price that never moves', () => {
    const summary = summarizeRisk('tokenized-fund', daily(new Array(200).fill(1)));
    expect(summary.volatilityForecast).toBeNull();
    expect(summary.realizedVolatility[1].annualizedVolatility).toBe(0);
  });

  it('skips the forecast when a negative coefficient drives a forecast variance below zero', () => {
    vi.mocked(harForecastVariance).mockReturnValueOnce(new Array(30).fill(1e-4).map((v, i) => (i === 20 ? -1e-5 : v)));
    expect(summarizeRisk('bitcoin', btcPrices).volatilityForecast).toBeNull();
  });

  it('needs 240 returns to estimate VaR on 180 and backtest it on at least 60', () => {
    expect(summarizeRisk('btc-short', btcPrices.slice(-240)).valueAtRisk).toBeNull();
    expect(summarizeRisk('btc-enough', btcPrices.slice(-241)).valueAtRisk).not.toBeNull();
  });

  it('skips VaR when the price was flat for a whole window', () => {
    const flatThenMoving = daily([...new Array(200).fill(1), ...btcPrices.slice(-100).map(p => p.price)]);
    expect(summarizeRisk('was-pegged', flatThenMoving).valueAtRisk).toBeNull();
  });

  it('counts days missing between the first and last stored price', () => {
    const prices = daily([100, 101, 102, 103, 104]).filter((_, i) => i !== 2);
    expect(summarizeRisk('gappy', prices).missingDays).toBe(1);
  });

  it('returns an empty summary for a coin with no stored prices', () => {
    expect(summarizeRisk('unknown', [])).toEqual({
      coinId: 'unknown',
      asOf: null,
      observations: 0,
      missingDays: 0,
      realizedVolatility: [
        { windowDays: 7, annualizedVolatility: null },
        { windowDays: 30, annualizedVolatility: null },
        { windowDays: 90, annualizedVolatility: null },
      ],
      ewmaVolatility: null,
      returnDistribution: null,
      volatilityForecast: null,
      valueAtRisk: null,
    });
  });
});

describe('getRiskSummary', () => {
  beforeEach(() => {
    vi.mocked(getDailyPrices).mockReset();
  });

  it('reads the last 365 days of stored prices once and caches the result', async () => {
    vi.mocked(getDailyPrices).mockResolvedValue(btcPrices);
    const now = Date.UTC(2026, 9, 22, 12);

    const first = await getRiskSummary('cache-test-coin', now);
    const second = await getRiskSummary('cache-test-coin', now);

    expect(getDailyPrices).toHaveBeenCalledTimes(1);
    expect(getDailyPrices).toHaveBeenCalledWith('cache-test-coin', '2025-10-22');
    expect(second).toEqual(first);
  });

  it('rejects ids that are not CoinGecko coin ids', async () => {
    await expect(getRiskSummary('Bitcoin; DROP')).rejects.toThrow('Invalid coin id');
    await expect(getRiskSummary('x'.repeat(101))).rejects.toThrow('Invalid coin id');
    expect(getDailyPrices).not.toHaveBeenCalled();
  });
});
