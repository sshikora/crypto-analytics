import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RegimeModelPanel } from './RegimeModelPanel';
import { RegimeModel } from '../types/crypto';

vi.mock('../services/analytics', () => ({ track: vi.fn() }));

const btc: RegimeModel = {
  coinId: 'bitcoin',
  asOf: '2026-11-01',
  observations: 365,
  logLikelihood: 895.48,
  aic: -1776.97,
  bic: -1749.67,
  oneStateBic: -1707.3,
  supported: true,
  states: [
    { name: 'calm', dailyMean: -0.0009, annualizedVolatility: 0.3018, stayProbability: 0.9237, expectedDays: 13.11, longRunShare: 0.8254 },
    { name: 'turbulent', dailyMean: -0.0011, annualizedVolatility: 0.8214, stayProbability: 0.6395, expectedDays: 2.77, longRunShare: 0.1746 },
  ],
  turbulentProbability: 0.0741,
  nextDayTurbulentProbability: 0.118,
  history: { dates: ['2026-10-31', '2026-11-01'], filtered: [0.11, 0.0741], smoothed: [0.09, 0.0741] },
};

function renderPanel(model: RegimeModel) {
  return render(
    <MemoryRouter>
      <RegimeModelPanel model={model} />
    </MemoryRouter>
  );
}

describe('RegimeModelPanel', () => {
  it("shows today's state probabilities and what each state looks like", () => {
    renderPanel(btc);

    expect(screen.getByRole('heading', { name: 'Regime Model: Hidden Markov' })).toBeInTheDocument();
    expect(screen.getByText('7%')).toBeInTheDocument();
    expect(screen.getByText('12%')).toBeInTheDocument();
    expect(screen.getByText('30% vol')).toBeInTheDocument();
    expect(screen.getByText('82% vol')).toBeInTheDocument();
    expect(screen.getByText('Lasts about 13 days once entered. About 83% of days in the long run.')).toBeInTheDocument();
    expect(screen.getByText('Lasts about 2.8 days once entered. About 17% of days in the long run.')).toBeInTheDocument();
  });

  it('says which line in the chart could not have been known at the time', () => {
    renderPanel(btc);
    expect(screen.getByText(/could not have been known at the time/)).toBeInTheDocument();
  });

  it('shows the fit statistics, including the one-state comparison', () => {
    renderPanel(btc);
    expect(screen.getByText(/BIC -1749\.7 on 365 days \(7 parameters\) · one-state BIC -1707\.3/)).toBeInTheDocument();
  });

  it('shows no state when the data does not support two', () => {
    renderPanel({ ...btc, supported: false, bic: -1700, oneStateBic: -1707.3 });

    expect(screen.getByText(/No evidence of two regimes here/)).toBeInTheDocument();
    expect(screen.queryByText('Turbulent Now')).not.toBeInTheDocument();
    expect(screen.queryByText('7%')).not.toBeInTheDocument();
    expect(screen.getByText(/one-state BIC -1707\.3/)).toBeInTheDocument();
  });
});
