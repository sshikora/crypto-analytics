import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getLatestMarketSnapshot, getLatestRiskSummary, saveMarketSnapshot, saveRiskSummary } from './coinMetricsRepository';
import { dynamodb } from '../db/dynamodb';
import type { RiskSummary } from '../services/riskService';

vi.mock('../db/dynamodb', () => ({ dynamodb: { send: vi.fn() } }));

const summary = { coinId: 'bitcoin', asOf: '2026-10-25', observations: 366 } as RiskSummary;

describe('coinMetricsRepository', () => {
  beforeEach(() => {
    vi.mocked(dynamodb.send).mockReset();
  });

  it('stores a summary under its coin and price date with the version that computed it', async () => {
    vi.mocked(dynamodb.send).mockResolvedValue({} as never);

    await saveRiskSummary('2026-10-25', summary, 1, '2026-10-25T01:00:00.000Z');

    const input = vi.mocked(dynamodb.send).mock.calls[0][0].input as any;
    expect(input.Item).toEqual({
      coinId: 'bitcoin',
      date: '2026-10-25',
      version: 1,
      computedAt: '2026-10-25T01:00:00.000Z',
      riskSummary: summary,
    });
  });

  it('reads the newest row for a coin', async () => {
    const row = { riskSummary: summary, version: 1, computedAt: '2026-10-25T01:00:00.000Z' };
    vi.mocked(dynamodb.send).mockResolvedValue({ Items: [row] } as never);

    await expect(getLatestRiskSummary('bitcoin')).resolves.toEqual(row);

    const input = vi.mocked(dynamodb.send).mock.calls[0][0].input as any;
    expect(input.ExpressionAttributeValues).toEqual({ ':coinId': 'bitcoin' });
    expect(input.ScanIndexForward).toBe(false);
    expect(input.Limit).toBe(1);
  });

  it('stores and reads the market snapshot under a key no coin can have', async () => {
    vi.mocked(dynamodb.send).mockResolvedValue({ Items: [{ rows: [], version: 5, computedAt: 't' }] } as never);

    await saveMarketSnapshot('2026-10-26', [], 5, 't');
    await getLatestMarketSnapshot();

    const put = vi.mocked(dynamodb.send).mock.calls[0][0].input as any;
    const query = vi.mocked(dynamodb.send).mock.calls[1][0].input as any;
    expect(put.Item).toEqual({ coinId: '__market__', date: '2026-10-26', version: 5, computedAt: 't', rows: [] });
    expect(query.ExpressionAttributeValues).toEqual({ ':coinId': '__market__' });
    expect(query.ScanIndexForward).toBe(false);
  });

  it('returns null for a coin with no rows', async () => {
    vi.mocked(dynamodb.send).mockResolvedValue({ Items: [] } as never);
    await expect(getLatestRiskSummary('newcoin')).resolves.toBeNull();
  });
});
