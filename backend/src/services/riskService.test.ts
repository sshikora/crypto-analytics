import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getMarketRisk, getRiskSummary, marketRiskRow, RISK_SUMMARY_VERSION, summarizeRisk } from './riskService';
import { getLatestMarketSnapshot, getLatestRiskSummary } from '../repositories/coinMetricsRepository';
import { getDailyPrices, StoredPrice } from '../repositories/priceHistoryRepository';
import { harForecastVariance } from '../models/har';

vi.mock('../repositories/priceHistoryRepository', () => ({ getDailyPrices: vi.fn() }));
vi.mock('../repositories/coinMetricsRepository', () => ({ getLatestRiskSummary: vi.fn(), getLatestMarketSnapshot: vi.fn() }));
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
const garchFixture = JSON.parse(
  readFileSync(join(__dirname, '..', 'test', 'fixtures', 'garch', 'btc_daily_diagnostics.json'), 'utf8')
) as {
  reference: {
    aic: number;
    halfLifeDays: number;
    observations: number;
    ljungBoxResiduals: { pValue: number };
    forecast: { days: number; annualizedVolatility: number }[];
  };
};
const performanceFixture = JSON.parse(
  readFileSync(join(__dirname, '..', 'test', 'fixtures', 'performance', 'btc_eth_daily.json'), 'utf8')
) as {
  dates: string[];
  timestamps: number[];
  coins: Record<string, { prices: number[]; annualizedReturn: number; sharpe: number; maxDrawdown: number; worstDays: { date: string }[] }>;
  ethereumBeta: { days365: { beta: number; correlation: number }; days90: { beta: number } };
};
const ethPrices: StoredPrice[] = performanceFixture.coins.ethereum.prices.map((price, i) => ({
  date: performanceFixture.dates[i],
  timestamp: performanceFixture.timestamps[i],
  price,
}));
const regimeFixture = JSON.parse(
  readFileSync(join(__dirname, '..', 'test', 'fixtures', 'regime', 'btc_eth_daily.json'), 'utf8')
) as { coins: { bitcoin: { cases: { closes: number; trend: string; volatilityLevel: string; volatilityPercentile: number }[] } } };
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
        expect(relativeError(m.valueAtRisk, r.valueAtRisk)).toBeLessThan(1e-5);
        expect(relativeError(m.expectedShortfall, r.expectedShortfall)).toBeLessThan(1e-5);
        expect(m.backtest.days).toBe(r.days);
        expect(m.backtest.exceptions).toBe(r.exceptions.length);
        expect(m.backtest.expectedExceptions).toBeCloseTo(r.days * (1 - ref.confidence), 10);
        expect(m.backtest.passes).toBe(r.kupiec.pValue >= 0.05 && r.conditionalCoverage.pValue >= 0.05);
      }
    });
    expect(v.levels[0].methods.map(m => m.method)).toEqual(['historical', 'normal', 'studentT', 'filteredHistorical']);
    // The normal model's 95% VaR was too cautious over the test period: 3 exceptions where 9 were expected
    expect(v.levels[0].methods.find(m => m.method === 'normal')!.backtest.passes).toBe(false);
  });

  it('fits GARCH(1,1) to the daily returns with diagnostics', () => {
    const g = summarizeRisk('bitcoin', btcPrices).garch!;
    const ref = garchFixture.reference;

    expect(g.observations).toBe(ref.observations);
    expect(Math.abs(g.aic - ref.aic)).toBeLessThan(2e-4);
    expect(relativeError(g.halfLifeDays, ref.halfLifeDays)).toBeLessThan(1e-2);
    expect(Math.abs(g.ljungBoxResiduals.pValue - ref.ljungBoxResiduals.pValue)).toBeLessThan(1e-3);
    g.forecast.forEach((f, i) => {
      expect(f.days).toBe(ref.forecast[i].days);
      expect(relativeError(f.annualizedVolatility, ref.forecast[i].annualizedVolatility)).toBeLessThan(1e-3);
    });
    // One point per likelihood term, dated by the close each return ends on
    expect(g.conditionalVolatility).toHaveLength(ref.observations);
    expect(g.conditionalVolatility[0].date).toBe(btcPrices[2].date);
    expect(g.conditionalVolatility[g.conditionalVolatility.length - 1].date).toBe(btcPrices[btcPrices.length - 1].date);
    expect(g.normalQq).toHaveLength(ref.observations);
  });

  it('needs 120 returns and a price that moves to fit GARCH', () => {
    expect(summarizeRisk('btc-short', btcPrices.slice(-120)).garch).toBeNull();
    expect(summarizeRisk('btc-enough', btcPrices.slice(-121)).garch).not.toBeNull();
    expect(summarizeRisk('flat', daily(new Array(200).fill(1))).garch).toBeNull();
  });

  it('reports return, risk-adjusted ratios, drawdowns and worst days', () => {
    const p = summarizeRisk('bitcoin', btcPrices).performance!;
    const ref = performanceFixture.coins.bitcoin;

    expect(relativeError(p.annualizedReturn, ref.annualizedReturn)).toBeLessThan(1e-12);
    expect(relativeError(p.sharpeRatio!, ref.sharpe)).toBeLessThan(1e-12);
    expect(relativeError(p.drawdown.maxDrawdown, ref.maxDrawdown)).toBeLessThan(1e-12);
    expect(p.worstDays.map(d => d.date)).toEqual(ref.worstDays.map(d => d.date));
    // Bitcoin is its own benchmark
    expect(p.betaToBitcoin!.map(b => b.beta)).toEqual([expect.closeTo(1, 12), expect.closeTo(1, 12)]);
  });

  it("measures another coin's beta to Bitcoin on matching dates", () => {
    const gappyBtc = btcPrices.filter((_, i) => i !== 100);
    const beta = summarizeRisk('ethereum', ethPrices, btcPrices).performance!.betaToBitcoin!;

    expect(beta.map(b => [b.windowDays, b.observations])).toEqual([[365, 363], [90, 90]]);
    expect(relativeError(beta[0].beta, performanceFixture.ethereumBeta.days365.beta)).toBeLessThan(1e-12);
    expect(relativeError(beta[0].correlation, performanceFixture.ethereumBeta.days365.correlation)).toBeLessThan(1e-12);
    expect(relativeError(beta[1].beta, performanceFixture.ethereumBeta.days90.beta)).toBeLessThan(1e-12);
    // A date missing from Bitcoin's history drops out of both series
    expect(summarizeRisk('ethereum', ethPrices, gappyBtc).performance!.betaToBitcoin![0].observations).toBe(362);
  });

  it('needs 90 returns for performance, and reports undefined ratios as null', () => {
    expect(summarizeRisk('btc-short', btcPrices.slice(-90)).performance).toBeNull();
    const flat = summarizeRisk('flat', daily(new Array(200).fill(1)));
    expect(flat.performance).toMatchObject({ sharpeRatio: null, sortinoRatio: null, calmarRatio: null, betaToBitcoin: null });
  });

  it('labels the trend and volatility regime', () => {
    const expected = regimeFixture.coins.bitcoin.cases.find(c => c.closes === btcPrices.length)!;
    const r = summarizeRisk('bitcoin', btcPrices).regime!;

    expect([r.trend, r.volatilityLevel]).toEqual([expected.trend, expected.volatilityLevel]);
    expect(Math.abs(r.volatilityPercentile - expected.volatilityPercentile)).toBeLessThan(1e-12);
    expect(summarizeRisk('btc-short', btcPrices.slice(-199)).regime).toBeNull();
    expect(summarizeRisk('flat', daily(new Array(250).fill(1))).regime).toBeNull();
  });

  it('condenses a summary into a Markets row with 30-day volatility, drawdown, 95% GARCH-filtered VaR and regime', () => {
    const summary = summarizeRisk('bitcoin', btcPrices);
    const fhs = summary.valueAtRisk!.levels[0].methods.find(m => m.method === 'filteredHistorical')!;

    expect(marketRiskRow('2026-10-21', summary)).toEqual({
      coinId: 'bitcoin',
      asOf: '2026-10-21',
      volatility30d: summary.realizedVolatility[1].annualizedVolatility,
      currentDrawdown: summary.performance!.drawdown.currentDrawdown,
      valueAtRisk95: fhs.valueAtRisk,
      regime: summary.regime,
    });
    expect(marketRiskRow('2026-10-21', summarizeRisk('new', btcPrices.slice(-20)))).toMatchObject({
      currentDrawdown: null,
      valueAtRisk95: null,
      regime: null,
    });
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
      garch: null,
      performance: null,
      regime: null,
    });
  });
});

