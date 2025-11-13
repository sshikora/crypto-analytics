import React from 'react';
import { TimeRange } from '../types/crypto';

interface TimeRangeSelectorProps {
  selected: TimeRange;
  onChange: (range: TimeRange) => void;
}

export const TimeRangeSelector: React.FC<TimeRangeSelectorProps> = ({
  selected,
  onChange,
}) => {
  const ranges = [
    { label: '24H', value: TimeRange.DAY },
    { label: '7D', value: TimeRange.WEEK },
    { label: '1M', value: TimeRange.MONTH },
    { label: '1Y', value: TimeRange.YEAR },
    { label: 'All', value: TimeRange.ALL },
  ];

  return (
    <div className="flex space-x-2 bg-gray-100 p-1 rounded-lg">
      {ranges.map((range) => (
        <button
          key={range.value}
          onClick={() => onChange(range.value)}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            selected === range.value
              ? 'bg-white text-primary-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          {range.label}
        </button>
      ))}
    </div>
  );
};
