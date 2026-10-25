import { beforeEach, describe, expect, it, vi } from 'vitest';
import { computeMetrics } from './computeMetrics';
import { coinGeckoService } from '../services/coinGeckoService';
import { computeRiskSummary, RISK_SUMMARY_VERSION, RiskSummary } from '../services/riskService';
import { saveRiskSummary } from '../repositories/coinMetricsRepository';

vi.mock('../services/coinGeckoService', () => ({ coinGeckoService: { getMarketData: vi.fn() } }));
vi.mock('../services/riskService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/riskService')>()),
  computeRiskSummary: vi.fn(),
}));
vi.mock('../repositories/coinMetricsRepository', () => ({ saveRiskSummary: vi.fn() }));

const now = new Date('2026-10-26T01:00:00Z');

function summaryFor(coinId: string, asOf: string | null): RiskSummary {
  return { coinId, asOf, observations: asOf ? 366 : 0 } as RiskSummary;
}

describe('computeMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(coinGeckoService.getMarketData).mockResolvedValue(
      ['bitcoin', 'ethereum', 'brand-new', 'broken'].map(id => ({ id })) as never
    );
    vi.mocked(computeRiskSummary).mockImplementation(async (coinId) => {
      if (coinId === 'broken') throw new Error('throttled');
      return summaryFor(coinId, coinId === 'brand-new' ? null : '2026-10-26');
    });
  });

  it('stores a summary for each coin with prices, under its price date and the current version', async () => {
    const result = await computeMetrics({ now, retryDelaysMs: [] });

    expect(result).toEqual({ coins: 4, written: 2, skipped: ['brand-new'], failed: ['broken'] });
    expect(computeRiskSummary).toHaveBeenCalledWith('bitcoin', now.getTime());
    expect(saveRiskSummary).toHaveBeenCalledWith(
      '2026-10-26',
      summaryFor('bitcoin', '2026-10-26'),
      RISK_SUMMARY_VERSION,
      '2026-10-26T01:00:00.000Z'
    );
    expect(saveRiskSummary).toHaveBeenCalledTimes(2);
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