describe('getRiskSummary', () => {
  beforeEach(() => {
    vi.mocked(getDailyPrices).mockReset();
    vi.mocked(getLatestRiskSummary).mockReset();
    vi.mocked(getLatestRiskSummary).mockResolvedValue(null);
  });

  it('serves the nightly job\'s stored summary without reading prices', async () => {
    const stored = summarizeRisk('stored-coin', btcPrices);
    vi.mocked(getLatestRiskSummary).mockResolvedValue({
      riskSummary: stored,
      version: RISK_SUMMARY_VERSION,
      computedAt: '2026-10-22T01:00:00.000Z',
    });

    await expect(getRiskSummary('stored-coin')).resolves.toEqual(stored);
    expect(getDailyPrices).not.toHaveBeenCalled();
  });

  it('recomputes when the stored row was written by an older version', async () => {
    vi.mocked(getLatestRiskSummary).mockResolvedValue({
      riskSummary: { coinId: 'old-shape' } as never,
      version: RISK_SUMMARY_VERSION - 1,
      computedAt: '2026-10-22T01:00:00.000Z',
    });
    vi.mocked(getDailyPrices).mockResolvedValue(btcPrices);

    const summary = await getRiskSummary('old-shape');

    // The coin's prices, then Bitcoin's as the beta benchmark
    expect(vi.mocked(getDailyPrices).mock.calls.map(c => c[0])).toEqual(['old-shape', 'bitcoin']);
    expect(summary.observations).toBe(364);
  });

  it("reads the last 365 days of the coin's and Bitcoin's prices once and caches the result", async () => {
    vi.mocked(getDailyPrices).mockResolvedValue(btcPrices);
    const now = Date.UTC(2026, 9, 22, 12);

    const first = await getRiskSummary('cache-test-coin', now);
    const second = await getRiskSummary('cache-test-coin', now);

    expect(vi.mocked(getDailyPrices).mock.calls).toEqual([
      ['cache-test-coin', '2025-10-22'],
      ['bitcoin', '2025-10-22'],
    ]);
    expect(second).toEqual(first);
  });

  it('rejects ids that are not CoinGecko coin ids', async () => {
    await expect(getRiskSummary('Bitcoin; DROP')).rejects.toThrow('Invalid coin id');
    await expect(getRiskSummary('x'.repeat(101))).rejects.toThrow('Invalid coin id');
    expect(getDailyPrices).not.toHaveBeenCalled();
  });
});

