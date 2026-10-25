import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDailyPrices, savePricePoint } from './priceHistoryRepository';
import { dynamodb } from '../db/dynamodb';

vi.mock('../db/dynamodb', () => ({ dynamodb: { send: vi.fn() } }));

const point = {
  coinId: 'bitcoin',
  symbol: 'BTC',
  date: '2026-10-21',
  timestamp: Date.UTC(2026, 9, 21),
  price: 82943.83,
  marketCap: 1.65e12,
  volume: 3.1e10,
};

describe('savePricePoint', () => {
  beforeEach(() => {
    vi.mocked(dynamodb.send).mockReset();
  });

  it('writes a new row only when no price is stored', async () => {
    vi.mocked(dynamodb.send).mockResolvedValue({} as never);

    await expect(savePricePoint(point)).resolves.toBe('written');

    const input = vi.mocked(dynamodb.send).mock.calls[0][0].input as any;
    expect(input.Key).toEqual({ coinId: 'bitcoin', date: '2026-10-21' });
    expect(input.ConditionExpression).toBe('attribute_not_exists(#price)');
    expect(input.ExpressionAttributeValues[':price']).toBe(82943.83);
    expect(input.ExpressionAttributeValues[':priceSource']).toBe('coingecko');
  });

  it('reports an existing row instead of overwriting it', async () => {
    vi.mocked(dynamodb.send).mockRejectedValue(Object.assign(new Error('exists'), { name: 'ConditionalCheckFailedException' }) as never);
    await expect(savePricePoint(point)).resolves.toBe('existing');
  });

  it('rethrows other errors', async () => {
    vi.mocked(dynamodb.send).mockRejectedValue(new Error('throttled') as never);
    await expect(savePricePoint(point)).rejects.toThrow('throttled');
  });
});

describe('getDailyPrices', () => {
  beforeEach(() => {
    vi.mocked(dynamodb.send).mockReset();
  });

  it('queries one coin from a date onwards and follows pagination', async () => {
    vi.mocked(dynamodb.send)
      .mockResolvedValueOnce({
        Items: [{ date: '2026-10-20', timestamp: 1, price: 10 }],
        LastEvaluatedKey: { coinId: 'bitcoin', date: '2026-10-20' },
      } as never)
      .mockResolvedValueOnce({ Items: [{ date: '2026-10-21', timestamp: 2, price: 11 }] } as never);

    const prices = await getDailyPrices('bitcoin', '2025-10-22');

    expect(prices.map(p => p.date)).toEqual(['2026-10-20', '2026-10-21']);
    const first = vi.mocked(dynamodb.send).mock.calls[0][0].input as any;
    expect(first.KeyConditionExpression).toBe('#coinId = :coinId AND #date >= :fromDate');
    expect(first.ExpressionAttributeValues).toEqual({ ':coinId': 'bitcoin', ':fromDate': '2025-10-22' });
    const second = vi.mocked(dynamodb.send).mock.calls[1][0].input as any;
    expect(second.ExclusiveStartKey).toEqual({ coinId: 'bitcoin', date: '2026-10-20' });
  });
});
