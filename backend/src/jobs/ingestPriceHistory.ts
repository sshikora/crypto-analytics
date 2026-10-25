import { coinGeckoService, CoinGeckoMarketData, CoinGeckoPriceHistory } from '../services/coinGeckoService';
import { DailyPricePoint, getEarliestStoredDate, savePricePoint } from '../repositories/priceHistoryRepository';
import { sleep, withRetry } from './retry';

const DAY_MS = 86_400_000;
const WRITE_CONCURRENCY = 10;

export interface IngestOptions {
  days: number;
  // A coin with no stored history, or none older than this window, is fetched for the whole window
  backfillDays?: number;
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
  backfilled: string[];
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
    backfillDays = 365,
    universeSize = 100,
    delayMs = 2500,
    retryDelaysMs = [30_000, 60_000],
    now = new Date(),
  } = options;

  const universe = (await withRetry(() => coinGeckoService.getMarketData(), retryDelaysMs)).slice(0, universeSize);
  const summary: IngestSummary = { coins: universe.length, written: 0, existing: 0, failed: [], backfilled: [] };
  const backfillFrom = new Date(now.getTime() - (backfillDays - 1) * DAY_MS).toISOString().slice(0, 10);

  for (const [index, coin] of universe.entries()) {
    if (index > 0) await sleep(delayMs);

    try {
      // A coin that has just entered the top 100 would otherwise build its history a few days at a time.
      // Coins younger than the window are fetched in full each night; already-stored rows are left as they are.
      let fetchDays = days;
      if (days < backfillDays) {
        const earliest = await getEarliestStoredDate(coin.id);
        if (earliest === null || earliest > backfillFrom) {
          fetchDays = backfillDays;
          summary.backfilled.push(coin.id);
        }
      }

      const history = await withRetry(() => coinGeckoService.getDailyHistory(coin.id, fetchDays), retryDelaysMs);
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
