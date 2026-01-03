import { useState } from 'react';
import { useNotifications } from '../context/NotificationContext';
import { NotificationRule, NotificationRuleType, CrossDirection } from '../types/notification';
import NotificationRuleForm from './NotificationRuleForm';

interface NotificationRulesListProps {
  coinId: string;
  coinSymbol: string;
}

const getRuleTypeLabel = (type: NotificationRuleType): string => {
  switch (type) {
    case NotificationRuleType.MA_CROSSOVER:
      return 'MA Crossover';
    case NotificationRuleType.PRICE_MA_CROSSOVER:
      return 'Price vs MA';
    default:
      return type;
  }
};

const getCrossDirectionLabel = (direction: CrossDirection): string => {
  switch (direction) {
    case CrossDirection.BOTH:
      return 'Both';
    case CrossDirection.ABOVE:
      return 'Bullish';
    case CrossDirection.BELOW:
      return 'Bearish';
    default:
      return direction;
  }
};

interface RuleCardProps {
  rule: NotificationRule;
  onEdit: () => void;
  onDelete: () => void;
}

const RuleCard = ({ rule, onEdit, onDelete }: RuleCardProps) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this notification rule?')) {
      return;
    }
    setIsDeleting(true);
    try {
      await onDelete();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      className={`p-4 border rounded-lg ${
        rule.isActive
          ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
          : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 opacity-60'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {getRuleTypeLabel(rule.ruleType)}
            </span>
            {!rule.isActive && (
              <span className="px-2 py-0.5 text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                Paused
              </span>
            )}
          </div>

          <div className="mt-2 flex flex-wrap gap-1">
            {rule.maPeriods.map(period => (
              <span
                key={period}
                className="px-2 py-0.5 text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded"
              >
                {period}-day
              </span>
            ))}
          </div>

          <div className="mt-2 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
            <span>Direction: {getCrossDirectionLabel(rule.crossDirection)}</span>
            <span className="flex items-center gap-1">
              {rule.inAppEnabled && (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
              )}
              {rule.emailEnabled && (
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                  <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                </svg>
              )}
            </span>
          </div>

          {rule.lastTriggeredAt && (
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
              Last triggered: {new Date(rule.lastTriggeredAt).toLocaleString()}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onEdit}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
            title="Edit rule"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded disabled:opacity-50"
            title="Delete rule"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

const NotificationRulesList = ({ coinId, coinSymbol }: NotificationRulesListProps) => {
  const { getRulesForCoin, deleteRule, isLoading } = useNotifications();
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<NotificationRule | null>(null);

  const rules = getRulesForCoin(coinId);

  const handleEdit = (rule: NotificationRule) => {
    setEditingRule(rule);
    setShowForm(true);
  };

  const handleDelete = async (ruleId: string) => {
    try {
      await deleteRule(ruleId);
    } catch (err) {
      console.error('Failed to delete rule:', err);
    }
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingRule(null);
  };

  if (showForm) {
    return (
      <NotificationRuleForm
        coinId={coinId}
        coinSymbol={coinSymbol}
        existingRule={editingRule || undefined}
        onClose={handleCloseForm}
      />
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          Crossover Alerts
        </h3>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-900/50"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Alert
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600" />
        </div>
      ) : rules.length === 0 ? (
        <div className="text-center py-4">
          <svg
            className="mx-auto h-10 w-10 text-gray-400"
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
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            No alerts set up
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Get notified when moving averages cross
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map(rule => (
            <RuleCard
              key={rule.ruleId}
              rule={rule}
              onEdit={() => handleEdit(rule)}
              onDelete={() => handleDelete(rule.ruleId)}
            />
          ))}
          {rules.length < 3 && (
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
              {3 - rules.length} more alert{rules.length === 2 ? '' : 's'} available
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationRulesList;
