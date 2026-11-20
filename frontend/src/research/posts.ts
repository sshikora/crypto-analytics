import { ComponentType, lazy, LazyExoticComponent } from 'react';

export interface ResearchPost {
  slug: string;
  title: string;
  date: string;
  summary: string;
  // Posts load KaTeX and charts, so each body loads only with its own page
  Body: LazyExoticComponent<ComponentType>;
}

export const POSTS: ResearchPost[] = [
  {
    slug: 'value-at-risk-backtest',
    title: 'Does Crypto Value at Risk Hold Up Out of Sample?',
    date: '2026-11-20',
    summary:
      'One-day VaR on Bitcoin and 10-day Monte Carlo VaR on 83 coins, backtested out of sample. Every model overstated the risk, and 1,467 forecasts held only about 18 independent periods.',
    Body: lazy(() => import('./ValueAtRiskBacktest')),
  },
  {
    slug: 'moving-average-crossovers',
    title: 'Do Moving-Average Crossovers Time Crypto?',
    date: '2026-11-12',
    summary:
      '15 crossovers on 70 coins, tested with costs, walk-forward selection, the deflated Sharpe ratio and a shuffle test. One coin in 70 beat chance at the 5% level.',
    Body: lazy(() => import('./MovingAverageCrossovers')),
  },
];

export function findPost(slug: string | undefined): ResearchPost | undefined {
  return POSTS.find(p => p.slug === slug);
}
