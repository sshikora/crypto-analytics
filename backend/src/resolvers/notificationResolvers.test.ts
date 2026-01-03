import { describe, it, expect, beforeEach, vi } from 'vitest';
import { notificationResolvers } from './notificationResolvers';
import * as notificationService from '../services/notificationService';
import {
  NotificationValidationError,
  NotificationNotFoundError,
  NotificationAuthorizationError,
} from '../services/notificationService';

vi.mock('../services/notificationService', async () => {
  const actual = await vi.importActual<typeof notificationService>('../services/notificationService');
  return {
    ...actual,
    notificationService: {
      getUserRules: vi.fn(),
      getRule: vi.fn(),
      getUserNotifications: vi.fn(),
      getUnreadCount: vi.fn(),
      createRule: vi.fn(),
      updateRule: vi.fn(),
      deleteRule: vi.fn(),
      markAsRead: vi.fn(),
      markAllAsRead: vi.fn(),
    },
  };
});

describe('NotificationResolvers', () => {
  const mockContext = {
    user: {
      sub: 'user-123',
      email: 'user@example.com',
    },
  };

  const mockRule = {
    ruleId: 'rule-123',
    userId: 'user-123',
    coinId: 'bitcoin',
    coinSymbol: 'BTC',
    ruleType: 'MA_CROSSOVER' as const,
    maPeriods: [7, 21],
    crossDirection: 'BOTH' as const,
    inAppEnabled: true,
    emailEnabled: false,
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };

  const mockNotification = {
    notificationId: 'notification-123',
    userId: 'user-123',
    ruleId: 'rule-123',
    coinId: 'bitcoin',
    coinSymbol: 'BTC',
    crossoverType: 'GOLDEN_CROSS' as const,
    maPeriods: [7, 21],
    priceAtCrossover: 50000,
    maValuesAtCrossover: { ma7: 49000, ma21: 48000 },
    isRead: false,
    emailSent: false,
    triggeredAt: '2024-01-01T12:00:00Z',
    createdAt: '2024-01-01T12:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Query', () => {
    describe('notificationRules', () => {
      it('should return rules for authenticated user', async () => {
        const mockRules = [mockRule];
        vi.mocked(notificationService.notificationService.getUserRules).mockResolvedValue(mockRules);

        const result = await notificationResolvers.Query.notificationRules(
          {},
          {},
          mockContext
        );

        expect(result).toEqual(mockRules);
        expect(notificationService.notificationService.getUserRules).toHaveBeenCalledWith(
          'user-123',
          undefined
        );
      });

      it('should return rules filtered by coinId', async () => {
        const mockRules = [mockRule];
        vi.mocked(notificationService.notificationService.getUserRules).mockResolvedValue(mockRules);

        const result = await notificationResolvers.Query.notificationRules(
          {},
          { coinId: 'bitcoin' },
          mockContext
        );

        expect(result).toEqual(mockRules);
        expect(notificationService.notificationService.getUserRules).toHaveBeenCalledWith(
          'user-123',
          'bitcoin'
        );
      });

      it('should throw error if not authenticated', async () => {
        await expect(
          notificationResolvers.Query.notificationRules({}, {}, {})
        ).rejects.toThrow('Authentication required');
      });
    });

    describe('notificationRule', () => {
      it('should return a specific rule', async () => {
        vi.mocked(notificationService.notificationService.getRule).mockResolvedValue(mockRule);

        const result = await notificationResolvers.Query.notificationRule(
          {},
          { ruleId: 'rule-123' },
          mockContext
        );

        expect(result).toEqual(mockRule);
        expect(notificationService.notificationService.getRule).toHaveBeenCalledWith(
          'user-123',
          'rule-123'
        );
      });

      it('should return null if rule not found', async () => {
        vi.mocked(notificationService.notificationService.getRule).mockRejectedValue(
          new NotificationNotFoundError('Not found')
        );

        const result = await notificationResolvers.Query.notificationRule(
          {},
          { ruleId: 'nonexistent' },
          mockContext
        );

        expect(result).toBeNull();
      });

      it('should throw error if not authenticated', async () => {
        await expect(
          notificationResolvers.Query.notificationRule({}, { ruleId: 'rule-123' }, {})
        ).rejects.toThrow('Authentication required');
      });
    });

    describe('notifications', () => {
      it('should return notifications for user', async () => {
        const transformedNotifications = [{
          ...mockNotification,
          maValuesAtCrossover: [
            { period: 7, value: 49000 },
            { period: 21, value: 48000 },
          ],
        }];

        vi.mocked(notificationService.notificationService.getUserNotifications).mockResolvedValue([
          mockNotification,
        ]);

        const result = await notificationResolvers.Query.notifications(
          {},
          {},
          mockContext
        );

        expect(result).toEqual(transformedNotifications);
        expect(notificationService.notificationService.getUserNotifications).toHaveBeenCalledWith(
          'user-123',
          {}
        );
      });

      it('should return notifications with limit', async () => {
        vi.mocked(notificationService.notificationService.getUserNotifications).mockResolvedValue([
          mockNotification,
        ]);

        await notificationResolvers.Query.notifications(
          {},
          { limit: 10, unreadOnly: true },
          mockContext
        );

        expect(notificationService.notificationService.getUserNotifications).toHaveBeenCalledWith(
          'user-123',
          { limit: 10, unreadOnly: true }
        );
      });

      it('should throw error if not authenticated', async () => {
        await expect(
          notificationResolvers.Query.notifications({}, {}, {})
        ).rejects.toThrow('Authentication required');
      });
    });

    describe('unreadNotificationCount', () => {
      it('should return unread count', async () => {
        vi.mocked(notificationService.notificationService.getUnreadCount).mockResolvedValue(5);

        const result = await notificationResolvers.Query.unreadNotificationCount(
          {},
          {},
          mockContext
        );

        expect(result).toBe(5);
        expect(notificationService.notificationService.getUnreadCount).toHaveBeenCalledWith(
          'user-123'
        );
      });

      it('should throw error if not authenticated', async () => {
        await expect(
          notificationResolvers.Query.unreadNotificationCount({}, {}, {})
        ).rejects.toThrow('Authentication required');
      });
    });
  });

  describe('Mutation', () => {
    describe('createNotificationRule', () => {
      const validInput = {
        coinId: 'bitcoin',
        coinSymbol: 'BTC',
        ruleType: 'MA_CROSSOVER' as const,
        maPeriods: [7, 21],
        crossDirection: 'BOTH' as const,
        inAppEnabled: true,
        emailEnabled: false,
      };

      it('should create a notification rule', async () => {
        vi.mocked(notificationService.notificationService.createRule).mockResolvedValue(mockRule);

        const result = await notificationResolvers.Mutation.createNotificationRule(
          {},
          { input: validInput },
          mockContext
        );

        expect(result).toEqual(mockRule);
        expect(notificationService.notificationService.createRule).toHaveBeenCalledWith(
          'user-123',
          validInput
        );
      });

      it('should throw validation error with message', async () => {
        vi.mocked(notificationService.notificationService.createRule).mockRejectedValue(
          new NotificationValidationError('Invalid input')
        );

        await expect(
          notificationResolvers.Mutation.createNotificationRule(
            {},
            { input: validInput },
            mockContext
          )
        ).rejects.toThrow('Invalid input');
      });

      it('should throw generic error for other errors', async () => {
        vi.mocked(notificationService.notificationService.createRule).mockRejectedValue(
          new Error('Database error')
        );

        await expect(
          notificationResolvers.Mutation.createNotificationRule(
            {},
            { input: validInput },
            mockContext
          )
        ).rejects.toThrow('Failed to create notification rule');
      });

      it('should throw error if not authenticated', async () => {
        await expect(
          notificationResolvers.Mutation.createNotificationRule({}, { input: validInput }, {})
        ).rejects.toThrow('Authentication required');
      });
    });

    describe('updateNotificationRule', () => {
      const updateInput = {
        maPeriods: [14, 30],
        isActive: true,
      };

      it('should update a notification rule', async () => {
        const updatedRule = { ...mockRule, ...updateInput };
        vi.mocked(notificationService.notificationService.updateRule).mockResolvedValue(updatedRule);

        const result = await notificationResolvers.Mutation.updateNotificationRule(
          {},
          { ruleId: 'rule-123', input: updateInput },
          mockContext
        );

        expect(result).toEqual(updatedRule);
        expect(notificationService.notificationService.updateRule).toHaveBeenCalledWith(
          'user-123',
          'rule-123',
          updateInput
        );
      });

      it('should handle validation errors', async () => {
        vi.mocked(notificationService.notificationService.updateRule).mockRejectedValue(
          new NotificationValidationError('Invalid periods')
        );

        await expect(
          notificationResolvers.Mutation.updateNotificationRule(
            {},
            { ruleId: 'rule-123', input: updateInput },
            mockContext
          )
        ).rejects.toThrow('Invalid periods');
      });

      it('should handle not found errors', async () => {
        vi.mocked(notificationService.notificationService.updateRule).mockRejectedValue(
          new NotificationNotFoundError('Not found')
        );

        await expect(
          notificationResolvers.Mutation.updateNotificationRule(
            {},
            { ruleId: 'nonexistent', input: updateInput },
            mockContext
          )
        ).rejects.toThrow('Not found');
      });

      it('should handle authorization errors', async () => {
        vi.mocked(notificationService.notificationService.updateRule).mockRejectedValue(
          new NotificationAuthorizationError('Not authorized')
        );

        await expect(
          notificationResolvers.Mutation.updateNotificationRule(
            {},
            { ruleId: 'rule-123', input: updateInput },
            mockContext
          )
        ).rejects.toThrow('Not authorized');
      });

      it('should throw error if not authenticated', async () => {
        await expect(
          notificationResolvers.Mutation.updateNotificationRule(
            {},
            { ruleId: 'rule-123', input: updateInput },
            {}
          )
        ).rejects.toThrow('Authentication required');
      });
    });

    describe('deleteNotificationRule', () => {
      it('should delete a notification rule', async () => {
        vi.mocked(notificationService.notificationService.deleteRule).mockResolvedValue(undefined);

        const result = await notificationResolvers.Mutation.deleteNotificationRule(
          {},
          { ruleId: 'rule-123' },
          mockContext
        );

        expect(result).toBe(true);
        expect(notificationService.notificationService.deleteRule).toHaveBeenCalledWith(
          'user-123',
          'rule-123'
        );
      });

      it('should handle not found errors', async () => {
        vi.mocked(notificationService.notificationService.deleteRule).mockRejectedValue(
          new NotificationNotFoundError('Not found')
        );

        await expect(
          notificationResolvers.Mutation.deleteNotificationRule(
            {},
            { ruleId: 'nonexistent' },
            mockContext
          )
        ).rejects.toThrow('Not found');
      });

      it('should handle authorization errors', async () => {
        vi.mocked(notificationService.notificationService.deleteRule).mockRejectedValue(
          new NotificationAuthorizationError('Not authorized')
        );

        await expect(
          notificationResolvers.Mutation.deleteNotificationRule(
            {},
            { ruleId: 'rule-123' },
            mockContext
          )
        ).rejects.toThrow('Not authorized');
      });

      it('should throw error if not authenticated', async () => {
        await expect(
          notificationResolvers.Mutation.deleteNotificationRule({}, { ruleId: 'rule-123' }, {})
        ).rejects.toThrow('Authentication required');
      });
    });

    describe('markNotificationAsRead', () => {
      it('should mark notification as read', async () => {
        const readNotification = { ...mockNotification, isRead: true };
        const transformedNotification = {
          ...readNotification,
          maValuesAtCrossover: [
            { period: 7, value: 49000 },
            { period: 21, value: 48000 },
          ],
        };

        vi.mocked(notificationService.notificationService.markAsRead).mockResolvedValue(
          readNotification
        );

        const result = await notificationResolvers.Mutation.markNotificationAsRead(
          {},
          { notificationId: 'notification-123' },
          mockContext
        );

        expect(result).toEqual(transformedNotification);
        expect(notificationService.notificationService.markAsRead).toHaveBeenCalledWith(
          'user-123',
          'notification-123'
        );
      });

      it('should handle not found errors', async () => {
        vi.mocked(notificationService.notificationService.markAsRead).mockRejectedValue(
          new NotificationNotFoundError('Not found')
        );

        await expect(
          notificationResolvers.Mutation.markNotificationAsRead(
            {},
            { notificationId: 'nonexistent' },
            mockContext
          )
        ).rejects.toThrow('Not found');
      });

      it('should throw error if not authenticated', async () => {
        await expect(
          notificationResolvers.Mutation.markNotificationAsRead(
            {},
            { notificationId: 'notification-123' },
            {}
          )
        ).rejects.toThrow('Authentication required');
      });
    });

    describe('markAllNotificationsAsRead', () => {
      it('should mark all notifications as read', async () => {
        vi.mocked(notificationService.notificationService.markAllAsRead).mockResolvedValue(
          undefined
        );

        const result = await notificationResolvers.Mutation.markAllNotificationsAsRead(
          {},
          {},
          mockContext
        );

        expect(result).toBe(true);
        expect(notificationService.notificationService.markAllAsRead).toHaveBeenCalledWith(
          'user-123'
        );
      });

      it('should handle errors gracefully', async () => {
        vi.mocked(notificationService.notificationService.markAllAsRead).mockRejectedValue(
          new Error('Database error')
        );

        await expect(
          notificationResolvers.Mutation.markAllNotificationsAsRead({}, {}, mockContext)
        ).rejects.toThrow('Failed to mark all notifications as read');
      });

      it('should throw error if not authenticated', async () => {
        await expect(
          notificationResolvers.Mutation.markAllNotificationsAsRead({}, {}, {})
        ).rejects.toThrow('Authentication required');
      });
    });
  });
});
