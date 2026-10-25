import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ingestPriceHistory, toDailyPoints } from './ingestPriceHistory';
import { coinGeckoService } from '../services/coinGeckoService';
import { getEarliestStoredDate, savePricePoint } from '../repositories/priceHistoryRepository';

vi.mock('../services/coinGeckoService', () => ({
  coinGeckoService: { getMarketData: vi.fn(), getDailyHistory: vi.fn() },
}));
vi.mock('../repositories/priceHistoryRepository', () => ({ savePricePoint: vi.fn(), getEarliestStoredDate: vi.fn() }));

const DAY = 86_400_000;
const MIDNIGHT = Date.UTC(2026, 9, 21);
const NOW = new Date(MIDNIGHT + 10 * 3_600_000);

function history(timestamps: number[]) {
  return {
    prices: timestamps.map((ts, i) => [ts, 100 + i] as [number, number]),
    market_caps: timestamps.map((ts, i) => [ts, 1e9 + i] as [number, number]),
    total_volumes: timestamps.map((ts, i) => [ts, 1e6 + i] as [number, number]),
  };
}

describe('toDailyPoints', () => {
  it('keeps midnight snapshots and drops the live point', () => {
    const points = toDailyPoints(
      { id: 'bitcoin', symbol: 'btc' },
      history([MIDNIGHT - DAY, MIDNIGHT, NOW.getTime()]),
      NOW
    );

    expect(points).toEqual([
      { coinId: 'bitcoin', symbol: 'BTC', date: '2026-10-20', timestamp: MIDNIGHT - DAY, price: 100, marketCap: 1e9, volume: 1e6 },
      { coinId: 'bitcoin', symbol: 'BTC', date: '2026-10-21', timestamp: MIDNIGHT, price: 101, marketCap: 1e9 + 1, volume: 1e6 + 1 },
    ]);
  });

  it('drops snapshots after now and non-positive prices', () => {
    const data = history([MIDNIGHT - DAY, MIDNIGHT, MIDNIGHT + DAY]);
    data.prices[0][1] = 0;
    expect(toDailyPoints({ id: 'x', symbol: 'x' }, data, NOW).map((p) => p.date)).toEqual(['2026-10-21']);
  });

  it('stores null when market cap or volume is missing', () => {
    const data = { ...history([MIDNIGHT]), market_caps: [], total_volumes: [] };
    const [point] = toDailyPoints({ id: 'x', symbol: 'x' }, data, NOW);
    expect(point.marketCap).toBeNull();
    expect(point.volume).toBeNull();
  });
});

describe('ingestPriceHistory', () => {
  const coins = [
    { id: 'bitcoin', symbol: 'btc' },
    { id: 'ethereum', symbol: 'eth' },
    { id: 'solana', symbol: 'sol' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(coinGeckoService.getMarketData).mockResolvedValue(coins as any);
    vi.mocked(coinGeckoService.getDailyHistory).mockResolvedValue(history([MIDNIGHT - DAY, MIDNIGHT]));
    vi.mocked(savePricePoint).mockResolvedValue('written');
    // Established coins hold a year of history from the original backfill
    vi.mocked(getEarliestStoredDate).mockResolvedValue('2025-10-20');
  });

  const run = (extra = {}) => ingestPriceHistory({ days: 3, delayMs: 0, retryDelaysMs: [0], now: NOW, ...extra });

  it('writes every coin in the universe and counts outcomes', async () => {
    vi.mocked(savePricePoint).mockResolvedValueOnce('existing');

    const summary = await run();

    expect(coinGeckoService.getDailyHistory).toHaveBeenCalledWith('bitcoin', 3);
    expect(summary).toEqual({ coins: 3, written: 5, existing: 1, failed: [], backfilled: [] });
  });

  it('fetches a whole year for a coin with no stored history', async () => {
    vi.mocked(getEarliestStoredDate).mockImplementation(async (coinId) => (coinId === 'solana' ? null : '2025-10-20'));

    const summary = await run();

    expect(coinGeckoService.getDailyHistory).toHaveBeenCalledWith('bitcoin', 3);
    expect(coinGeckoService.getDailyHistory).toHaveBeenCalledWith('solana', 365);
    expect(summary.backfilled).toEqual(['solana']);
  });

  it('keeps fetching a whole year for a coin younger than the window', async () => {
    // NOW is 2026-10-21, so the window starts 2025-10-22
    vi.mocked(getEarliestStoredDate).mockImplementation(async (coinId) => (coinId === 'ethereum' ? '2026-09-30' : '2025-10-22'));

    const summary = await run();

    expect(coinGeckoService.getDailyHistory).toHaveBeenCalledWith('ethereum', 365);
    expect(coinGeckoService.getDailyHistory).toHaveBeenCalledWith('bitcoin', 3);
    expect(summary.backfilled).toEqual(['ethereum']);
  });

  it('skips the check on a full-window run', async () => {
    const summary = await run({ days: 365 });
    expect(getEarliestStoredDate).not.toHaveBeenCalled();
    expect(summary.backfilled).toEqual([]);
  });

  it('records a coin as failed when the history check throws', async () => {
    vi.mocked(getEarliestStoredDate).mockRejectedValueOnce(new Error('throttled'));
    const summary = await run();
    expect(summary.failed).toEqual(['bitcoin']);
  });

  it('limits the universe size', async () => {
    const summary = await run({ universeSize: 2 });
    expect(summary.coins).toBe(2);
    expect(coinGeckoService.getDailyHistory).not.toHaveBeenCalledWith('solana', 3);
  });

  it('retries a failed fetch before giving up on the coin', async () => {
    vi.mocked(coinGeckoService.getDailyHistory)
      .mockRejectedValueOnce(new Error('429'))
      .mockRejectedValueOnce(new Error('429'))
      .mockRejectedValueOnce(new Error('429'));

    const summary = await run();

    // bitcoin fails twice (one retry) and is skipped; ethereum's first call fails and its retry succeeds.
    expect(summary.failed).toEqual(['bitcoin']);
    expect(summary.written).toBe(4);
  });

  it('records a coin as failed when a write throws', async () => {
    vi.mocked(savePricePoint).mockRejectedValueOnce(new Error('throttled'));
    const summary = await run();
    expect(summary.failed).toEqual(['bitcoin']);
  });
});
