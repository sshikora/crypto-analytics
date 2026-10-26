import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PerformancePanel } from './PerformancePanel';
import { PerformanceSummary } from '../types/crypto';

vi.mock('../services/analytics', () => ({ track: vi.fn() }));

const eth: PerformanceSummary = {
  annualizedReturn: -0.3589,
  sharpeRatio: -0.423,
  sortinoRatio: -0.609,
  calmarRatio: -0.576,
  drawdown: {
    maxDrawdown: -0.6234,
    peakDate: '2025-10-27',
    troughDate: '2026-06-26',
    recoveryDate: null,
    currentDrawdown: -0.4117,
    longestDrawdownDays: 359,
  },
  worstDays: [
    { date: '2026-02-06', return: -0.1491 },
    { date: '2026-06-06', return: -0.1055 },
  ],
  worstWeek: { startDate: '2026-01-30', endDate: '2026-02-06', return: -0.3539 },
  betaToBitcoin: [
    { windowDays: 365, observations: 363, beta: 1.2629, correlation: 0.9054 },
    { windowDays: 90, observations: 90, beta: 1.2416, correlation: 0.8806 },
  ],
};

function renderPanel(performance = eth, coinId = 'ethereum') {
  return render(
    <MemoryRouter>
      <PerformancePanel performance={performance} coinId={coinId} asOf="2026-10-21" closes={364} />
    </MemoryRouter>
  );
}

describe('PerformancePanel', () => {
  it('shows the return and risk-adjusted ratios', () => {
    renderPanel();
    expect(screen.getByText('-35.9%')).toBeInTheDocument();
    expect(screen.getByText('-0.42')).toBeInTheDocument();
    expect(screen.getByText('-0.61')).toBeInTheDocument();
    expect(screen.getByText('-0.58')).toBeInTheDocument();
  });

  it('dates the maximum drawdown and says whether it recovered', () => {
    renderPanel();
    expect(screen.getByText('-62.3%')).toBeInTheDocument();
    expect(screen.getByText('From Oct 27, 2025 to Jun 26, 2026. Not recovered yet.')).toBeInTheDocument();
    expect(screen.getByText('359 days')).toBeInTheDocument();

    renderPanel({ ...eth, drawdown: { ...eth.drawdown, recoveryDate: '2026-09-01' } });
    expect(screen.getByText(/Recovered on Sep 1, 2026\./)).toBeInTheDocument();
  });

  it('shows beta to Bitcoin for other coins but not for Bitcoin itself', () => {
    const { unmount } = renderPanel();
    expect(screen.getByText('Beta to Bitcoin (1 year)')).toBeInTheDocument();
    expect(screen.getByText('1.26')).toBeInTheDocument();
    expect(screen.getByText(/Correlation 0\.91 over 363 days/)).toBeInTheDocument();
    expect(screen.getByText('Beta to Bitcoin (90 days)')).toBeInTheDocument();
    unmount();

    renderPanel(eth, 'bitcoin');
    expect(screen.queryByText(/Beta to Bitcoin/)).not.toBeInTheDocument();
  });

  it('lists the worst days and the worst week', () => {
    renderPanel();
    expect(screen.getByText('Feb 6, 2026')).toBeInTheDocument();
    expect(screen.getByText('-14.91%')).toBeInTheDocument();
    expect(screen.getByText(/Worst 7 days: -35\.4% from Jan 30, 2026 to\s+Feb 6, 2026/)).toBeInTheDocument();
  });

  it('says when a ratio is not defined', () => {
    renderPanel({ ...eth, sortinoRatio: null, calmarRatio: null });
    expect(screen.getAllByText('Not defined')).toHaveLength(2);
  });

  it('states the risk-free rate in the ratio details', () => {
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'About Sharpe Ratio' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Risk-free rate taken as 0');
  });
});
