import { beforeEach, describe, expect, it, vi } from 'vitest';
import { computeMetrics } from './computeMetrics';
import { coinGeckoService } from '../services/coinGeckoService';
import { computeRiskSummary, loadBenchmarkPrices, RISK_SUMMARY_VERSION, RiskSummary } from '../services/riskService';
import { saveMarketSnapshot, saveRiskSummary } from '../repositories/coinMetricsRepository';

vi.mock('../services/coinGeckoService', () => ({ coinGeckoService: { getMarketData: vi.fn() } }));
vi.mock('../services/riskService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/riskService')>()),
  computeRiskSummary: vi.fn(),
  loadBenchmarkPrices: vi.fn(),
}));
vi.mock('../repositories/coinMetricsRepository', () => ({ saveRiskSummary: vi.fn(), saveMarketSnapshot: vi.fn() }));

const now = new Date('2026-10-26T01:00:00Z');
const benchmark = [{ date: '2026-10-26', timestamp: 0, price: 80000 }];

function summaryFor(coinId: string, asOf: string | null): RiskSummary {
  return {
    coinId,
    asOf,
    observations: asOf ? 366 : 0,
    realizedVolatility: [{ windowDays: 30, annualizedVolatility: 25 }],
    valueAtRisk: null,
    performance: null,
    regime: null,
  } as unknown as RiskSummary;
}

describe('computeMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(coinGeckoService.getMarketData).mockResolvedValue(
      ['bitcoin', 'ethereum', 'brand-new', 'broken'].map(id => ({ id })) as never
    );
    vi.mocked(loadBenchmarkPrices).mockResolvedValue(benchmark);
    vi.mocked(computeRiskSummary).mockImplementation(async (coinId) => {
      if (coinId === 'broken') throw new Error('throttled');
      return summaryFor(coinId, coinId === 'brand-new' ? null : '2026-10-26');
    });
  });

  it('stores a summary for each coin with prices, under its price date and the current version', async () => {
    const result = await computeMetrics({ now, retryDelaysMs: [] });

    expect(result).toEqual({ coins: 4, written: 2, skipped: ['brand-new'], failed: ['broken'] });
    // Bitcoin's prices are loaded once and shared as every coin's beta benchmark
    expect(loadBenchmarkPrices).toHaveBeenCalledTimes(1);
    expect(computeRiskSummary).toHaveBeenCalledWith('bitcoin', now.getTime(), benchmark);
    expect(computeRiskSummary).toHaveBeenCalledWith('ethereum', now.getTime(), benchmark);
    expect(saveRiskSummary).toHaveBeenCalledWith(
      '2026-10-26',
      summaryFor('bitcoin', '2026-10-26'),
      RISK_SUMMARY_VERSION,
      '2026-10-26T01:00:00.000Z'
    );
    expect(saveRiskSummary).toHaveBeenCalledTimes(2);
  });

  it('stores one market snapshot row with every written coin, dated by the run', async () => {
    await computeMetrics({ now, retryDelaysMs: [] });

    expect(saveMarketSnapshot).toHaveBeenCalledTimes(1);
    const [date, rows, version, computedAt] = vi.mocked(saveMarketSnapshot).mock.calls[0];
    expect([date, version, computedAt]).toEqual(['2026-10-26', RISK_SUMMARY_VERSION, '2026-10-26T01:00:00.000Z']);
    expect(rows.map(r => r.coinId)).toEqual(['bitcoin', 'ethereum']);
    expect(rows[0]).toEqual({
      coinId: 'bitcoin',
      asOf: '2026-10-26',
      volatility30d: 25,
      currentDrawdown: null,
      valueAtRisk95: null,
      regime: null,
    });
  });

  it('limits the run to the top coins by market cap', async () => {
    const result = await computeMetrics({ now, retryDelaysMs: [], universeSize: 2 });
    expect(result.coins).toBe(2);
    expect(computeRiskSummary).toHaveBeenCalledTimes(2);
  });

  it('counts a failed save as a failed coin', async () => {
    vi.mocked(saveRiskSummary).mockRejectedValueOnce(new Error('denied'));
    const result = await computeMetrics({ now, retryDelaysMs: [], universeSize: 1 });
    expect(result).toEqual({ coins: 1, written: 0, skipped: [], failed: ['bitcoin'] });
  });
});
