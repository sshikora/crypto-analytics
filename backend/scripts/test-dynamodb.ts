import * as dotenv from 'dotenv';
dotenv.config();

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

const dynamodb = DynamoDBDocumentClient.from(client);

const RULES_TABLE = process.env.DYNAMODB_NOTIFICATION_RULES_TABLE || 'crypto-analytics-production-notification-rules';
const NOTIFICATIONS_TABLE = process.env.DYNAMODB_NOTIFICATIONS_TABLE || 'crypto-analytics-production-notifications';

async function testTables() {
  console.log('Testing DynamoDB access...\n');
  console.log('Environment variables:');
  console.log('  DYNAMODB_NOTIFICATION_RULES_TABLE:', process.env.DYNAMODB_NOTIFICATION_RULES_TABLE);
  console.log('  DYNAMODB_NOTIFICATIONS_TABLE:', process.env.DYNAMODB_NOTIFICATIONS_TABLE);
  console.log('  AWS_REGION:', process.env.AWS_REGION);
  console.log('\nUsing table names:');
  console.log('  RULES_TABLE:', RULES_TABLE);
  console.log('  NOTIFICATIONS_TABLE:', NOTIFICATIONS_TABLE);
  console.log();

  // Test query on notification-rules table
  try {
    console.log(`Querying ${RULES_TABLE}...`);
    const result = await dynamodb.send(
      new QueryCommand({
        TableName: RULES_TABLE,
        IndexName: 'userId-index',
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': 'test-user-id',
        },
        Limit: 1,
      })
    );
    console.log(`✓ Successfully queried ${RULES_TABLE}`);
    console.log(`  Items returned: ${result.Items?.length || 0}`);
  } catch (error: any) {
    console.error(`✗ Failed to query ${RULES_TABLE}:`);
    console.error(`  Error: ${error.message}`);
    console.error(`  Type: ${error.__type}`);
  }

  console.log();

  // Test query on notifications table
  try {
    console.log(`Querying ${NOTIFICATIONS_TABLE}...`);
    const result = await dynamodb.send(
      new QueryCommand({
        TableName: NOTIFICATIONS_TABLE,
        IndexName: 'userId-createdAt-index',
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': 'test-user-id',
        },
        Limit: 1,
      })
    );
    console.log(`✓ Successfully queried ${NOTIFICATIONS_TABLE}`);
    console.log(`  Items returned: ${result.Items?.length || 0}`);
  } catch (error: any) {
    console.error(`✗ Failed to query ${NOTIFICATIONS_TABLE}:`);
    console.error(`  Error: ${error.message}`);
    console.error(`  Type: ${error.__type}`);
  }
}

testTables().catch(console.error);
