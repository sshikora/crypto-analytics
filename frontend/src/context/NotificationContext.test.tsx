import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import { ReactNode } from 'react';
import { NotificationProvider, useNotifications } from './NotificationContext';
import { AuthProvider } from './AuthContext';
import {
  GET_NOTIFICATIONS,
  GET_NOTIFICATION_RULES,
  GET_UNREAD_NOTIFICATION_COUNT,
  CREATE_NOTIFICATION_RULE,
  UPDATE_NOTIFICATION_RULE,
  DELETE_NOTIFICATION_RULE,
  MARK_NOTIFICATION_AS_READ,
  MARK_ALL_NOTIFICATIONS_AS_READ,
} from '../services/notificationQueries';

// Mock AuthContext
vi.mock('./AuthContext', () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  useAuth: () => ({
    isAuthenticated: true,
    user: { sub: 'user-123', email: 'test@example.com' },
  }),
}));

const mockNotification = {
  __typename: 'Notification',
  notificationId: 'notification-123',
  userId: 'user-123',
  ruleId: 'rule-123',
  coinId: 'bitcoin',
  coinSymbol: 'BTC',
  crossoverType: 'GOLDEN_CROSS',
  maPeriods: [7, 21],
  priceAtCrossover: 50000,
  maValuesAtCrossover: [
    { __typename: 'MAValue', period: 7, value: 49000 },
    { __typename: 'MAValue', period: 21, value: 48000 },
  ],
  isRead: false,
  emailSent: false,
  triggeredAt: '2024-01-01T12:00:00Z',
  createdAt: '2024-01-01T12:00:00Z',
};

