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
