import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

export const dynamodb = DynamoDBDocumentClient.from(client);

export interface UserPreferences {
  userId: string;
  colorMode: string;
  enabledMAPeriods: number[];
  defaultTimeRange: string;
  showDifference: boolean;
  dashboardCoins?: string[];
}

const TABLE_NAME = process.env.DYNAMODB_PREFERENCES_TABLE || 'crypto-analytics-production-user-preferences';

export async function getUserPreferences(userId: string): Promise<UserPreferences | null> {
  try {
    const result = await dynamodb.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { userId },
      })
    );

    return result.Item as UserPreferences | null;
  } catch (error) {
    console.error('Error getting user preferences:', error);
    return null;
  }
}

export async function saveUserPreferences(preferences: UserPreferences): Promise<UserPreferences> {
  try {
    await dynamodb.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: preferences,
      })
    );

    return preferences;
  } catch (error) {
    console.error('Error saving user preferences:', error);
    throw new Error('Failed to save user preferences');
  }
}
