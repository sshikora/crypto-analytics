import { coinGeckoService, CoinGeckoMarketData, CoinGeckoPriceHistory } from '../services/coinGeckoService';
import { DailyPricePoint, savePricePoint } from '../repositories/priceHistoryRepository';

const DAY_MS = 86_400_000;
const WRITE_CONCURRENCY = 10;

export interface IngestOptions {
  days: number;
  universeSize?: number;
  // Demo CoinGecko keys allow 30 calls a minute.
  delayMs?: number;
  retryDelaysMs?: number[];
  now?: Date;
}

export interface IngestSummary {
  coins: number;
  written: number;
  existing: number;
  failed: string[];
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function withRetry<T>(fn: () => Promise<T>, delaysMs: number[]): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= delaysMs.length) throw error;
      await sleep(delaysMs[attempt]);
    }
  }
}

// CoinGecko's daily series holds midnight-UTC snapshots plus one live point for the current moment; only snapshots are kept.
export function toDailyPoints(
  coin: Pick<CoinGeckoMarketData, 'id' | 'symbol'>,
  history: CoinGeckoPriceHistory,
  now: Date
): DailyPricePoint[] {
  const marketCaps = new Map(history.market_caps.map(([ts, value]) => [ts, value]));
  const volumes = new Map(history.total_volumes.map(([ts, value]) => [ts, value]));

  return history.prices
    .filter(([ts, price]) => ts % DAY_MS === 0 && ts <= now.getTime() && Number.isFinite(price) && price > 0)
    .map(([ts, price]) => ({
      coinId: coin.id,
      symbol: coin.symbol.toUpperCase(),
      date: new Date(ts).toISOString().slice(0, 10),
      timestamp: ts,
      price,
      marketCap: marketCaps.get(ts) ?? null,
      volume: volumes.get(ts) ?? null,
    }));
}

export async function ingestPriceHistory(options: IngestOptions): Promise<IngestSummary> {
  const {
    days,
    universeSize = 100,
    delayMs = 2500,
    retryDelaysMs = [30_000, 60_000],
    now = new Date(),
  } = options;

  const universe = (await withRetry(() => coinGeckoService.getMarketData(), retryDelaysMs)).slice(0, universeSize);
  const summary: IngestSummary = { coins: universe.length, written: 0, existing: 0, failed: [] };

  for (const [index, coin] of universe.entries()) {
    if (index > 0) await sleep(delayMs);

    try {
      const history = await withRetry(() => coinGeckoService.getDailyHistory(coin.id, days), retryDelaysMs);
      const points = toDailyPoints(coin, history, now);

      for (let i = 0; i < points.length; i += WRITE_CONCURRENCY) {
        const outcomes = await Promise.all(points.slice(i, i + WRITE_CONCURRENCY).map(savePricePoint));
        for (const outcome of outcomes) summary[outcome]++;
      }
    } catch (error: any) {
      console.error(`[ingest-prices] ${coin.id} failed: ${error?.message ?? error}`);
      summary.failed.push(coin.id);
    }
  }

  return summary;
}
