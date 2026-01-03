import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  DeleteCommand,
  QueryCommand,
  UpdateCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';

// Lazy initialization to ensure env vars are loaded after dotenv.config()
let _client: DynamoDBClient | null = null;
let _dynamodb: DynamoDBDocumentClient | null = null;

function getClient(): DynamoDBClient {
  if (!_client) {
    _client = new DynamoDBClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });
  }
  return _client;
}

function getDynamoDB(): DynamoDBDocumentClient {
  if (!_dynamodb) {
    _dynamodb = DynamoDBDocumentClient.from(getClient());
  }
  return _dynamodb;
}

// Table name getters - read env vars at runtime, not at module load time
function getRulesTable(): string {
  return process.env.DYNAMODB_NOTIFICATION_RULES_TABLE || 'crypto-analytics-production-notification-rules';
}

function getNotificationsTable(): string {
  return process.env.DYNAMODB_NOTIFICATIONS_TABLE || 'crypto-analytics-production-notifications';
}

function getRateLimitTable(): string {
  return process.env.DYNAMODB_EMAIL_RATE_LIMIT_TABLE || 'crypto-analytics-production-email-rate-limits';
}


// Types
export type NotificationRuleType = 'MA_CROSSOVER' | 'PRICE_MA_CROSSOVER';
export type CrossDirection = 'ABOVE' | 'BELOW' | 'BOTH';
export type CrossoverType = 'GOLDEN_CROSS' | 'DEATH_CROSS' | 'PRICE_ABOVE_MA' | 'PRICE_BELOW_MA';

export interface NotificationRule {
  ruleId: string;
  userId: string;
  coinId: string;
  coinSymbol: string;
  ruleType: NotificationRuleType;
  maPeriods: number[];
  crossDirection: CrossDirection;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  isActive: boolean;
  lastTriggeredAt?: string;
  lastCrossoverState?: string; // Track last known state to detect new crossovers
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  notificationId: string;
  userId: string;
  ruleId: string;
  coinId: string;
  coinSymbol: string;
  crossoverType: CrossoverType;
  maPeriods: number[];
  priceAtCrossover: number;
  maValuesAtCrossover: Record<string, number>;
  isRead: boolean;
  emailSent: boolean;
  triggeredAt: string;
  createdAt: string;
}

export interface EmailRateLimit {
  userId: string;
  lastEmailSentAt: string;
  emailCount5Min: number;
  windowStart: string;
}

export interface CreateNotificationRuleInput {
  userId: string;
  coinId: string;
  coinSymbol: string;
  ruleType: NotificationRuleType;
  maPeriods: number[];
  crossDirection: CrossDirection;
  inAppEnabled: boolean;
  emailEnabled: boolean;
}

export interface UpdateNotificationRuleInput {
  maPeriods?: number[];
  crossDirection?: CrossDirection;
  inAppEnabled?: boolean;
  emailEnabled?: boolean;
  isActive?: boolean;
  lastTriggeredAt?: string;
  lastCrossoverState?: string;
}

// ==================== Notification Rules ====================

export async function createNotificationRule(input: CreateNotificationRuleInput): Promise<NotificationRule> {
  const now = new Date().toISOString();
  const rule: NotificationRule = {
    ruleId: uuidv4(),
    userId: input.userId,
    coinId: input.coinId,
    coinSymbol: input.coinSymbol,
    ruleType: input.ruleType,
    maPeriods: input.maPeriods,
    crossDirection: input.crossDirection,
    inAppEnabled: input.inAppEnabled,
    emailEnabled: input.emailEnabled,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  await getDynamoDB().send(
    new PutCommand({
      TableName: getRulesTable(),
      Item: rule,
    })
  );

  return rule;
}

export async function getNotificationRule(ruleId: string): Promise<NotificationRule | null> {
  const result = await getDynamoDB().send(
    new GetCommand({
      TableName: getRulesTable(),
      Key: { ruleId },
    })
  );

  return (result.Item as NotificationRule) || null;
}

export async function updateNotificationRule(
  ruleId: string,
  updates: UpdateNotificationRuleInput
): Promise<NotificationRule | null> {
  const updateExpressions: string[] = [];
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, any> = {};

  // Build update expression dynamically
  Object.entries(updates).forEach(([key, value]) => {
    if (value !== undefined) {
      updateExpressions.push(`#${key} = :${key}`);
      expressionAttributeNames[`#${key}`] = key;
      expressionAttributeValues[`:${key}`] = value;
    }
  });

  // Always update updatedAt
  updateExpressions.push('#updatedAt = :updatedAt');
  expressionAttributeNames['#updatedAt'] = 'updatedAt';
  expressionAttributeValues[':updatedAt'] = new Date().toISOString();

  const result = await getDynamoDB().send(
    new UpdateCommand({
      TableName: getRulesTable(),
      Key: { ruleId },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    })
  );

  return (result.Attributes as NotificationRule) || null;
}

export async function deleteNotificationRule(ruleId: string): Promise<void> {
  await getDynamoDB().send(
    new DeleteCommand({
      TableName: getRulesTable(),
      Key: { ruleId },
    })
  );
}

export async function getNotificationRulesByUser(userId: string): Promise<NotificationRule[]> {
  const result = await getDynamoDB().send(
    new QueryCommand({
      TableName: getRulesTable(),
      IndexName: 'userId-index',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId,
      },
    })
  );

  return (result.Items as NotificationRule[]) || [];
}

