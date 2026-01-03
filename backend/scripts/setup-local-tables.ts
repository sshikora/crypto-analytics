import { DynamoDBClient, CreateTableCommand, ListTablesCommand } from '@aws-sdk/client-dynamodb';

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

const PROJECT_NAME = 'crypto-analytics';
const ENVIRONMENT = 'local';

interface TableConfig {
  name: string;
  hashKey: string;
  rangeKey?: string;
  gsiConfig?: {
    indexName: string;
    hashKey: string;
    rangeKey?: string;
  };
  ttlAttribute?: string;
}

const tables: TableConfig[] = [
  {
    name: `${PROJECT_NAME}-${ENVIRONMENT}-notification-rules`,
    hashKey: 'ruleId',
    gsiConfig: {
      indexName: 'userId-index',
      hashKey: 'userId',
    },
  },
  {
    name: `${PROJECT_NAME}-${ENVIRONMENT}-notifications`,
    hashKey: 'notificationId',
    gsiConfig: {
      indexName: 'userId-createdAt-index',
      hashKey: 'userId',
      rangeKey: 'createdAt',
    },
    ttlAttribute: 'expiresAt',
  },
  {
    name: `${PROJECT_NAME}-${ENVIRONMENT}-email-rate-limits`,
    hashKey: 'userId',
    ttlAttribute: 'expiresAt',
  },
];

async function tableExists(tableName: string): Promise<boolean> {
  try {
    const response = await client.send(new ListTablesCommand({}));
    return response.TableNames?.includes(tableName) || false;
  } catch (error) {
    console.error('Error checking tables:', error);
    return false;
  }
}

async function createTable(config: TableConfig): Promise<void> {
  const { name, hashKey, rangeKey, gsiConfig, ttlAttribute } = config;

  // Build attribute definitions
  const attributeDefinitions: any[] = [
    { AttributeName: hashKey, AttributeType: 'S' },
  ];

  if (rangeKey) {
    attributeDefinitions.push({ AttributeName: rangeKey, AttributeType: 'S' });
  }

  if (gsiConfig) {
    if (!attributeDefinitions.find(attr => attr.AttributeName === gsiConfig.hashKey)) {
      attributeDefinitions.push({ AttributeName: gsiConfig.hashKey, AttributeType: 'S' });
    }
    if (gsiConfig.rangeKey && !attributeDefinitions.find(attr => attr.AttributeName === gsiConfig.rangeKey)) {
      attributeDefinitions.push({ AttributeName: gsiConfig.rangeKey, AttributeType: 'S' });
    }
  }

  // Build key schema
  const keySchema: any[] = [
    { AttributeName: hashKey, KeyType: 'HASH' },
  ];

  if (rangeKey) {
    keySchema.push({ AttributeName: rangeKey, KeyType: 'RANGE' });
  }

  // Build table creation params
  const params: any = {
    TableName: name,
    AttributeDefinitions: attributeDefinitions,
    KeySchema: keySchema,
    BillingMode: 'PAY_PER_REQUEST',
    Tags: [
      { Key: 'Environment', Value: ENVIRONMENT },
      { Key: 'Project', Value: PROJECT_NAME },
    ],
  };

  // Add GSI if configured
  if (gsiConfig) {
    const gsiKeySchema: any[] = [
      { AttributeName: gsiConfig.hashKey, KeyType: 'HASH' },
    ];
    if (gsiConfig.rangeKey) {
      gsiKeySchema.push({ AttributeName: gsiConfig.rangeKey, KeyType: 'RANGE' });
    }

    params.GlobalSecondaryIndexes = [
      {
        IndexName: gsiConfig.indexName,
        KeySchema: gsiKeySchema,
        Projection: { ProjectionType: 'ALL' },
      },
    ];
  }

  try {
    await client.send(new CreateTableCommand(params));
    console.log(`✓ Created table: ${name}`);

    // Note: TTL needs to be enabled separately via UpdateTimeToLive API
    // For local dev, we'll skip TTL since it's not critical
    if (ttlAttribute) {
      console.log(`  Note: TTL attribute '${ttlAttribute}' defined but not enabled (manual step if needed)`);
    }
  } catch (error: any) {
    if (error.name === 'ResourceInUseException') {
      console.log(`✓ Table already exists: ${name}`);
    } else {
      console.error(`✗ Failed to create table ${name}:`, error.message);
      throw error;
    }
  }
}

async function main() {
  console.log('Setting up local DynamoDB tables for notifications...\n');
  console.log(`Project: ${PROJECT_NAME}`);
  console.log(`Environment: ${ENVIRONMENT}`);
  console.log(`Region: ${process.env.AWS_REGION || 'us-east-1'}\n`);

  for (const tableConfig of tables) {
    const exists = await tableExists(tableConfig.name);
    if (exists) {
      console.log(`✓ Table already exists: ${tableConfig.name}`);
    } else {
      await createTable(tableConfig);
    }
  }

  console.log('\nSetup complete! Update your .env file with:');
  console.log(`DYNAMODB_NOTIFICATION_RULES_TABLE=${PROJECT_NAME}-${ENVIRONMENT}-notification-rules`);
  console.log(`DYNAMODB_NOTIFICATIONS_TABLE=${PROJECT_NAME}-${ENVIRONMENT}-notifications`);
  console.log(`DYNAMODB_EMAIL_RATE_LIMIT_TABLE=${PROJECT_NAME}-${ENVIRONMENT}-email-rate-limits`);
}

main().catch(console.error);
