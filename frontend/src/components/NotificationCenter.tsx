import { useNotifications } from '../context/NotificationContext';
import { Notification, CrossoverType } from '../types/notification';
import { Link } from 'react-router-dom';

interface NotificationCenterProps {
  onClose: () => void;
}

const getCrossoverTypeLabel = (type: CrossoverType): string => {
  switch (type) {
    case CrossoverType.GOLDEN_CROSS:
      return 'Golden Cross';
    case CrossoverType.DEATH_CROSS:
      return 'Death Cross';
    case CrossoverType.PRICE_ABOVE_MA:
      return 'Price Above MA';
    case CrossoverType.PRICE_BELOW_MA:
      return 'Price Below MA';
    default:
      return type;
  }
};

const getCrossoverTypeColor = (type: CrossoverType): string => {
  switch (type) {
    case CrossoverType.GOLDEN_CROSS:
    case CrossoverType.PRICE_ABOVE_MA:
      return 'text-green-600 dark:text-green-400';
    case CrossoverType.DEATH_CROSS:
    case CrossoverType.PRICE_BELOW_MA:
      return 'text-red-600 dark:text-red-400';
    default:
      return 'text-gray-600 dark:text-gray-400';
  }
};

const formatTimeAgo = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

const getNotificationMessage = (notification: Notification): string => {
  const periods = notification.maPeriods.join('/');
  switch (notification.crossoverType) {
    case CrossoverType.GOLDEN_CROSS:
      return `${notification.coinSymbol.toUpperCase()} short-term MA crossed above long-term MA (${periods}-day)`;
    case CrossoverType.DEATH_CROSS:
      return `${notification.coinSymbol.toUpperCase()} short-term MA crossed below long-term MA (${periods}-day)`;
    case CrossoverType.PRICE_ABOVE_MA:
      return `${notification.coinSymbol.toUpperCase()} price crossed above ${periods}-day MA`;
    case CrossoverType.PRICE_BELOW_MA:
      return `${notification.coinSymbol.toUpperCase()} price crossed below ${periods}-day MA`;
    default:
      return `${notification.coinSymbol.toUpperCase()} MA crossover detected`;
  }
};

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
}

const NotificationItem = ({ notification, onMarkAsRead }: NotificationItemProps) => {
  const handleClick = () => {
    if (!notification.isRead) {
      onMarkAsRead(notification.notificationId);
    }
  };

  return (
    <Link
      to={`/crypto/${notification.coinSymbol}`}
      onClick={handleClick}
      className={`block px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
        !notification.isRead ? 'bg-blue-50 dark:bg-blue-900/20' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`flex-shrink-0 mt-0.5 ${!notification.isRead ? 'visible' : 'invisible'}`}>
          <div className="w-2 h-2 bg-blue-500 rounded-full" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-sm text-gray-900 dark:text-white">
              {notification.coinSymbol.toUpperCase()}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
              {formatTimeAgo(notification.createdAt)}
            </span>
          </div>

          <div className="mt-0.5">
            <span className={`text-sm font-medium ${getCrossoverTypeColor(notification.crossoverType)}`}>
              {getCrossoverTypeLabel(notification.crossoverType)}
            </span>
          </div>

          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
            {getNotificationMessage(notification)}
          </p>

          <div className="mt-1 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span>Price: ${notification.priceAtCrossover.toLocaleString()}</span>
            {notification.emailSent && (
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                  <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                </svg>
                Emailed
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
};

const NotificationCenter = ({ onClose }: NotificationCenterProps) => {
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead } = useNotifications();

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead();
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-white">Notifications</h3>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300"
            >
              Mark all as read
            </button>
          )}
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label="Close notifications"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-h-[60vh] overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-8 text-center text-gray-500 dark:text-gray-400">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
            <p className="mt-2 text-sm">No notifications yet</p>
            <p className="mt-1 text-xs">Set up crossover alerts to get notified</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.notificationId}
                notification={notification}
                onMarkAsRead={markAsRead}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <Link
            to="/settings/notifications"
            onClick={onClose}
            className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300"
          >
            Manage notification settings
          </Link>
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
