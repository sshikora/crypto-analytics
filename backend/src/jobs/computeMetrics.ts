import { coinGeckoService } from '../services/coinGeckoService';
import { computeRiskSummary, RISK_SUMMARY_VERSION } from '../services/riskService';
import { saveRiskSummary } from '../repositories/coinMetricsRepository';
import { withRetry } from './retry';

export interface MetricsOptions {
  universeSize?: number;
  retryDelaysMs?: number[];
  now?: Date;
}

export interface MetricsSummary {
  coins: number;
  written: number;
  // Coins with no stored prices yet, such as one that entered the top 100 today
  skipped: string[];
  failed: string[];
}

// Computes and stores the risk summary for the same top-100 universe the price ingest covers
export async function computeMetrics(options: MetricsOptions = {}): Promise<MetricsSummary> {
  const { universeSize = 100, retryDelaysMs = [30_000, 60_000], now = new Date() } = options;

  const universe = (await withRetry(() => coinGeckoService.getMarketData(), retryDelaysMs)).slice(0, universeSize);

  const summary: MetricsSummary = { coins: universe.length, written: 0, skipped: [], failed: [] };
  const computedAt = now.toISOString();

  for (const coin of universe) {
    try {
      const riskSummary = await computeRiskSummary(coin.id, now.getTime());
      if (riskSummary.asOf === null) {
        summary.skipped.push(coin.id);
        continue;
      }
      await saveRiskSummary(riskSummary.asOf, riskSummary, RISK_SUMMARY_VERSION, computedAt);
      summary.written++;
    } catch (error: any) {
      console.error(`[compute-metrics] ${coin.id} failed: ${error?.message ?? error}`);
      summary.failed.push(coin.id);
    }
  }

  return summary;
}
