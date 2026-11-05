import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SignalsPanel } from './SignalsPanel';
import { SignalSummary } from '../types/crypto';

vi.mock('../services/analytics', () => ({ track: vi.fn() }));

const variant = (short: number, long: number, position: number, since: string | null, sharpe: number) => ({
  short,
  long,
  position,
  since,
  sharpe,
  totalReturn: sharpe / 5,
  trades: 9,
  timeInMarket: 0.5,
});

// Bitcoin's walk-forward to 2026-10-21: six small losing trades and one open trade up 28%
const btc: SignalSummary = {
  coinId: 'bitcoin',
  asOf: '2026-10-21',
  cost: 0.0015,
  evaluatedFrom: '2026-01-30',
  observations: 264,
  variants: [
    variant(1, 20, 0, '2026-10-08', 1.08),
    variant(1, 50, 1, '2026-08-18', 0.91),
    variant(1, 100, 1, null, 0.4),
    variant(20, 100, 1, '2026-09-02', 0.2),
  ],
  impliedTrials: 5.14,
  best: { short: 1, long: 20, sharpe: 1.08, probabilisticSharpe: 0.83, deflatedSharpe: 0.64 },
  holding: { sharpe: 0.17, totalReturn: -0.02, maxDrawdown: -0.31 },
  walkForward: {
    from: '2026-05-30',
    days: 144,
    strategy: { sharpe: 1.29, totalReturn: 0.153, maxDrawdown: -0.102 },
    holding: { sharpe: 0.97, totalReturn: 0.127, maxDrawdown: -0.207 },
    timeInMarket: 0.62,
    trades: 7,
    closedTrades: 6,
    winRate: 0,
    openTrade: { since: '2026-08-19', return: 0.284 },
    folds: [
      { from: '2026-05-30', short: 1, long: 20 },
      { from: '2026-06-29', short: 10, long: 30 },
    ],
    equity: [
      { date: '2026-05-30', strategy: 1, holding: 1 },
      { date: '2026-10-21', strategy: 1.153, holding: 1.127 },
    ],
  },
  timingPValue: 0.184,
  shuffles: 200,
};

function renderPanel(signals: SignalSummary) {
  return render(
    <MemoryRouter>
      <SignalsPanel signals={signals} />
    </MemoryRouter>
  );
}

describe('SignalsPanel', () => {
  it('shows where the price stands against its averages now', () => {
    renderPanel(btc);
    expect(screen.getByText('Price vs 20-day average')).toBeInTheDocument();
    expect(screen.getByText('Since Oct 8, 2026')).toBeInTheDocument();
    expect(screen.getByText('All of the last year')).toBeInTheDocument();
    expect(screen.getAllByText('Above').length).toBeGreaterThan(0);
  });

  it('leads with out-of-sample results next to holding', () => {
    renderPanel(btc);
    expect(screen.getByText('1.29')).toBeInTheDocument();
    expect(screen.getByText('Holding: 0.97')).toBeInTheDocument();
    expect(screen.getByText('+15.3%')).toBeInTheDocument();
    expect(screen.getByText('Holding: +12.7%')).toBeInTheDocument();
  });

  it('reports the trade still open next to the win rate', () => {
    renderPanel(btc);
    expect(screen.getByText('0% won')).toBeInTheDocument();
    expect(screen.getByText('6 closed; one open since Aug 19, 2026, +28.4%.')).toBeInTheDocument();
  });

  it('says when the timing test finds nothing, and when it does', () => {
    const { unmount } = renderPanel(btc);
    expect(screen.getByText('p = 0.18')).toBeInTheDocument();
    expect(screen.getByText(/^No evidence of timing beyond chance\./)).toBeInTheDocument();
    unmount();

    renderPanel({ ...btc, timingPValue: 0.01 });
    expect(screen.getByText(/^Better than chance at the 5% level\./)).toBeInTheDocument();
  });

  it('explains the deflated Sharpe ratio with the number of crossovers tried', () => {
    renderPanel(btc);
    expect(screen.getByText('64%')).toBeInTheDocument();
    expect(screen.getByText(/allowing for 4 crossovers tried \(about 5\.1 independent ones\)/)).toBeInTheDocument();
  });

  it('lists every crossover', () => {
    renderPanel(btc);
    const rows = screen.getAllByRole('row');
    expect(rows.map(r => r.cells[0].textContent)).toEqual(['Crossover', 'price / 20d', 'price / 50d', 'price / 100d', '20d / 100d']);
  });

  it('never says buy or sell', () => {
    const { container } = renderPanel(btc);
    expect(container.textContent).not.toMatch(/\b(buy|sell|bullish|bearish)\b/i);
  });
});
