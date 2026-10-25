import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RiskSummaryPanel } from './RiskSummaryPanel';
import { RiskSummary } from '../types/crypto';

vi.mock('../services/analytics', () => ({ track: vi.fn() }));

const btc: RiskSummary = {
  coinId: 'bitcoin',
  asOf: '2026-10-21',
  observations: 364,
  missingDays: 0,
  realizedVolatility: [
    { windowDays: 7, annualizedVolatility: 20.2 },
    { windowDays: 30, annualizedVolatility: 32.36 },
    { windowDays: 90, annualizedVolatility: 37.87 },
  ],
  ewmaVolatility: 29.64,
  returnDistribution: { skewness: -0.245, excessKurtosis: 6.807 },
  volatilityForecast: {
    model: 'HAR-RV',
    coefficients: { intercept: 0.00031, daily: 0.3448, weekly: 0.0578, monthly: 0.0069 },
    rSquared: 0.1291,
    observations: 333,
    horizons: [
      { days: 1, annualizedVolatility: 37.03 },
      { days: 7, annualizedVolatility: 41.44 },
      { days: 30, annualizedVolatility: 43.16 },
    ],
  },
};

function renderPanel(summary: RiskSummary) {
  return render(
    <MemoryRouter>
      <RiskSummaryPanel summary={summary} />
    </MemoryRouter>
  );
}

describe('RiskSummaryPanel', () => {
  it('shows each volatility window, EWMA and the return distribution', () => {
    renderPanel(btc);

    expect(screen.getByText('From daily closes up to Oct 21, 2026')).toBeInTheDocument();
    expect(screen.getByText('20.2%')).toBeInTheDocument();
    expect(screen.getByText('32.4%')).toBeInTheDocument();
    expect(screen.getByText('37.9%')).toBeInTheDocument();
    expect(screen.getByText('29.6%')).toBeInTheDocument();
    expect(screen.getByText('-0.24')).toBeInTheDocument();
    expect(screen.getByText('6.81')).toBeInTheDocument();
    expect(screen.getByText(/large falls have been more common/)).toBeInTheDocument();
    expect(screen.queryByText(/missing from the stored history/)).not.toBeInTheDocument();
  });

  it('shows the HAR-RV forecast for each horizon with its coefficients', () => {
    renderPanel(btc);

    expect(screen.getByText('Volatility Forecast (HAR-RV)')).toBeInTheDocument();
    expect(screen.getByText(/Daily 0\.345 · weekly 0\.058 ·\s+monthly 0\.007 · R² 0\.13 on 333 days/)).toBeInTheDocument();
    expect(screen.getByText('37.0%')).toBeInTheDocument();
    expect(screen.getByText('41.4%')).toBeInTheDocument();
    expect(screen.getByText('43.2%')).toBeInTheDocument();
    expect(screen.getByText('Next 30 Days')).toBeInTheDocument();
  });

  it('leaves out the forecast when there is none', () => {
    renderPanel({ ...btc, volatilityForecast: null });
    expect(screen.queryByText('Volatility Forecast (HAR-RV)')).not.toBeInTheDocument();
  });

  it('names the data behind each number in its details', () => {
    renderPanel(btc);
    fireEvent.click(screen.getByRole('button', { name: 'About 30-Day Volatility' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('364 daily closes (00:00 UTC, from CoinGecko) up to 2026-10-21.');
  });

  it('flags days missing from the stored history', () => {
    renderPanel({ ...btc, missingDays: 2 });
    expect(screen.getByText(/2 days are missing from the stored history/)).toBeInTheDocument();
  });

  it('marks windows longer than the history', () => {
    renderPanel({
      ...btc,
      observations: 12,
      realizedVolatility: [
        { windowDays: 7, annualizedVolatility: 55 },
        { windowDays: 30, annualizedVolatility: null },
        { windowDays: 90, annualizedVolatility: null },
      ],
    });
    expect(screen.getAllByText('Not enough data')).toHaveLength(2);
  });

  it('explains when a coin has no stored history yet', () => {
    renderPanel({ ...btc, asOf: null, observations: 0, returnDistribution: null, volatilityForecast: null });
    expect(screen.getByText(/need at least a week of stored prices/)).toBeInTheDocument();
    expect(screen.queryByText('Realized Risk')).not.toBeInTheDocument();
  });
});
