export enum NotificationRuleType {
  MA_CROSSOVER = 'MA_CROSSOVER',
  PRICE_MA_CROSSOVER = 'PRICE_MA_CROSSOVER',
}

export enum CrossDirection {
  ABOVE = 'ABOVE',
  BELOW = 'BELOW',
  BOTH = 'BOTH',
}

export enum CrossoverType {
  GOLDEN_CROSS = 'GOLDEN_CROSS',
  DEATH_CROSS = 'DEATH_CROSS',
  PRICE_ABOVE_MA = 'PRICE_ABOVE_MA',
  PRICE_BELOW_MA = 'PRICE_BELOW_MA',
}

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
  createdAt: string;
  updatedAt: string;
}

export interface MAValue {
  period: number;
  value: number;
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
  maValuesAtCrossover: MAValue[];
  isRead: boolean;
  emailSent: boolean;
  triggeredAt: string;
  createdAt: string;
}

export interface CreateNotificationRuleInput {
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
}
