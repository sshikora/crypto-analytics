import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  notificationService,
  NotificationValidationError,
  NotificationNotFoundError,
  NotificationAuthorizationError,
} from './notificationService';
import * as notificationDb from '../db/notificationDynamodb';

// Mock the entire notification database module
vi.mock('../db/notificationDynamodb', () => ({
  createNotificationRule: vi.fn(),
  getNotificationRule: vi.fn(),
  updateNotificationRule: vi.fn(),
  deleteNotificationRule: vi.fn(),
  getNotificationRulesByUser: vi.fn(),
  getNotificationRulesByUserAndCoin: vi.fn(),
  countUserRulesForCoin: vi.fn(),
  createNotification: vi.fn(),
  getNotification: vi.fn(),
  getUserNotifications: vi.fn(),
  updateNotificationReadStatus: vi.fn(),
  markAllUserNotificationsAsRead: vi.fn(),
  getUnreadNotificationCount: vi.fn(),
}));

describe('NotificationService', () => {
  const mockUserId = 'user-123';
  const mockRuleId = 'rule-123';
  const mockCoinId = 'bitcoin';
  const mockCoinSymbol = 'BTC';

  const mockRule = {
    ruleId: mockRuleId,
    userId: mockUserId,
    coinId: mockCoinId,
    coinSymbol: mockCoinSymbol,
    ruleType: 'MA_CROSSOVER' as const,
    maPeriods: [7, 21],
    crossDirection: 'BOTH' as const,
    inAppEnabled: true,
    emailEnabled: false,
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createRule', () => {
    const validInput = {
      coinId: mockCoinId,
      coinSymbol: mockCoinSymbol,
      ruleType: 'MA_CROSSOVER' as const,
      maPeriods: [7, 21],
      crossDirection: 'BOTH' as const,
      inAppEnabled: true,
      emailEnabled: false,
    };

    it('should create a valid notification rule', async () => {
      vi.mocked(notificationDb.countUserRulesForCoin).mockResolvedValue(0);
      vi.mocked(notificationDb.createNotificationRule).mockResolvedValue(mockRule);

      const result = await notificationService.createRule(mockUserId, validInput);

      expect(result).toEqual(mockRule);
      expect(notificationDb.countUserRulesForCoin).toHaveBeenCalledWith(mockUserId, mockCoinId);
      expect(notificationDb.createNotificationRule).toHaveBeenCalledWith({
        ...validInput,
        userId: mockUserId,
      });
    });

    it('should throw error when no MA periods provided', async () => {
      const invalidInput = { ...validInput, maPeriods: [] };

      await expect(
        notificationService.createRule(mockUserId, invalidInput)
      ).rejects.toThrow(NotificationValidationError);
    });

    it('should throw error when too many MA periods', async () => {
      const invalidInput = { ...validInput, maPeriods: [7, 14, 21, 30, 50] };

      await expect(
        notificationService.createRule(mockUserId, invalidInput)
      ).rejects.toThrow('Maximum 4 MA periods allowed per rule');
    });

    it('should throw error for invalid MA period values', async () => {
      const invalidInput = { ...validInput, maPeriods: [0, 21] };

      await expect(
        notificationService.createRule(mockUserId, invalidInput)
      ).rejects.toThrow('MA periods must be integers between 1 and 365');
    });

    it('should throw error for non-integer MA periods', async () => {
      const invalidInput = { ...validInput, maPeriods: [7.5, 21] };

      await expect(
        notificationService.createRule(mockUserId, invalidInput)
      ).rejects.toThrow('MA periods must be integers between 1 and 365');
    });

    it('should throw error when MA_CROSSOVER has less than 2 periods', async () => {
      const invalidInput = { ...validInput, maPeriods: [7] };

      await expect(
        notificationService.createRule(mockUserId, invalidInput)
      ).rejects.toThrow('MA crossover requires at least 2 MA periods');
    });

    it('should throw error when no notification channels enabled', async () => {
      const invalidInput = { ...validInput, inAppEnabled: false, emailEnabled: false };

      await expect(
        notificationService.createRule(mockUserId, invalidInput)
      ).rejects.toThrow('At least one notification channel (in-app or email) must be enabled');
    });

    it('should throw error when rule limit reached', async () => {
      vi.mocked(notificationDb.countUserRulesForCoin).mockResolvedValue(3);

      await expect(
        notificationService.createRule(mockUserId, validInput)
      ).rejects.toThrow('Maximum 3 notification rules allowed per coin');
    });

    it('should allow PRICE_MA_CROSSOVER with 1 period', async () => {
      const priceInput = {
        ...validInput,
        ruleType: 'PRICE_MA_CROSSOVER' as const,
        maPeriods: [21],
      };

      vi.mocked(notificationDb.countUserRulesForCoin).mockResolvedValue(0);
      vi.mocked(notificationDb.createNotificationRule).mockResolvedValue({
        ...mockRule,
        ruleType: 'PRICE_MA_CROSSOVER',
        maPeriods: [21],
      });

      const result = await notificationService.createRule(mockUserId, priceInput);

      expect(result.ruleType).toBe('PRICE_MA_CROSSOVER');
      expect(result.maPeriods).toEqual([21]);
    });
  });

  describe('updateRule', () => {
    it('should update a rule successfully', async () => {
      const updates = { maPeriods: [14, 30], inAppEnabled: false };
      const updatedRule = { ...mockRule, ...updates };

      vi.mocked(notificationDb.getNotificationRule).mockResolvedValue(mockRule);
      vi.mocked(notificationDb.updateNotificationRule).mockResolvedValue(updatedRule);

      const result = await notificationService.updateRule(mockUserId, mockRuleId, updates);

      expect(result).toEqual(updatedRule);
      expect(notificationDb.getNotificationRule).toHaveBeenCalledWith(mockRuleId);
      expect(notificationDb.updateNotificationRule).toHaveBeenCalledWith(mockRuleId, updates);
    });

    it('should throw error when rule not found', async () => {
      vi.mocked(notificationDb.getNotificationRule).mockResolvedValue(null);

      await expect(
        notificationService.updateRule(mockUserId, mockRuleId, { isActive: false })
      ).rejects.toThrow(NotificationNotFoundError);
    });

    it('should throw error when user is not owner', async () => {
      const otherUserRule = { ...mockRule, userId: 'other-user' };
      vi.mocked(notificationDb.getNotificationRule).mockResolvedValue(otherUserRule);

      await expect(
        notificationService.updateRule(mockUserId, mockRuleId, { isActive: false })
      ).rejects.toThrow(NotificationAuthorizationError);
    });

    it('should validate MA periods when updating', async () => {
      vi.mocked(notificationDb.getNotificationRule).mockResolvedValue(mockRule);

      await expect(
        notificationService.updateRule(mockUserId, mockRuleId, { maPeriods: [] })
      ).rejects.toThrow('At least one MA period is required');
    });

    it('should throw error when update fails', async () => {
      vi.mocked(notificationDb.getNotificationRule).mockResolvedValue(mockRule);
      vi.mocked(notificationDb.updateNotificationRule).mockResolvedValue(null);

      await expect(
        notificationService.updateRule(mockUserId, mockRuleId, { isActive: false })
      ).rejects.toThrow('Failed to update notification rule');
    });
  });

  describe('deleteRule', () => {
    it('should delete a rule successfully', async () => {
      vi.mocked(notificationDb.getNotificationRule).mockResolvedValue(mockRule);
      vi.mocked(notificationDb.deleteNotificationRule).mockResolvedValue(undefined);

      await notificationService.deleteRule(mockUserId, mockRuleId);

      expect(notificationDb.getNotificationRule).toHaveBeenCalledWith(mockRuleId);
      expect(notificationDb.deleteNotificationRule).toHaveBeenCalledWith(mockRuleId);
    });

    it('should throw error when rule not found', async () => {
      vi.mocked(notificationDb.getNotificationRule).mockResolvedValue(null);

      await expect(
        notificationService.deleteRule(mockUserId, mockRuleId)
      ).rejects.toThrow(NotificationNotFoundError);
    });

    it('should throw error when user is not owner', async () => {
      const otherUserRule = { ...mockRule, userId: 'other-user' };
      vi.mocked(notificationDb.getNotificationRule).mockResolvedValue(otherUserRule);

      await expect(
        notificationService.deleteRule(mockUserId, mockRuleId)
      ).rejects.toThrow(NotificationAuthorizationError);
    });
  });

  describe('getUserRules', () => {
    const mockRules = [mockRule];

    it('should get all rules for user', async () => {
      vi.mocked(notificationDb.getNotificationRulesByUser).mockResolvedValue(mockRules);

      const result = await notificationService.getUserRules(mockUserId);

      expect(result).toEqual(mockRules);
      expect(notificationDb.getNotificationRulesByUser).toHaveBeenCalledWith(mockUserId);
    });

    it('should get rules filtered by coin', async () => {
      vi.mocked(notificationDb.getNotificationRulesByUserAndCoin).mockResolvedValue(mockRules);

      const result = await notificationService.getUserRules(mockUserId, mockCoinId);

      expect(result).toEqual(mockRules);
      expect(notificationDb.getNotificationRulesByUserAndCoin).toHaveBeenCalledWith(
        mockUserId,
        mockCoinId
      );
    });
  });

  describe('getRule', () => {
    it('should get a rule successfully', async () => {
      vi.mocked(notificationDb.getNotificationRule).mockResolvedValue(mockRule);

      const result = await notificationService.getRule(mockUserId, mockRuleId);

      expect(result).toEqual(mockRule);
    });

    it('should throw error when rule not found', async () => {
      vi.mocked(notificationDb.getNotificationRule).mockResolvedValue(null);

      await expect(
        notificationService.getRule(mockUserId, mockRuleId)
      ).rejects.toThrow(NotificationNotFoundError);
    });

    it('should throw error when user is not owner', async () => {
      const otherUserRule = { ...mockRule, userId: 'other-user' };
      vi.mocked(notificationDb.getNotificationRule).mockResolvedValue(otherUserRule);

      await expect(
        notificationService.getRule(mockUserId, mockRuleId)
      ).rejects.toThrow(NotificationAuthorizationError);
    });
  });

  describe('createFromCrossover', () => {
    const mockCrossover = {
      coinId: mockCoinId,
      coinSymbol: mockCoinSymbol,
      type: 'GOLDEN_CROSS' as const,
      maPeriods: [7, 21],
      priceAtCrossover: 50000,
      maValues: { ma7: 49000, ma21: 48000 },
      triggeredAt: '2024-01-01T12:00:00Z',
    };

    const mockNotification = {
      notificationId: 'notification-123',
      userId: mockUserId,
      ruleId: mockRuleId,
      coinId: mockCoinId,
      coinSymbol: mockCoinSymbol,
      crossoverType: 'GOLDEN_CROSS' as const,
      maPeriods: [7, 21],
      priceAtCrossover: 50000,
      maValuesAtCrossover: { ma7: 49000, ma21: 48000 },
      isRead: false,
      emailSent: false,
      triggeredAt: '2024-01-01T12:00:00Z',
      createdAt: '2024-01-01T12:00:00Z',
    };

    it('should create notification from crossover', async () => {
      vi.mocked(notificationDb.createNotification).mockResolvedValue(mockNotification);

      const result = await notificationService.createFromCrossover(mockRule, mockCrossover);

      expect(result).toEqual(mockNotification);
      expect(notificationDb.createNotification).toHaveBeenCalledWith({
        userId: mockUserId,
        ruleId: mockRuleId,
        coinId: mockCoinId,
        coinSymbol: mockCoinSymbol,
        crossoverType: mockCrossover.type,
        maPeriods: mockCrossover.maPeriods,
        priceAtCrossover: mockCrossover.priceAtCrossover,
        maValuesAtCrossover: mockCrossover.maValues,
        isRead: false,
        emailSent: false,
        triggeredAt: mockCrossover.triggeredAt,
      });
    });
  });

  describe('getUserNotifications', () => {
    const mockNotifications = [
      {
        notificationId: 'notification-123',
        userId: mockUserId,
        ruleId: mockRuleId,
        coinId: mockCoinId,
        coinSymbol: mockCoinSymbol,
        crossoverType: 'GOLDEN_CROSS' as const,
        maPeriods: [7, 21],
        priceAtCrossover: 50000,
        maValuesAtCrossover: { ma7: 49000, ma21: 48000 },
        isRead: false,
        emailSent: false,
        triggeredAt: '2024-01-01T12:00:00Z',
        createdAt: '2024-01-01T12:00:00Z',
      },
    ];

    it('should get user notifications', async () => {
      vi.mocked(notificationDb.getUserNotifications).mockResolvedValue(mockNotifications);

      const result = await notificationService.getUserNotifications(mockUserId);

      expect(result).toEqual(mockNotifications);
      expect(notificationDb.getUserNotifications).toHaveBeenCalledWith(mockUserId, undefined);
    });

    it('should get user notifications with options', async () => {
      const options = { limit: 10, unreadOnly: true };
      vi.mocked(notificationDb.getUserNotifications).mockResolvedValue(mockNotifications);

      const result = await notificationService.getUserNotifications(mockUserId, options);

      expect(result).toEqual(mockNotifications);
      expect(notificationDb.getUserNotifications).toHaveBeenCalledWith(mockUserId, options);
    });
  });

  describe('markAsRead', () => {
    const mockNotification = {
      notificationId: 'notification-123',
      userId: mockUserId,
      ruleId: mockRuleId,
      coinId: mockCoinId,
      coinSymbol: mockCoinSymbol,
      crossoverType: 'GOLDEN_CROSS' as const,
      maPeriods: [7, 21],
      priceAtCrossover: 50000,
      maValuesAtCrossover: { ma7: 49000, ma21: 48000 },
      isRead: false,
      emailSent: false,
      triggeredAt: '2024-01-01T12:00:00Z',
      createdAt: '2024-01-01T12:00:00Z',
    };

    it('should mark notification as read', async () => {
      const readNotification = { ...mockNotification, isRead: true };
      vi.mocked(notificationDb.getNotification).mockResolvedValue(mockNotification);
      vi.mocked(notificationDb.updateNotificationReadStatus).mockResolvedValue(readNotification);

      const result = await notificationService.markAsRead(mockUserId, mockNotification.notificationId);

      expect(result).toEqual(readNotification);
      expect(notificationDb.updateNotificationReadStatus).toHaveBeenCalledWith(
        mockNotification.notificationId,
        true
      );
    });

    it('should throw error when notification not found', async () => {
      vi.mocked(notificationDb.getNotification).mockResolvedValue(null);

      await expect(
        notificationService.markAsRead(mockUserId, 'nonexistent')
      ).rejects.toThrow(NotificationNotFoundError);
    });

    it('should throw error when user is not owner', async () => {
      const otherUserNotification = { ...mockNotification, userId: 'other-user' };
      vi.mocked(notificationDb.getNotification).mockResolvedValue(otherUserNotification);

      await expect(
        notificationService.markAsRead(mockUserId, mockNotification.notificationId)
      ).rejects.toThrow(NotificationAuthorizationError);
    });

    it('should throw error when update fails', async () => {
      vi.mocked(notificationDb.getNotification).mockResolvedValue(mockNotification);
      vi.mocked(notificationDb.updateNotificationReadStatus).mockResolvedValue(null);

      await expect(
        notificationService.markAsRead(mockUserId, mockNotification.notificationId)
      ).rejects.toThrow('Failed to update notification');
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read', async () => {
      vi.mocked(notificationDb.markAllUserNotificationsAsRead).mockResolvedValue(undefined);

      await notificationService.markAllAsRead(mockUserId);

      expect(notificationDb.markAllUserNotificationsAsRead).toHaveBeenCalledWith(mockUserId);
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread count', async () => {
      vi.mocked(notificationDb.getUnreadNotificationCount).mockResolvedValue(5);

      const result = await notificationService.getUnreadCount(mockUserId);

      expect(result).toBe(5);
      expect(notificationDb.getUnreadNotificationCount).toHaveBeenCalledWith(mockUserId);
    });
  });

  describe('getNotification', () => {
    const mockNotification = {
      notificationId: 'notification-123',
      userId: mockUserId,
      ruleId: mockRuleId,
      coinId: mockCoinId,
      coinSymbol: mockCoinSymbol,
      crossoverType: 'GOLDEN_CROSS' as const,
      maPeriods: [7, 21],
      priceAtCrossover: 50000,
      maValuesAtCrossover: { ma7: 49000, ma21: 48000 },
      isRead: false,
      emailSent: false,
      triggeredAt: '2024-01-01T12:00:00Z',
      createdAt: '2024-01-01T12:00:00Z',
    };

    it('should get notification successfully', async () => {
      vi.mocked(notificationDb.getNotification).mockResolvedValue(mockNotification);

      const result = await notificationService.getNotification(mockUserId, mockNotification.notificationId);

      expect(result).toEqual(mockNotification);
    });

    it('should throw error when notification not found', async () => {
      vi.mocked(notificationDb.getNotification).mockResolvedValue(null);

      await expect(
        notificationService.getNotification(mockUserId, 'nonexistent')
      ).rejects.toThrow(NotificationNotFoundError);
    });

    it('should throw error when user is not owner', async () => {
      const otherUserNotification = { ...mockNotification, userId: 'other-user' };
      vi.mocked(notificationDb.getNotification).mockResolvedValue(otherUserNotification);

      await expect(
        notificationService.getNotification(mockUserId, mockNotification.notificationId)
      ).rejects.toThrow(NotificationAuthorizationError);
    });
  });
});
