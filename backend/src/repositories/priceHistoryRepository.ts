import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
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
