import { posthog } from './posthog';
import type { CoinTab } from '../hooks/useCoinPageParams';

interface AnalyticsEvents {
  view_coin: { symbol: string; tab: CoinTab };
  view_model: { model: string; metric: string };
  create_alert: { coinSymbol: string; ruleType: string; emailEnabled: boolean };
  signup: Record<string, never>;
  view_methodology: { section: string };
}

export function track<E extends keyof AnalyticsEvents>(event: E, properties: AnalyticsEvents[E]): void {
  // posthog is a module singleton that is only initialised when an API key is configured
  if (posthog.__loaded) {
    posthog.capture(event, properties);
  }
}
