import { useState } from 'react';
import { useNotifications } from '../context/NotificationContext';
import {
  NotificationRule,
  NotificationRuleType,
  CrossDirection,
  CreateNotificationRuleInput,
  UpdateNotificationRuleInput,
} from '../types/notification';

interface NotificationRuleFormProps {
  coinId: string;
  coinSymbol: string;
  existingRule?: NotificationRule;
  onClose: () => void;
  onSuccess?: () => void;
}

const MA_PERIOD_OPTIONS = [7, 14, 21, 30, 50, 100, 200];
const MAX_MA_PERIODS = 4;
const MAX_RULES_PER_COIN = 3;

const NotificationRuleForm = ({
  coinId,
  coinSymbol,
  existingRule,
  onClose,
  onSuccess,
}: NotificationRuleFormProps) => {
  const { createRule, updateRule, getRulesForCoin } = useNotifications();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [ruleType, setRuleType] = useState<NotificationRuleType>(
    existingRule?.ruleType || NotificationRuleType.MA_CROSSOVER
  );
  const [maPeriods, setMaPeriods] = useState<number[]>(
    existingRule?.maPeriods || [7, 21]
  );
  const [crossDirection, setCrossDirection] = useState<CrossDirection>(
    existingRule?.crossDirection || CrossDirection.BOTH
  );
  const [inAppEnabled, setInAppEnabled] = useState(
    existingRule?.inAppEnabled ?? true
  );
  const [emailEnabled, setEmailEnabled] = useState(
    existingRule?.emailEnabled ?? false
  );
  const [isActive, setIsActive] = useState(
    existingRule?.isActive ?? true
  );

  const existingRulesCount = getRulesForCoin(coinId).length;
  const canCreateNewRule = existingRule || existingRulesCount < MAX_RULES_PER_COIN;

  const handleMaPeriodToggle = (period: number) => {
    if (maPeriods.includes(period)) {
      if (maPeriods.length > 2) {
        setMaPeriods(maPeriods.filter(p => p !== period));
      }
    } else if (maPeriods.length < MAX_MA_PERIODS) {
      setMaPeriods([...maPeriods, period].sort((a, b) => a - b));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (maPeriods.length < 2) {
        throw new Error('Please select at least 2 moving average periods');
      }

      if (!inAppEnabled && !emailEnabled) {
        throw new Error('Please enable at least one notification method');
      }

      if (existingRule) {
        const input: UpdateNotificationRuleInput = {
          maPeriods,
          crossDirection,
          inAppEnabled,
          emailEnabled,
          isActive,
        };
        await updateRule(existingRule.ruleId, input);
      } else {
        const input: CreateNotificationRuleInput = {
          coinId,
          coinSymbol,
          ruleType,
          maPeriods,
          crossDirection,
          inAppEnabled,
          emailEnabled,
        };
        await createRule(input);
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save rule');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!canCreateNewRule) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        <div className="text-center">
          <svg
            className="mx-auto h-12 w-12 text-yellow-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
            Rule Limit Reached
          </h3>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            You can have up to {MAX_RULES_PER_COIN} notification rules per coin.
            Please delete an existing rule to create a new one.
          </p>
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {existingRule ? 'Edit' : 'Create'} Alert for {coinSymbol.toUpperCase()}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Rule Type */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Alert Type
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setRuleType(NotificationRuleType.MA_CROSSOVER)}
            disabled={!!existingRule}
            className={`px-3 py-2 text-sm rounded-md border transition-colors ${
              ruleType === NotificationRuleType.MA_CROSSOVER
                ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300'
                : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
            } ${existingRule ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            MA Crossover
          </button>
          <button
            type="button"
            onClick={() => setRuleType(NotificationRuleType.PRICE_MA_CROSSOVER)}
            disabled={!!existingRule}
            className={`px-3 py-2 text-sm rounded-md border transition-colors ${
              ruleType === NotificationRuleType.PRICE_MA_CROSSOVER
                ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300'
                : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
            } ${existingRule ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            Price vs MA
          </button>
        </div>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {ruleType === NotificationRuleType.MA_CROSSOVER
            ? 'Get notified when moving averages cross each other (Golden/Death Cross)'
            : 'Get notified when price crosses above or below a moving average'}
        </p>
      </div>

      {/* MA Periods */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Moving Average Periods ({maPeriods.length}/{MAX_MA_PERIODS} selected)
        </label>
        <div className="flex flex-wrap gap-2">
          {MA_PERIOD_OPTIONS.map(period => (
            <button
              key={period}
              type="button"
              onClick={() => handleMaPeriodToggle(period)}
              className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                maPeriods.includes(period)
                  ? 'bg-indigo-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              } ${
                !maPeriods.includes(period) && maPeriods.length >= MAX_MA_PERIODS
                  ? 'opacity-50 cursor-not-allowed'
                  : ''
              }`}
              disabled={!maPeriods.includes(period) && maPeriods.length >= MAX_MA_PERIODS}
            >
              {period}-day
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Select 2-4 periods to monitor
        </p>
      </div>

      {/* Cross Direction */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Alert Direction
        </label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: CrossDirection.BOTH, label: 'Both' },
            { value: CrossDirection.ABOVE, label: 'Bullish Only' },
            { value: CrossDirection.BELOW, label: 'Bearish Only' },
          ].map(option => (
            <button
              key={option.value}
              type="button"
              onClick={() => setCrossDirection(option.value)}
              className={`px-3 py-2 text-sm rounded-md border transition-colors ${
                crossDirection === option.value
                  ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300'
                  : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notification Methods */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Notification Methods
        </label>
        <div className="space-y-2">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={inAppEnabled}
              onChange={e => setInAppEnabled(e.target.checked)}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
              In-app notification
            </span>
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={emailEnabled}
              onChange={e => setEmailEnabled(e.target.checked)}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
              Email notification
            </span>
            <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">
              (max 1 per 5 minutes)
            </span>
          </label>
        </div>
      </div>

      {/* Active Toggle (only for existing rules) */}
      {existingRule && (
        <div className="mb-6">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={isActive}
              onChange={e => setIsActive(e.target.checked)}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
              Rule is active
            </span>
          </label>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Saving...' : existingRule ? 'Update Rule' : 'Create Rule'}
        </button>
      </div>
    </form>
  );
};

export default NotificationRuleForm;
