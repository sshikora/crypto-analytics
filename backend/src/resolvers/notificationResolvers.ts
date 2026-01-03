import { notificationService } from '../services/notificationService';
import {
  NotificationRule,
  Notification,
  NotificationRuleType,
  CrossDirection,
} from '../db/notificationDynamodb';

interface CreateNotificationRuleInput {
  coinId: string;
  coinSymbol: string;
  ruleType: NotificationRuleType;
  maPeriods: number[];
  crossDirection: CrossDirection;
  inAppEnabled: boolean;
  emailEnabled: boolean;
}

interface UpdateNotificationRuleInput {
  maPeriods?: number[];
  crossDirection?: CrossDirection;
  inAppEnabled?: boolean;
  emailEnabled?: boolean;
  isActive?: boolean;
}

/**
 * Transform maValuesAtCrossover from Record to array for GraphQL
 */
function transformNotification(notification: Notification): any {
  return {
    ...notification,
    maValuesAtCrossover: Object.entries(notification.maValuesAtCrossover).map(
      ([key, value]) => ({
        period: parseInt(key.replace('ma', ''), 10),
        value,
      })
    ),
  };
}

/**
 * Ensure user is authenticated
 */
function requireAuth(context: any): string {
  if (!context.user) {
    throw new Error('Authentication required');
  }
  return context.user.sub;
}

export const notificationResolvers = {
  Query: {
    /**
     * Get notification rules for the authenticated user
     */
    notificationRules: async (
      _: unknown,
      { coinId }: { coinId?: string },
      context: any
    ): Promise<NotificationRule[]> => {
      const userId = requireAuth(context);
      return notificationService.getUserRules(userId, coinId);
    },

    /**
     * Get a specific notification rule
     */
    notificationRule: async (
      _: unknown,
      { ruleId }: { ruleId: string },
      context: any
    ): Promise<NotificationRule | null> => {
      const userId = requireAuth(context);
      try {
        return await notificationService.getRule(userId, ruleId);
      } catch (error: any) {
        if (error.name === 'NotificationNotFoundError') {
          return null;
        }
        throw error;
      }
    },

    /**
     * Get notifications for the authenticated user
     */
    notifications: async (
      _: unknown,
      { limit, unreadOnly }: { limit?: number; unreadOnly?: boolean },
      context: any
    ): Promise<any[]> => {
      const userId = requireAuth(context);
      const notifications = await notificationService.getUserNotifications(userId, {
        limit,
        unreadOnly,
      });
      return notifications.map(transformNotification);
    },

    /**
     * Get unread notification count
     */
    unreadNotificationCount: async (
      _: unknown,
      __: unknown,
      context: any
    ): Promise<number> => {
      const userId = requireAuth(context);
      return notificationService.getUnreadCount(userId);
    },
  },

  Mutation: {
    /**
     * Create a new notification rule
     */
    createNotificationRule: async (
      _: unknown,
      { input }: { input: CreateNotificationRuleInput },
      context: any
    ): Promise<NotificationRule> => {
      const userId = requireAuth(context);

      try {
        return await notificationService.createRule(userId, input);
      } catch (error: any) {
        if (error.name === 'NotificationValidationError') {
          throw new Error(error.message);
        }
        console.error('[NotificationResolver] Error creating rule:', error);
        throw new Error('Failed to create notification rule');
      }
    },

    /**
     * Update a notification rule
     */
    updateNotificationRule: async (
      _: unknown,
      { ruleId, input }: { ruleId: string; input: UpdateNotificationRuleInput },
      context: any
    ): Promise<NotificationRule> => {
      const userId = requireAuth(context);

      try {
        return await notificationService.updateRule(userId, ruleId, input);
      } catch (error: any) {
        if (
          error.name === 'NotificationValidationError' ||
          error.name === 'NotificationNotFoundError' ||
          error.name === 'NotificationAuthorizationError'
        ) {
          throw new Error(error.message);
        }
        console.error('[NotificationResolver] Error updating rule:', error);
        throw new Error('Failed to update notification rule');
      }
    },

    /**
     * Delete a notification rule
     */
    deleteNotificationRule: async (
      _: unknown,
      { ruleId }: { ruleId: string },
      context: any
    ): Promise<boolean> => {
      const userId = requireAuth(context);

      try {
        await notificationService.deleteRule(userId, ruleId);
        return true;
      } catch (error: any) {
        if (
          error.name === 'NotificationNotFoundError' ||
          error.name === 'NotificationAuthorizationError'
        ) {
          throw new Error(error.message);
        }
        console.error('[NotificationResolver] Error deleting rule:', error);
        throw new Error('Failed to delete notification rule');
      }
    },

    /**
     * Mark a notification as read
     */
    markNotificationAsRead: async (
      _: unknown,
      { notificationId }: { notificationId: string },
      context: any
    ): Promise<any> => {
      const userId = requireAuth(context);

      try {
        const notification = await notificationService.markAsRead(userId, notificationId);
        return transformNotification(notification);
      } catch (error: any) {
        if (
          error.name === 'NotificationNotFoundError' ||
          error.name === 'NotificationAuthorizationError'
        ) {
          throw new Error(error.message);
        }
        console.error('[NotificationResolver] Error marking notification as read:', error);
        throw new Error('Failed to mark notification as read');
      }
    },

    /**
     * Mark all notifications as read
     */
    markAllNotificationsAsRead: async (
      _: unknown,
      __: unknown,
      context: any
    ): Promise<boolean> => {
      const userId = requireAuth(context);

      try {
        await notificationService.markAllAsRead(userId);
        return true;
      } catch (error) {
        console.error('[NotificationResolver] Error marking all notifications as read:', error);
        throw new Error('Failed to mark all notifications as read');
      }
    },
  },
};

export default notificationResolvers;
