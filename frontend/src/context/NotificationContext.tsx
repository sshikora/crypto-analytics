import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useQuery, useMutation, useApolloClient } from '@apollo/client';
import { useAuth } from './AuthContext';
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
import {
  Notification,
  NotificationRule,
  CreateNotificationRuleInput,
  UpdateNotificationRuleInput,
} from '../types/notification';

interface NotificationContextType {
  // State
  notifications: Notification[];
  notificationRules: NotificationRule[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;

  // Toast notifications
  toastNotification: Notification | null;
  dismissToast: () => void;

  // Notification actions
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refetchNotifications: () => Promise<void>;

  // Rule actions
  createRule: (input: CreateNotificationRuleInput) => Promise<NotificationRule>;
  updateRule: (ruleId: string, input: UpdateNotificationRuleInput) => Promise<NotificationRule>;
  deleteRule: (ruleId: string) => Promise<void>;
  refetchRules: () => Promise<void>;
  getRulesForCoin: (coinId: string) => NotificationRule[];
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

interface NotificationProviderProps {
  children: ReactNode;
}

const POLL_INTERVAL = 60000; // Poll every 60 seconds for new notifications

export const NotificationProvider = ({ children }: NotificationProviderProps) => {
  const { isAuthenticated } = useAuth();
  const client = useApolloClient();
  const [toastNotification, setToastNotification] = useState<Notification | null>(null);
  const [lastNotificationId, setLastNotificationId] = useState<string | null>(null);

  // Fetch notifications
  const {
    data: notificationsData,
    loading: notificationsLoading,
    error: notificationsError,
    refetch: refetchNotificationsQuery,
  } = useQuery(GET_NOTIFICATIONS, {
    variables: { limit: 50 },
    skip: !isAuthenticated,
    pollInterval: isAuthenticated ? POLL_INTERVAL : 0,
  });

  // Fetch notification rules
  const {
    data: rulesData,
    loading: rulesLoading,
    error: rulesError,
    refetch: refetchRulesQuery,
  } = useQuery(GET_NOTIFICATION_RULES, {
    skip: !isAuthenticated,
  });

  // Fetch unread count
  const {
    data: unreadCountData,
    refetch: refetchUnreadCount,
  } = useQuery(GET_UNREAD_NOTIFICATION_COUNT, {
    skip: !isAuthenticated,
    pollInterval: isAuthenticated ? POLL_INTERVAL : 0,
  });

  // Mutations
  const [createRuleMutation] = useMutation(CREATE_NOTIFICATION_RULE);
  const [updateRuleMutation] = useMutation(UPDATE_NOTIFICATION_RULE);
  const [deleteRuleMutation] = useMutation(DELETE_NOTIFICATION_RULE);
  const [markAsReadMutation] = useMutation(MARK_NOTIFICATION_AS_READ);
  const [markAllAsReadMutation] = useMutation(MARK_ALL_NOTIFICATIONS_AS_READ);

  const notifications: Notification[] = notificationsData?.notifications || [];
  const notificationRules: NotificationRule[] = rulesData?.notificationRules || [];
  const unreadCount: number = unreadCountData?.unreadNotificationCount || 0;
  const isLoading = notificationsLoading || rulesLoading;
  const error = notificationsError?.message || rulesError?.message || null;

  // Show toast for new notifications
  useEffect(() => {
    if (notifications.length > 0) {
      const latestNotification = notifications[0];
      if (
        latestNotification.notificationId !== lastNotificationId &&
        !latestNotification.isRead
      ) {
        setLastNotificationId(latestNotification.notificationId);
        setToastNotification(latestNotification);

        // Auto-dismiss after 8 seconds
        const timer = setTimeout(() => {
          setToastNotification(null);
        }, 8000);

        return () => clearTimeout(timer);
      }
    }
  }, [notifications, lastNotificationId]);

  const dismissToast = useCallback(() => {
    setToastNotification(null);
  }, []);

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await markAsReadMutation({
        variables: { notificationId },
        refetchQueries: [
          { query: GET_NOTIFICATIONS, variables: { limit: 50 } },
          { query: GET_UNREAD_NOTIFICATION_COUNT },
        ],
      });
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
      throw err;
    }
  }, [markAsReadMutation]);

  const markAllAsRead = useCallback(async () => {
    try {
      await markAllAsReadMutation({
        refetchQueries: [
          { query: GET_NOTIFICATIONS, variables: { limit: 50 } },
          { query: GET_UNREAD_NOTIFICATION_COUNT },
        ],
      });
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
      throw err;
    }
  }, [markAllAsReadMutation]);

  const refetchNotifications = useCallback(async () => {
    await refetchNotificationsQuery();
    await refetchUnreadCount();
  }, [refetchNotificationsQuery, refetchUnreadCount]);

  const createRule = useCallback(async (input: CreateNotificationRuleInput): Promise<NotificationRule> => {
    try {
      const { data } = await createRuleMutation({
        variables: { input },
        refetchQueries: [{ query: GET_NOTIFICATION_RULES }],
      });
      return data.createNotificationRule;
    } catch (err) {
      console.error('Failed to create notification rule:', err);
      throw err;
    }
  }, [createRuleMutation]);

  const updateRule = useCallback(async (
    ruleId: string,
    input: UpdateNotificationRuleInput
  ): Promise<NotificationRule> => {
    try {
      const { data } = await updateRuleMutation({
        variables: { ruleId, input },
        refetchQueries: [{ query: GET_NOTIFICATION_RULES }],
      });
      return data.updateNotificationRule;
    } catch (err) {
      console.error('Failed to update notification rule:', err);
      throw err;
    }
  }, [updateRuleMutation]);

  const deleteRule = useCallback(async (ruleId: string): Promise<void> => {
    try {
      await deleteRuleMutation({
        variables: { ruleId },
        refetchQueries: [{ query: GET_NOTIFICATION_RULES }],
      });
    } catch (err) {
      console.error('Failed to delete notification rule:', err);
      throw err;
    }
  }, [deleteRuleMutation]);

  const refetchRules = useCallback(async () => {
    await refetchRulesQuery();
  }, [refetchRulesQuery]);

  const getRulesForCoin = useCallback((coinId: string): NotificationRule[] => {
    return notificationRules.filter(rule => rule.coinId === coinId);
  }, [notificationRules]);

  // Clear state when user logs out
  useEffect(() => {
    if (!isAuthenticated) {
      setToastNotification(null);
      setLastNotificationId(null);
      client.cache.evict({ fieldName: 'notifications' });
      client.cache.evict({ fieldName: 'notificationRules' });
      client.cache.evict({ fieldName: 'unreadNotificationCount' });
    }
  }, [isAuthenticated, client]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        notificationRules,
        unreadCount,
        isLoading,
        error,
        toastNotification,
        dismissToast,
        markAsRead,
        markAllAsRead,
        refetchNotifications,
        createRule,
        updateRule,
        deleteRule,
        refetchRules,
        getRulesForCoin,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};