describe('getMarketRisk', () => {
  const rows = [{ coinId: 'bitcoin', asOf: '2026-10-26', volatility30d: 25, currentDrawdown: -0.27, valueAtRisk95: 0.027, regime: null }];

  beforeEach(() => {
    vi.mocked(getLatestMarketSnapshot).mockReset();
  });

  it('returns nothing until a snapshot in the current version exists, then caches it', async () => {
    vi.mocked(getLatestMarketSnapshot).mockResolvedValueOnce(null);
    await expect(getMarketRisk()).resolves.toBeNull();

    vi.mocked(getLatestMarketSnapshot).mockResolvedValueOnce({ rows, version: RISK_SUMMARY_VERSION - 1, computedAt: 'x' });
    await expect(getMarketRisk()).resolves.toBeNull();

    vi.mocked(getLatestMarketSnapshot).mockResolvedValueOnce({ rows, version: RISK_SUMMARY_VERSION, computedAt: '2026-10-26T01:00:00.000Z' });
    await expect(getMarketRisk()).resolves.toEqual({ computedAt: '2026-10-26T01:00:00.000Z', rows });
    await expect(getMarketRisk()).resolves.toEqual({ computedAt: '2026-10-26T01:00:00.000Z', rows });
    expect(getLatestMarketSnapshot).toHaveBeenCalledTimes(3);
  });
});
