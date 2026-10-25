import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { GarchPanel } from './GarchPanel';
import { GarchSummary } from '../types/crypto';

vi.mock('../services/analytics', () => ({ track: vi.fn() }));

const btc: GarchSummary = {
  omega: 3.1e-5,
  alpha: 0.187,
  beta: 0.637,
  persistence: 0.824,
  logLikelihood: 874.69,
  aic: -1741.38,
  bic: -1725.81,
  observations: 362,
  halfLifeDays: 3.63,
  currentVolatility: 39.04,
  longRunVolatility: 44.4,
  conditionalVolatility: [
    { date: '2026-10-24', annualizedVolatility: 40.1 },
    { date: '2026-10-25', annualizedVolatility: 39.04 },
  ],
  forecast: [
    { days: 1, annualizedVolatility: 36.4 },
    { days: 7, annualizedVolatility: 39.7 },
    { days: 30, annualizedVolatility: 43.0 },
  ],
  ljungBoxResiduals: { statistic: 8.08, pValue: 0.679 },
  ljungBoxSquaredResiduals: { statistic: 10.85, pValue: 0.378 },
  standardizedExcessKurtosis: 2.61,
  normalQq: [
    { theoretical: -2.5, sample: -4.1 },
    { theoretical: 0, sample: 0.02 },
    { theoretical: 2.5, sample: 3.2 },
  ],
};

function renderPanel(garch: GarchSummary = btc) {
  return render(
    <MemoryRouter>
      <GarchPanel garch={garch} asOf="2026-10-25" closes={366} />
    </MemoryRouter>
  );
}

describe('GarchPanel', () => {
  it('shows the fitted model, its volatilities and forecasts', () => {
    renderPanel();

    expect(screen.getByText(/From daily closes up to Oct 25, 2026 — α=0\.1870, β=\s*0\.6370, ω=3\.10e-5/)).toBeInTheDocument();
    expect(screen.getByText('39.0%')).toBeInTheDocument();
    expect(screen.getByText('44.4%')).toBeInTheDocument();
    expect(screen.getByText('0.8240')).toBeInTheDocument();
    expect(screen.getByText('3.6 days')).toBeInTheDocument();
    expect(screen.getByText('Forecast: Next 30 Days')).toBeInTheDocument();
    expect(screen.getByText('43.0%')).toBeInTheDocument();
  });

  it('reports the fit statistics and passing diagnostics', () => {
    renderPanel();

    expect(screen.getByText(/Log-likelihood 874\.7 · AIC -1741\.4 · BIC -1725\.8 on\s+362 days \(4 parameters\)/)).toBeInTheDocument();
    expect(screen.getByText('p = 0.679')).toBeInTheDocument();
    expect(screen.getAllByText('Passes')).toHaveLength(2);
    expect(screen.getByText('The model has absorbed the volatility clustering.')).toBeInTheDocument();
    expect(screen.getByText('2.61')).toBeInTheDocument();
  });

  it('explains failing diagnostics without calling the model broken', () => {
    renderPanel({
      ...btc,
      ljungBoxResiduals: { statistic: 30, pValue: 0.0004 },
      ljungBoxSquaredResiduals: { statistic: 25, pValue: 0.01 },
    });

    expect(screen.getByText('p = < 0.001')).toBeInTheDocument();
    expect(screen.getByText('Autocorrelation remains')).toBeInTheDocument();
    expect(screen.getByText(/GARCH models volatility, not the direction of returns/)).toBeInTheDocument();
    expect(screen.getByText('Clustering remains')).toBeInTheDocument();
  });

  it('describes very long and very short half-lives in words people can use', () => {
    const { unmount } = renderPanel({ ...btc, halfLifeDays: 12329.7 });
    expect(screen.getByText('Over a year')).toBeInTheDocument();
    unmount();

    renderPanel({ ...btc, halfLifeDays: 41.6 });
    expect(screen.getByText('42 days')).toBeInTheDocument();
  });

  it('names the data and validation in the model details', () => {
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'About Half-Life' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('366 daily closes (00:00 UTC, from CoinGecko) up to 2026-10-25.');
    expect(screen.getByRole('dialog')).toHaveTextContent('Ljung-Box matches statsmodels');
  });
});
