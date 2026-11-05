import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ScenarioPanel } from './ScenarioPanel';
import { track } from '../services/analytics';
import { Scenario, ScenarioHorizon, ScenarioModelName } from '../types/crypto';

vi.mock('../services/analytics', () => ({ track: vi.fn() }));

// Each model's risk grows with the horizon; the GARCH bootstrap's 30-day 95% VaR is 15%
function horizon(days: number, scale: number): ScenarioHorizon {
  const width = scale * Math.sqrt(days / 30);
  return {
    days,
    mean: 0.001,
    standardError: 0.001,
    tailRisk: [
      { confidence: 0.95, valueAtRisk: 0.15 * width, expectedShortfall: 0.19 * width },
      { confidence: 0.99, valueAtRisk: 0.22 * width, expectedShortfall: 0.25 * width },
    ],
    drawdownProbabilities: [
      { threshold: 0.1, probability: Math.min(1, 0.4 * width) },
      { threshold: 0.2, probability: 0.03 * width },
      { threshold: 0.3, probability: 0.001 },
      { threshold: 0.5, probability: 0 },
    ],
    distribution: [
      { lower: -0.3, upper: -0.1, probability: 0.2 },
      { lower: -0.1, upper: 0.1, probability: 0.6 },
      { lower: 0.1, upper: 0.3, probability: 0.2 },
    ],
  };
}

function model(name: ScenarioModelName, scale: number, volatility: number | null) {
  return {
    model: name,
    startingVolatility: volatility,
    fan: Array.from({ length: 90 }, (_, i) => {
      const spread = 0.02 * scale * Math.sqrt(i + 1);
      return { day: i + 1, quantiles: [1 - 1.6 * spread, 1 - 0.7 * spread, 1, 1 + 0.7 * spread, 1 + 1.6 * spread] };
    }),
    horizons: [7, 30, 90].map(d => horizon(d, scale)),
  };
}

const btc: Scenario = {
  coinId: 'bitcoin',
  asOf: '2026-11-05',
  startPrice: 98000,
  observations: 180,
  paths: 10000,
  quantiles: [0.05, 0.25, 0.5, 0.75, 0.95],
  models: [model('garchBootstrap', 1, 0.314), model('studentT', 1.1, null), model('normal', 1.05, 0.364)],
};

function renderPanel() {
  return render(
    <MemoryRouter>
      <ScenarioPanel scenario={btc} />
    </MemoryRouter>
  );
}

describe('ScenarioPanel', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(track).mockClear();
  });

  it('shows 30-day risk from the GARCH bootstrap on $10,000 by default', () => {
    renderPanel();

    expect(screen.getByRole('heading', { name: 'Scenario: Monte Carlo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '30 days' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'GARCH bootstrap' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('VaR 95%, 30 days')).toBeInTheDocument();
    expect(screen.getAllByText('$1,500').length).toBeGreaterThan(0);
    expect(screen.getByText('Lost or worse in 1 path in 20. Average beyond it: $1,900.')).toBeInTheDocument();
    expect(screen.getByText('Chance of a 20% Drawdown')).toBeInTheDocument();
  });

  it('scales every amount with the position size and remembers it', () => {
    renderPanel();
    fireEvent.change(screen.getByLabelText('Position size (USD)'), { target: { value: '1000' } });

    expect(screen.getAllByText('$150').length).toBeGreaterThan(0);
    expect(localStorage.getItem('cql.positionUsd')).toBe('1000');
  });

  it('switches horizon and model, and records each run', () => {
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: '7 days' }));
    expect(screen.getByText('VaR 95%, 7 days')).toBeInTheDocument();
    expect(track).toHaveBeenLastCalledWith('run_scenario', { coinId: 'bitcoin', model: 'garchBootstrap', days: 7 });

    fireEvent.click(screen.getByRole('button', { name: 'Student-t' }));
    expect(screen.getByRole('button', { name: 'Student-t' })).toHaveAttribute('aria-pressed', 'true');
    expect(track).toHaveBeenLastCalledWith('run_scenario', { coinId: 'bitcoin', model: 'studentT', days: 7 });
  });

  it('compares the three models, with a dash where the Student-t fit has no variance', () => {
    renderPanel();
    const rows = screen.getAllByRole('row');
    expect(rows.map(r => r.cells[0].textContent)).toEqual(['Model', 'GARCH bootstrap', 'Student-t', 'Normal']);
    expect(rows[1].cells[1].textContent).toBe('31%');
    expect(rows[2].cells[1].textContent).toBe('—');
    expect(rows[1].cells[7].textContent).toBe('< 1%');
  });

  it('says the paths have no trend', () => {
    renderPanel();
    expect(screen.getByText(/this is a measure of risk, not a forecast of direction/)).toBeInTheDocument();
  });
});
