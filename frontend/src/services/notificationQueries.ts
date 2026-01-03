import { gql } from '@apollo/client';

// Fragments for reusable fields
const NOTIFICATION_RULE_FIELDS = gql`
  fragment NotificationRuleFields on NotificationRule {
    ruleId
    userId
    coinId
    coinSymbol
    ruleType
    maPeriods
    crossDirection
    inAppEnabled
    emailEnabled
    isActive
    lastTriggeredAt
    createdAt
    updatedAt
  }
`;

const NOTIFICATION_FIELDS = gql`
  fragment NotificationFields on Notification {
    notificationId
    userId
    ruleId
    coinId
    coinSymbol
    crossoverType
    maPeriods
    priceAtCrossover
    maValuesAtCrossover {
      period
      value
    }
    isRead
    emailSent
    triggeredAt
    createdAt
  }
`;

// Queries
export const GET_NOTIFICATION_RULES = gql`
  ${NOTIFICATION_RULE_FIELDS}
  query GetNotificationRules($coinId: String) {
    notificationRules(coinId: $coinId) {
      ...NotificationRuleFields
    }
  }
`;

export const GET_NOTIFICATION_RULE = gql`
  ${NOTIFICATION_RULE_FIELDS}
  query GetNotificationRule($ruleId: String!) {
    notificationRule(ruleId: $ruleId) {
      ...NotificationRuleFields
    }
  }
`;

export const GET_NOTIFICATIONS = gql`
  ${NOTIFICATION_FIELDS}
  query GetNotifications($limit: Int, $unreadOnly: Boolean) {
    notifications(limit: $limit, unreadOnly: $unreadOnly) {
      ...NotificationFields
    }
  }
`;

export const GET_UNREAD_NOTIFICATION_COUNT = gql`
  query GetUnreadNotificationCount {
    unreadNotificationCount
  }
`;

// Mutations
export const CREATE_NOTIFICATION_RULE = gql`
  ${NOTIFICATION_RULE_FIELDS}
  mutation CreateNotificationRule($input: CreateNotificationRuleInput!) {
    createNotificationRule(input: $input) {
      ...NotificationRuleFields
    }
  }
`;

export const UPDATE_NOTIFICATION_RULE = gql`
  ${NOTIFICATION_RULE_FIELDS}
  mutation UpdateNotificationRule($ruleId: String!, $input: UpdateNotificationRuleInput!) {
    updateNotificationRule(ruleId: $ruleId, input: $input) {
      ...NotificationRuleFields
    }
  }
`;

export const DELETE_NOTIFICATION_RULE = gql`
  mutation DeleteNotificationRule($ruleId: String!) {
    deleteNotificationRule(ruleId: $ruleId)
  }
`;

export const MARK_NOTIFICATION_AS_READ = gql`
  ${NOTIFICATION_FIELDS}
  mutation MarkNotificationAsRead($notificationId: String!) {
    markNotificationAsRead(notificationId: $notificationId) {
      ...NotificationFields
    }
  }
`;

export const MARK_ALL_NOTIFICATIONS_AS_READ = gql`
  mutation MarkAllNotificationsAsRead {
    markAllNotificationsAsRead
  }
`;
