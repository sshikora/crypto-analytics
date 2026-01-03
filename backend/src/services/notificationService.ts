import {
  NotificationRule,
  Notification,
  CreateNotificationRuleInput,
  UpdateNotificationRuleInput,
  createNotificationRule,
  getNotificationRule,
  updateNotificationRule,
  deleteNotificationRule,
  getNotificationRulesByUser,
  getNotificationRulesByUserAndCoin,
  countUserRulesForCoin,
  createNotification,
  getNotification,
  getUserNotifications,
  updateNotificationReadStatus,
  markAllUserNotificationsAsRead,
  getUnreadNotificationCount,
  CrossoverType,
} from '../db/notificationDynamodb';
import { CrossoverResult } from './crossoverDetectionService';

// Constants
const MAX_RULES_PER_COIN = 3;
const MAX_MA_PERIODS_PER_RULE = 4;

// Validation errors
export class NotificationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotificationValidationError';
  }
}

export class NotificationNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotificationNotFoundError';
  }
}

export class NotificationAuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotificationAuthorizationError';
  }
}

/**
 * Validate notification rule input
 */
function validateRuleInput(input: CreateNotificationRuleInput): void {
  // Validate MA periods
  if (!input.maPeriods || input.maPeriods.length === 0) {
    throw new NotificationValidationError('At least one MA period is required');
  }

  if (input.maPeriods.length > MAX_MA_PERIODS_PER_RULE) {
    throw new NotificationValidationError(
      `Maximum ${MAX_MA_PERIODS_PER_RULE} MA periods allowed per rule`
    );
  }

  // Validate period values
  for (const period of input.maPeriods) {
    if (!Number.isInteger(period) || period < 1 || period > 365) {
      throw new NotificationValidationError(
        'MA periods must be integers between 1 and 365'
      );
    }
  }

  // Validate MA crossover requires at least 2 periods
  if (input.ruleType === 'MA_CROSSOVER' && input.maPeriods.length < 2) {
    throw new NotificationValidationError(
      'MA crossover requires at least 2 MA periods'
    );
  }

  // Validate at least one notification channel is enabled
  if (!input.inAppEnabled && !input.emailEnabled) {
    throw new NotificationValidationError(
      'At least one notification channel (in-app or email) must be enabled'
    );
  }
}

/**
 * Service for managing notification rules
 */
