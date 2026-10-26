import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describeRegime, RegimeBadge } from './RegimeBadge';
import { Regime } from '../types/crypto';

const up: Regime = { trend: 'up', movingAverage: 70000, priceToMovingAverage: 1.142, volatilityPercentile: 0.04, volatilityLevel: 'low' };

function renderBadge(regime: Regime, compact = false) {
  return render(
    <MemoryRouter>
      <RegimeBadge regime={regime} compact={compact} />
    </MemoryRouter>
  );
}

describe('RegimeBadge', () => {
  it('describes trend and volatility in words, linking to the method', () => {
    renderBadge(up);
    const badge = screen.getByRole('link', { name: '↑ Uptrend · low volatility' });
    expect(badge).toHaveAttribute('href', '/methodology#regime');
    expect(badge).toHaveAttribute(
      'title',
      'Price is 14.2% above its 200-day average. 30-day volatility is at least as high as on 4% of days in the past year.'
    );
    expect(badge.className).toContain('bg-sky-50');
  });

  it('uses the high-risk colour only for high volatility', () => {
    renderBadge({ ...up, trend: 'down', priceToMovingAverage: 0.8, volatilityPercentile: 0.9, volatilityLevel: 'high' });
    const badge = screen.getByRole('link', { name: '↓ Downtrend · high volatility' });
    expect(badge.className).toContain('bg-red-50');
    expect(badge).toHaveAttribute('title', expect.stringContaining('20.0% below'));
  });

  it('has a compact form for tables', () => {
    renderBadge({ ...up, volatilityLevel: 'normal' }, true);
    expect(screen.getByText('↑ normal').className).toContain('bg-amber-50');
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('never uses buy or sell wording', () => {
    for (const trend of ['up', 'down'] as const) {
      for (const level of ['low', 'normal', 'high'] as const) {
        expect(describeRegime({ ...up, trend, volatilityLevel: level })).not.toMatch(/buy|sell/i);
      }
    }
  });
});
