import { QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { dynamodb } from '../db/dynamodb';

export interface DailyPricePoint {
  coinId: string;
  symbol: string;
  date: string;
  timestamp: number;
  price: number;
  marketCap: number | null;
  volume: number | null;
}

export type SaveOutcome = 'written' | 'existing';

export interface StoredPrice {
  date: string;
  timestamp: number;
  price: number;
}

function tableName(): string {
  return process.env.DYNAMODB_PRICE_HISTORY_TABLE || 'crypto-analytics-production-price-history';
}

// Rows are written once; a later fetch never replaces a stored CoinGecko price.
// Other sources can add their own attributes to the same coin/date row.
export async function savePricePoint(point: DailyPricePoint): Promise<SaveOutcome> {
  try {
    await dynamodb.send(
      new UpdateCommand({
        TableName: tableName(),
        Key: { coinId: point.coinId, date: point.date },
        UpdateExpression:
          'SET #symbol = :symbol, #timestamp = :timestamp, #price = :price, #marketCap = :marketCap, ' +
          '#volume = :volume, #priceSource = :priceSource, #fetchedAt = :fetchedAt',
        ConditionExpression: 'attribute_not_exists(#price)',
        ExpressionAttributeNames: {
          '#symbol': 'symbol',
          '#timestamp': 'timestamp',
          '#price': 'price',
          '#marketCap': 'marketCap',
          '#volume': 'volume',
          '#priceSource': 'priceSource',
          '#fetchedAt': 'fetchedAt',
        },
        ExpressionAttributeValues: {
          ':symbol': point.symbol,
          ':timestamp': point.timestamp,
          ':price': point.price,
          ':marketCap': point.marketCap,
          ':volume': point.volume,
          ':priceSource': 'coingecko',
          ':fetchedAt': new Date().toISOString(),
        },
      })
    );
    return 'written';
  } catch (error: any) {
    if (error?.name === 'ConditionalCheckFailedException') {
      return 'existing';
    }
    throw error;
  }
}

// Oldest first, since the sort key is the ISO date
export async function getDailyPrices(coinId: string, fromDate: string): Promise<StoredPrice[]> {
  const prices: StoredPrice[] = [];
  let startKey: Record<string, unknown> | undefined;

  do {
    const result = await dynamodb.send(
      new QueryCommand({
        TableName: tableName(),
        KeyConditionExpression: '#coinId = :coinId AND #date >= :fromDate',
        ProjectionExpression: '#date, #timestamp, #price',
        ExpressionAttributeNames: {
          '#coinId': 'coinId',
          '#date': 'date',
          '#timestamp': 'timestamp',
          '#price': 'price',
        },
        ExpressionAttributeValues: { ':coinId': coinId, ':fromDate': fromDate },
        ExclusiveStartKey: startKey,
      })
    );
    prices.push(...((result.Items ?? []) as StoredPrice[]));
    startKey = result.LastEvaluatedKey;
  } while (startKey);

  return prices;
}

// The oldest stored date for a coin, or null when nothing is stored yet
export async function getEarliestStoredDate(coinId: string): Promise<string | null> {
  const result = await dynamodb.send(
    new QueryCommand({
      TableName: tableName(),
      KeyConditionExpression: '#coinId = :coinId',
      ProjectionExpression: '#date',
      ExpressionAttributeNames: { '#coinId': 'coinId', '#date': 'date' },
      ExpressionAttributeValues: { ':coinId': coinId },
      ScanIndexForward: true,
      Limit: 1,
    })
  );
  return (result.Items?.[0]?.date as string | undefined) ?? null;
}