export const notificationService = {
  /**
   * Create a new notification rule
   */
  async createRule(
    userId: string,
    input: Omit<CreateNotificationRuleInput, 'userId'>
  ): Promise<NotificationRule> {
    const fullInput: CreateNotificationRuleInput = { ...input, userId };

    // Validate input
    validateRuleInput(fullInput);

    // Check rule limit per coin
    const existingCount = await countUserRulesForCoin(userId, input.coinId);
    if (existingCount >= MAX_RULES_PER_COIN) {
      throw new NotificationValidationError(
        `Maximum ${MAX_RULES_PER_COIN} notification rules allowed per coin`
      );
    }

    // Create the rule
    const rule = await createNotificationRule(fullInput);
    console.log(`[NotificationService] Created rule ${rule.ruleId} for user ${userId}`);

    return rule;
  },

  /**
   * Update an existing notification rule
   */
  async updateRule(
    userId: string,
    ruleId: string,
    updates: UpdateNotificationRuleInput
  ): Promise<NotificationRule> {
    // Get the rule and verify ownership
    const rule = await getNotificationRule(ruleId);
    if (!rule) {
      throw new NotificationNotFoundError('Notification rule not found');
    }

    if (rule.userId !== userId) {
      throw new NotificationAuthorizationError('Not authorized to update this rule');
    }

    // Validate MA periods if updating
    if (updates.maPeriods) {
      if (updates.maPeriods.length === 0) {
        throw new NotificationValidationError('At least one MA period is required');
      }

      if (updates.maPeriods.length > MAX_MA_PERIODS_PER_RULE) {
        throw new NotificationValidationError(
          `Maximum ${MAX_MA_PERIODS_PER_RULE} MA periods allowed per rule`
        );
      }

      for (const period of updates.maPeriods) {
        if (!Number.isInteger(period) || period < 1 || period > 365) {
          throw new NotificationValidationError(
            'MA periods must be integers between 1 and 365'
          );
        }
      }

      // Validate MA crossover requires at least 2 periods
      if (rule.ruleType === 'MA_CROSSOVER' && updates.maPeriods.length < 2) {
        throw new NotificationValidationError(
          'MA crossover requires at least 2 MA periods'
        );
      }
    }

    // Update the rule
    const updatedRule = await updateNotificationRule(ruleId, updates);
    if (!updatedRule) {
      throw new NotificationNotFoundError('Failed to update notification rule');
    }

    console.log(`[NotificationService] Updated rule ${ruleId}`);
    return updatedRule;
  },

  /**
   * Delete a notification rule
   */
  async deleteRule(userId: string, ruleId: string): Promise<void> {
    // Get the rule and verify ownership
    const rule = await getNotificationRule(ruleId);
    if (!rule) {
      throw new NotificationNotFoundError('Notification rule not found');
    }

    if (rule.userId !== userId) {
      throw new NotificationAuthorizationError('Not authorized to delete this rule');
    }

    await deleteNotificationRule(ruleId);
    console.log(`[NotificationService] Deleted rule ${ruleId}`);
  },

  /**
   * Get all notification rules for a user
   */
  async getUserRules(userId: string, coinId?: string): Promise<NotificationRule[]> {
    if (coinId) {
      return getNotificationRulesByUserAndCoin(userId, coinId);
    }
    return getNotificationRulesByUser(userId);
  },

  /**
   * Get a single notification rule
   */
  async getRule(userId: string, ruleId: string): Promise<NotificationRule> {
    const rule = await getNotificationRule(ruleId);
    if (!rule) {
      throw new NotificationNotFoundError('Notification rule not found');
    }

    if (rule.userId !== userId) {
      throw new NotificationAuthorizationError('Not authorized to view this rule');
    }

    return rule;
  },

  /**
   * Create a notification from a detected crossover
   */
  async createFromCrossover(
    rule: NotificationRule,
    crossover: CrossoverResult
  ): Promise<Notification> {
    const notification = await createNotification({
      userId: rule.userId,
      ruleId: rule.ruleId,
      coinId: crossover.coinId,
      coinSymbol: crossover.coinSymbol,
      crossoverType: crossover.type,
      maPeriods: crossover.maPeriods,
      priceAtCrossover: crossover.priceAtCrossover,
      maValuesAtCrossover: crossover.maValues,
      isRead: false,
      emailSent: false,
      triggeredAt: crossover.triggeredAt,
    });

    console.log(
      `[NotificationService] Created notification ${notification.notificationId} ` +
      `for ${crossover.coinSymbol} ${crossover.type}`
    );

    return notification;
  },

  /**
   * Get notifications for a user
   */
  async getUserNotifications(
    userId: string,
    options?: { limit?: number; unreadOnly?: boolean }
  ): Promise<Notification[]> {
    return getUserNotifications(userId, options);
  },

  /**
   * Mark a notification as read
   */
  async markAsRead(userId: string, notificationId: string): Promise<Notification> {
    const notification = await getNotification(notificationId);
    if (!notification) {
      throw new NotificationNotFoundError('Notification not found');
    }

    if (notification.userId !== userId) {
      throw new NotificationAuthorizationError('Not authorized to update this notification');
    }

    const updated = await updateNotificationReadStatus(notificationId, true);
    if (!updated) {
      throw new NotificationNotFoundError('Failed to update notification');
    }

    return updated;
  },

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<void> {
    await markAllUserNotificationsAsRead(userId);
    console.log(`[NotificationService] Marked all notifications as read for user ${userId}`);
  },

  /**
   * Get unread notification count
   */
  async getUnreadCount(userId: string): Promise<number> {
    return getUnreadNotificationCount(userId);
  },

  /**
   * Get notification by ID (with authorization check)
   */
  async getNotification(userId: string, notificationId: string): Promise<Notification> {
    const notification = await getNotification(notificationId);
    if (!notification) {
      throw new NotificationNotFoundError('Notification not found');
    }

    if (notification.userId !== userId) {
      throw new NotificationAuthorizationError('Not authorized to view this notification');
    }

    return notification;
  },
};

export default notificationService;
