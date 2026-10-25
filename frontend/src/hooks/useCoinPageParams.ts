import { useSearchParams } from 'react-router-dom';
import { TimeRange } from '../types/crypto';

export const COIN_TABS = ['overview', 'risk'] as const;
export type CoinTab = (typeof COIN_TABS)[number];

// URL values match the labels on the time range buttons
const RANGE_BY_PARAM: Record<string, TimeRange> = {
  '24h': TimeRange.DAY,
  '7d': TimeRange.WEEK,
  '1m': TimeRange.MONTH,
  '1y': TimeRange.YEAR,
  all: TimeRange.ALL,
};

const PARAM_BY_RANGE = Object.fromEntries(
  Object.entries(RANGE_BY_PARAM).map(([param, range]) => [range, param])
) as Record<TimeRange, string>;

function isCoinTab(value: string | null): value is CoinTab {
  return COIN_TABS.includes(value as CoinTab);
}

export function useCoinPageParams(defaultRange: TimeRange) {
  const [params, setParams] = useSearchParams();

  const tabParam = params.get('tab');
  const tab: CoinTab = isCoinTab(tabParam) ? tabParam : 'overview';
  const range = RANGE_BY_PARAM[params.get('range') ?? ''] ?? defaultRange;

  const setTab = (next: CoinTab) => {
    setParams(current => {
      const updated = new URLSearchParams(current);
      if (next === 'overview') {
        updated.delete('tab');
      } else {
        updated.set('tab', next);
      }
      return updated;
    });
  };

  // Replace rather than push, so the back button moves between tabs and pages, not range clicks
  const setRange = (next: TimeRange) => {
    setParams(
      current => {
        const updated = new URLSearchParams(current);
        updated.set('range', PARAM_BY_RANGE[next]);
        return updated;
      },
      { replace: true }
    );
  };

  return { tab, setTab, range, setRange };
}
