import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useNotifications } from '../context/NotificationContext';
import { CrossoverType, Notification } from '../types/notification';

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

const getCrossoverColors = (type: CrossoverType): { bg: string; border: string; icon: string } => {
  switch (type) {
    case CrossoverType.GOLDEN_CROSS:
    case CrossoverType.PRICE_ABOVE_MA:
      return {
        bg: 'bg-green-50 dark:bg-green-900/30',
        border: 'border-green-200 dark:border-green-800',
        icon: 'text-green-500',
      };
    case CrossoverType.DEATH_CROSS:
    case CrossoverType.PRICE_BELOW_MA:
      return {
        bg: 'bg-red-50 dark:bg-red-900/30',
        border: 'border-red-200 dark:border-red-800',
        icon: 'text-red-500',
      };
    default:
      return {
        bg: 'bg-blue-50 dark:bg-blue-900/30',
        border: 'border-blue-200 dark:border-blue-800',
        icon: 'text-blue-500',
      };
  }
};

const getNotificationMessage = (notification: Notification): string => {
  const periods = notification.maPeriods.join('/');
  switch (notification.crossoverType) {
    case CrossoverType.GOLDEN_CROSS:
      return `Short-term MA crossed above long-term MA (${periods}-day)`;
    case CrossoverType.DEATH_CROSS:
      return `Short-term MA crossed below long-term MA (${periods}-day)`;
    case CrossoverType.PRICE_ABOVE_MA:
      return `Price crossed above ${periods}-day MA`;
    case CrossoverType.PRICE_BELOW_MA:
      return `Price crossed below ${periods}-day MA`;
    default:
      return 'MA crossover detected';
  }
};

const NotificationToast = () => {
  const { toastNotification, dismissToast, markAsRead } = useNotifications();
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    if (toastNotification) {
      setIsLeaving(false);
      // Small delay to trigger animation
      const showTimer = setTimeout(() => setIsVisible(true), 50);
      return () => clearTimeout(showTimer);
    } else {
      setIsVisible(false);
    }
  }, [toastNotification]);

  const handleDismiss = () => {
    setIsLeaving(true);
    setTimeout(() => {
      dismissToast();
      setIsLeaving(false);
    }, 300);
  };

  const handleClick = () => {
    if (toastNotification && !toastNotification.isRead) {
      markAsRead(toastNotification.notificationId);
    }
    handleDismiss();
  };

  if (!toastNotification) return null;

  const colors = getCrossoverColors(toastNotification.crossoverType);

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 max-w-sm transform transition-all duration-300 ease-out ${
        isVisible && !isLeaving
          ? 'translate-y-0 opacity-100'
          : 'translate-y-4 opacity-0'
      }`}
    >
      <div
        className={`${colors.bg} ${colors.border} border rounded-lg shadow-lg overflow-hidden`}
      >
        <div className="p-4">
          <div className="flex items-start">
            <div className={`flex-shrink-0 ${colors.icon}`}>
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>

            <div className="ml-3 flex-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {toastNotification.coinSymbol.toUpperCase()} -{' '}
                  {getCrossoverTypeLabel(toastNotification.crossoverType)}
                </p>
                <button
                  onClick={handleDismiss}
                  className="ml-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                {getNotificationMessage(toastNotification)}
              </p>

              <div className="mt-2">
                <Link
                  to={`/crypto/${toastNotification.coinSymbol}`}
                  onClick={handleClick}
                  className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500"
                >
                  View details
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-gray-200 dark:bg-gray-700">
          <div
            className="h-full bg-indigo-500 animate-shrink-width"
            style={{ animationDuration: '8s' }}
          />
        </div>
      </div>
    </div>
  );
};

export default NotificationToast;
