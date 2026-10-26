import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { dynamodb } from '../db/dynamodb';
import type { MarketRiskRow, RiskSummary } from '../services/riskService';

export interface StoredRiskSummary {
  riskSummary: RiskSummary;
  version: number;
  computedAt: string;
}

// The coin id pattern has no underscores, so this key can never collide with a coin
const MARKET_KEY = '__market__';

export interface StoredMarketSnapshot {
  rows: MarketRiskRow[];
  version: number;
  computedAt: string;
}

function tableName(): string {
  return process.env.DYNAMODB_COIN_METRICS_TABLE || 'crypto-analytics-production-coin-metrics';
}

// One row per coin per price date; a rerun on the same day replaces the row
export async function saveRiskSummary(
  date: string,
  riskSummary: RiskSummary,
  version: number,
  computedAt: string
): Promise<void> {
  await dynamodb.send(
    new PutCommand({
      TableName: tableName(),
      Item: { coinId: riskSummary.coinId, date, version, computedAt, riskSummary },
    })
  );
}

export async function getLatestRiskSummary(coinId: string): Promise<StoredRiskSummary | null> {
  const result = await dynamodb.send(
    new QueryCommand({
      TableName: tableName(),
      KeyConditionExpression: '#coinId = :coinId',
      ExpressionAttributeNames: { '#coinId': 'coinId' },
      ExpressionAttributeValues: { ':coinId': coinId },
      ScanIndexForward: false,
      Limit: 1,
    })
  );
  return (result.Items?.[0] as StoredRiskSummary | undefined) ?? null;
}

export async function saveMarketSnapshot(
  date: string,
  rows: MarketRiskRow[],
  version: number,
  computedAt: string
): Promise<void> {
  await dynamodb.send(
    new PutCommand({
      TableName: tableName(),
      Item: { coinId: MARKET_KEY, date, version, computedAt, rows },
    })
  );
}

export async function getLatestMarketSnapshot(): Promise<StoredMarketSnapshot | null> {
  const result = await dynamodb.send(
    new QueryCommand({
      TableName: tableName(),
      KeyConditionExpression: '#coinId = :coinId',
      ExpressionAttributeNames: { '#coinId': 'coinId' },
      ExpressionAttributeValues: { ':coinId': MARKET_KEY },
      ScanIndexForward: false,
      Limit: 1,
    })
  );
  return (result.Items?.[0] as StoredMarketSnapshot | undefined) ?? null;
}