export async function getNotificationRulesByUserAndCoin(
  userId: string,
  coinId: string
): Promise<NotificationRule[]> {
  const rules = await getNotificationRulesByUser(userId);
  return rules.filter((rule) => rule.coinId === coinId);
}

export async function countUserRulesForCoin(userId: string, coinId: string): Promise<number> {
  const rules = await getNotificationRulesByUserAndCoin(userId, coinId);
  return rules.length;
}

export async function getAllActiveRules(): Promise<NotificationRule[]> {
  const result = await getDynamoDB().send(
    new ScanCommand({
      TableName: getRulesTable(),
      FilterExpression: 'isActive = :isActive',
      ExpressionAttributeValues: {
        ':isActive': true,
      },
    })
  );

  return (result.Items as NotificationRule[]) || [];
}

// ==================== Notifications ====================

export async function createNotification(input: Omit<Notification, 'notificationId' | 'createdAt'>): Promise<Notification> {
  const notification: Notification = {
    ...input,
    notificationId: uuidv4(),
    createdAt: new Date().toISOString(),
  };

  await getDynamoDB().send(
    new PutCommand({
      TableName: getNotificationsTable(),
      Item: notification,
    })
  );

  return notification;
}

export async function getNotification(notificationId: string): Promise<Notification | null> {
  const result = await getDynamoDB().send(
    new GetCommand({
      TableName: getNotificationsTable(),
      Key: { notificationId },
    })
  );

  return (result.Item as Notification) || null;
}

export async function getUserNotifications(
  userId: string,
  options?: { limit?: number; unreadOnly?: boolean }
): Promise<Notification[]> {
  let filterExpression = 'userId = :userId';
  const expressionAttributeValues: Record<string, any> = {
    ':userId': userId,
  };

  if (options?.unreadOnly) {
    filterExpression += ' AND isRead = :isRead';
    expressionAttributeValues[':isRead'] = false;
  }

  const result = await getDynamoDB().send(
    new QueryCommand({
      TableName: getNotificationsTable(),
      IndexName: 'userId-createdAt-index',
      KeyConditionExpression: 'userId = :userId',
      FilterExpression: options?.unreadOnly ? 'isRead = :isRead' : undefined,
      ExpressionAttributeValues: expressionAttributeValues,
      ScanIndexForward: false, // Most recent first
      Limit: options?.limit || 50,
    })
  );

  return (result.Items as Notification[]) || [];
}

export async function updateNotificationReadStatus(
  notificationId: string,
  isRead: boolean
): Promise<Notification | null> {
  const result = await getDynamoDB().send(
    new UpdateCommand({
      TableName: getNotificationsTable(),
      Key: { notificationId },
      UpdateExpression: 'SET isRead = :isRead',
      ExpressionAttributeValues: {
        ':isRead': isRead,
      },
      ReturnValues: 'ALL_NEW',
    })
  );

  return (result.Attributes as Notification) || null;
}

export async function markAllUserNotificationsAsRead(userId: string): Promise<void> {
  const notifications = await getUserNotifications(userId, { unreadOnly: true });

  // Update each notification (batch would be better for production)
  await Promise.all(
    notifications.map((notification) =>
      updateNotificationReadStatus(notification.notificationId, true)
    )
  );
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const result = await getDynamoDB().send(
    new QueryCommand({
      TableName: getNotificationsTable(),
      IndexName: 'userId-createdAt-index',
      KeyConditionExpression: 'userId = :userId',
      FilterExpression: 'isRead = :isRead',
      ExpressionAttributeValues: {
        ':userId': userId,
        ':isRead': false,
      },
      Select: 'COUNT',
    })
  );

  return result.Count || 0;
}

// ==================== Email Rate Limiting ====================

export async function getEmailRateLimit(userId: string): Promise<EmailRateLimit | null> {
  const result = await getDynamoDB().send(
    new GetCommand({
      TableName: getRateLimitTable(),
      Key: { userId },
    })
  );

  return (result.Item as EmailRateLimit) || null;
}

export async function updateEmailRateLimit(userId: string): Promise<EmailRateLimit> {
  const now = new Date();
  const nowIso = now.toISOString();
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();

  // Get existing rate limit
  const existing = await getEmailRateLimit(userId);

  let newRateLimit: EmailRateLimit;

  if (!existing || existing.windowStart < fiveMinutesAgo) {
    // Start new window
    newRateLimit = {
      userId,
      lastEmailSentAt: nowIso,
      emailCount5Min: 1,
      windowStart: nowIso,
    };
  } else {
    // Update existing window
    newRateLimit = {
      userId,
      lastEmailSentAt: nowIso,
      emailCount5Min: existing.emailCount5Min + 1,
      windowStart: existing.windowStart,
    };
  }

  await getDynamoDB().send(
    new PutCommand({
      TableName: getRateLimitTable(),
      Item: newRateLimit,
    })
  );

  return newRateLimit;
}

export async function canSendEmail(userId: string): Promise<boolean> {
  const rateLimit = await getEmailRateLimit(userId);

  if (!rateLimit) {
    return true;
  }

  const now = new Date();
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();

  // If window has expired, can send
  if (rateLimit.windowStart < fiveMinutesAgo) {
    return true;
  }

  // Check if under limit (1 email per 5 minutes)
  return rateLimit.emailCount5Min < 1;
}