const mockRule = {
  __typename: 'NotificationRule',
  ruleId: 'rule-123',
  userId: 'user-123',
  coinId: 'bitcoin',
  coinSymbol: 'BTC',
  ruleType: 'MA_CROSSOVER',
  maPeriods: [7, 21],
  crossDirection: 'BOTH',
  inAppEnabled: true,
  emailEnabled: false,
  isActive: true,
  lastTriggeredAt: null,
  lastCrossoverState: null,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const createWrapper = (mocks: any[]) => {
  return ({ children }: { children: ReactNode }) => (
    <MockedProvider mocks={mocks}>
      <AuthProvider>
        <NotificationProvider>{children}</NotificationProvider>
      </AuthProvider>
    </MockedProvider>
  );
};

describe('NotificationContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useNotifications', () => {
    it('should throw error when used outside provider', () => {
      expect(() => {
        renderHook(() => useNotifications());
      }).toThrow('useNotifications must be used within a NotificationProvider');
    });
  });

  describe('NotificationProvider', () => {
    it('should provide notifications data', async () => {
      const mocks = [
        {
          request: {
            query: GET_NOTIFICATIONS,
            variables: { limit: 50 },
          },
          result: {
            data: {
              notifications: [mockNotification],
            },
          },
        },
        {
          request: {
            query: GET_NOTIFICATION_RULES,
          },
          result: {
            data: {
              notificationRules: [mockRule],
            },
          },
        },
        {
          request: {
            query: GET_UNREAD_NOTIFICATION_COUNT,
          },
          result: {
            data: {
              unreadNotificationCount: 1,
            },
          },
        },
      ];

      const { result } = renderHook(() => useNotifications(), {
        wrapper: createWrapper(mocks),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.notifications).toHaveLength(1);
      expect(result.current.notifications[0]).toEqual(mockNotification);
      expect(result.current.notificationRules).toHaveLength(1);
      expect(result.current.unreadCount).toBe(1);
    });

    it('should handle create rule', async () => {
      const newRuleInput = {
        coinId: 'ethereum',
        coinSymbol: 'ETH',
        ruleType: 'MA_CROSSOVER' as const,
        maPeriods: [7, 21],
        crossDirection: 'BOTH' as const,
        inAppEnabled: true,
        emailEnabled: false,
      };

      const newRule = {
        ...mockRule,
        ruleId: 'rule-456',
        coinId: 'ethereum',
        coinSymbol: 'ETH',
      };

      const mocks = [
        {
          request: {
            query: GET_NOTIFICATIONS,
            variables: { limit: 50 },
          },
          result: {
            data: { notifications: [] },
          },
        },
        {
          request: {
            query: GET_NOTIFICATION_RULES,
          },
          result: {
            data: { notificationRules: [mockRule] },
          },
        },
        {
          request: {
            query: GET_UNREAD_NOTIFICATION_COUNT,
          },
          result: {
            data: { unreadNotificationCount: 0 },
          },
        },
        {
          request: {
            query: CREATE_NOTIFICATION_RULE,
            variables: { input: newRuleInput },
          },
          result: {
            data: {
              createNotificationRule: newRule,
            },
          },
        },
        {
          request: {
            query: GET_NOTIFICATION_RULES,
          },
          result: {
            data: { notificationRules: [mockRule, newRule] },
          },
        },
      ];

      const { result } = renderHook(() => useNotifications(), {
        wrapper: createWrapper(mocks),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const createdRule = await result.current.createRule(newRuleInput);
      expect(createdRule).toEqual(newRule);
    });

    it('should handle update rule', async () => {
      const updateInput = {
        maPeriods: [14, 30],
        isActive: false,
      };

      const updatedRule = {
        ...mockRule,
        maPeriods: [14, 30],
        isActive: false,
      };

      const mocks = [
        {
          request: {
            query: GET_NOTIFICATIONS,
            variables: { limit: 50 },
          },
          result: {
            data: { notifications: [] },
          },
        },
        {
          request: {
            query: GET_NOTIFICATION_RULES,
          },
          result: {
            data: { notificationRules: [mockRule] },
          },
        },
        {
          request: {
            query: GET_UNREAD_NOTIFICATION_COUNT,
          },
          result: {
            data: { unreadNotificationCount: 0 },
          },
        },
        {
          request: {
            query: UPDATE_NOTIFICATION_RULE,
            variables: { ruleId: 'rule-123', input: updateInput },
          },
          result: {
            data: {
              updateNotificationRule: updatedRule,
            },
          },
        },
        {
          request: {
            query: GET_NOTIFICATION_RULES,
          },
          result: {
            data: { notificationRules: [updatedRule] },
          },
        },
      ];

      const { result } = renderHook(() => useNotifications(), {
        wrapper: createWrapper(mocks),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const updated = await result.current.updateRule('rule-123', updateInput);
      expect(updated).toEqual(updatedRule);
    });

    it('should handle delete rule', async () => {
      const mocks = [
        {
          request: {
            query: GET_NOTIFICATIONS,
            variables: { limit: 50 },
          },
          result: {
            data: { notifications: [] },
          },
        },
        {
          request: {
            query: GET_NOTIFICATION_RULES,
          },
          result: {
            data: { notificationRules: [mockRule] },
          },
        },
        {
          request: {
            query: GET_UNREAD_NOTIFICATION_COUNT,
          },
          result: {
            data: { unreadNotificationCount: 0 },
          },
        },
        {
          request: {
            query: DELETE_NOTIFICATION_RULE,
            variables: { ruleId: 'rule-123' },
          },
          result: {
            data: {
              deleteNotificationRule: true,
            },
          },
        },
        {
          request: {
            query: GET_NOTIFICATION_RULES,
          },
          result: {
            data: { notificationRules: [] },
          },
        },
      ];

      const { result } = renderHook(() => useNotifications(), {
        wrapper: createWrapper(mocks),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await result.current.deleteRule('rule-123');
      // Deletion should succeed without error
    });

    it('should handle mark as read', async () => {
      const readNotification = {
        ...mockNotification,
        isRead: true,
      };

      const mocks = [
        {
          request: {
            query: GET_NOTIFICATIONS,
            variables: { limit: 50 },
          },
          result: {
            data: { notifications: [mockNotification] },
          },
        },
        {
          request: {
            query: GET_NOTIFICATION_RULES,
          },
          result: {
            data: { notificationRules: [] },
          },
        },
        {
          request: {
            query: GET_UNREAD_NOTIFICATION_COUNT,
          },
          result: {
            data: { unreadNotificationCount: 1 },
          },
        },
        {
          request: {
            query: MARK_NOTIFICATION_AS_READ,
            variables: { notificationId: 'notification-123' },
          },
          result: {
            data: {
              markNotificationAsRead: readNotification,
            },
          },
        },
        {
          request: {
            query: GET_NOTIFICATIONS,
            variables: { limit: 50 },
          },
          result: {
            data: { notifications: [readNotification] },
          },
        },
        {
          request: {
            query: GET_UNREAD_NOTIFICATION_COUNT,
          },
          result: {
            data: { unreadNotificationCount: 0 },
          },
        },
      ];

      const { result } = renderHook(() => useNotifications(), {
        wrapper: createWrapper(mocks),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await result.current.markAsRead('notification-123');
      // Mark as read should succeed without error
    });

    it('should handle mark all as read', async () => {
      const mocks = [
        {
          request: {
            query: GET_NOTIFICATIONS,
            variables: { limit: 50 },
          },
          result: {
            data: { notifications: [mockNotification] },
          },
        },
        {
          request: {
            query: GET_NOTIFICATION_RULES,
          },
          result: {
            data: { notificationRules: [] },
          },
        },
        {
          request: {
            query: GET_UNREAD_NOTIFICATION_COUNT,
          },
          result: {
            data: { unreadNotificationCount: 1 },
          },
        },
        {
          request: {
            query: MARK_ALL_NOTIFICATIONS_AS_READ,
          },
          result: {
            data: {
              markAllNotificationsAsRead: true,
            },
          },
        },
        {
          request: {
            query: GET_NOTIFICATIONS,
            variables: { limit: 50 },
          },
          result: {
            data: {
              notifications: [{ ...mockNotification, isRead: true }],
            },
          },
        },
        {
          request: {
            query: GET_UNREAD_NOTIFICATION_COUNT,
          },
          result: {
            data: { unreadNotificationCount: 0 },
          },
        },
      ];

      const { result } = renderHook(() => useNotifications(), {
        wrapper: createWrapper(mocks),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await result.current.markAllAsRead();
      // Mark all as read should succeed without error
    });

    it('should get rules for specific coin', async () => {
      const btcRule = { ...mockRule, coinId: 'bitcoin', coinSymbol: 'BTC' };
      const ethRule = { ...mockRule, ruleId: 'rule-456', coinId: 'ethereum', coinSymbol: 'ETH' };

      const mocks = [
        {
          request: {
            query: GET_NOTIFICATIONS,
            variables: { limit: 50 },
          },
          result: {
            data: { notifications: [] },
          },
        },
        {
          request: {
            query: GET_NOTIFICATION_RULES,
          },
          result: {
            data: { notificationRules: [btcRule, ethRule] },
          },
        },
        {
          request: {
            query: GET_UNREAD_NOTIFICATION_COUNT,
          },
          result: {
            data: { unreadNotificationCount: 0 },
          },
        },
      ];

      const { result } = renderHook(() => useNotifications(), {
        wrapper: createWrapper(mocks),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const btcRules = result.current.getRulesForCoin('bitcoin');
      expect(btcRules).toHaveLength(1);
      expect(btcRules[0].coinSymbol).toBe('BTC');

      const ethRules = result.current.getRulesForCoin('ethereum');
      expect(ethRules).toHaveLength(1);
      expect(ethRules[0].coinSymbol).toBe('ETH');
    });

    it('should handle errors gracefully', async () => {
      const mocks = [
        {
          request: {
            query: GET_NOTIFICATIONS,
            variables: { limit: 50 },
          },
          error: new Error('Network error'),
        },
        {
          request: {
            query: GET_NOTIFICATION_RULES,
          },
          result: {
            data: { notificationRules: [] },
          },
        },
        {
          request: {
            query: GET_UNREAD_NOTIFICATION_COUNT,
          },
          result: {
            data: { unreadNotificationCount: 0 },
          },
        },
      ];

      const { result } = renderHook(() => useNotifications(), {
        wrapper: createWrapper(mocks),
      });

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      expect(result.current.notifications).toEqual([]);
    });
  });
});
