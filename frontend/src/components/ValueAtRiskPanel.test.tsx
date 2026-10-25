import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ValueAtRiskPanel } from './ValueAtRiskPanel';
import { ValueAtRiskSummary, VarMethodResult } from '../types/crypto';

vi.mock('../services/analytics', () => ({ track: vi.fn() }));

function method(
  name: VarMethodResult['method'],
  valueAtRisk: number,
  expectedShortfall: number,
  exceptions: number,
  passes: boolean
): VarMethodResult {
  return {
    method: name,
    valueAtRisk,
    expectedShortfall,
    backtest: {
      days: 187,
      exceptions,
      expectedExceptions: name === 'historical' ? 9.35 : 9.35,
      kupiecPValue: passes ? 0.2 : 0.016,
      christoffersenPValue: 0.7,
      conditionalCoveragePValue: passes ? 0.4 : 0.04,
      passes,
    },
  };
}

const summary: ValueAtRiskSummary = {
  windowDays: 180,
  studentTDegreesOfFreedom: 3.23,
  levels: [
    {
      confidence: 0.95,
      methods: [
        method('historical', 0.0267, 0.037, 6, true),
        method('normal', 0.0313, 0.0393, 4, false),
        method('studentT', 0.0296, 0.0471, 5, true),
        method('filteredHistorical', 0.0273, 0.0336, 8, true),
      ],
    },
    {
      confidence: 0.99,
      methods: [
        { ...method('historical', 0.0411, 0.0545, 1, true), backtest: { ...method('historical', 0, 0, 1, true).backtest, expectedExceptions: 1.87 } },
        { ...method('normal', 0.0444, 0.0509, 1, true), backtest: { ...method('normal', 0, 0, 1, true).backtest, expectedExceptions: 1.87 } },
        { ...method('studentT', 0.0552, 0.0824, 0, true), backtest: { ...method('studentT', 0, 0, 0, true).backtest, expectedExceptions: 1.87 } },
      ],
    },
  ],
};

function renderPanel(valueAtRisk = summary) {
  return render(
    <MemoryRouter>
      <ValueAtRiskPanel valueAtRisk={valueAtRisk} dataWindow="366 daily closes up to 2026-10-25." />
    </MemoryRouter>
  );
}

function card(label: RegExp) {
  return screen.getByText(label).closest('div.relative') as HTMLElement;
}

describe('ValueAtRiskPanel', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows VaR and expected shortfall in dollars for the default $10,000 position', () => {
    renderPanel();

    expect(within(card(/^Historical$/)).getByText('$267')).toBeInTheDocument();
    expect(within(card(/^Historical$/)).getByText('Expected shortfall $370')).toBeInTheDocument();
    expect(within(card(/^Student-t \(3\.2 degrees of freedom\)$/)).getByText('$296')).toBeInTheDocument();
    expect(screen.getByText(/1 day in 20/)).toBeInTheDocument();
  });

  it('includes the GARCH-filtered method and explains it', () => {
    renderPanel();

    expect(within(card(/^GARCH-filtered$/)).getByText('$273')).toBeInTheDocument();
    expect(within(card(/^GARCH-filtered$/)).getByText('Expected shortfall $336')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'About GARCH-filtered' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Filtered historical simulation with GARCH(1,1)');
  });

  it('shows each backtest result', () => {
    renderPanel();

    expect(within(card(/^Normal$/)).getByText('Backtest fails')).toBeInTheDocument();
    expect(within(card(/^Normal$/)).getByText('4 of 187 days beyond VaR (9.3 expected)')).toBeInTheDocument();
    expect(within(card(/^Historical$/)).getByText('Backtest passes')).toBeInTheDocument();
  });

  it('rescales to the position size and remembers it', () => {
    renderPanel();
    fireEvent.change(screen.getByLabelText('Position size (USD)'), { target: { value: '2500' } });

    expect(within(card(/^Historical$/)).getByText('$66.75')).toBeInTheDocument();
    expect(localStorage.getItem('cql.positionUsd')).toBe('2500');
  });

  it('starts from a remembered position size', () => {
    localStorage.setItem('cql.positionUsd', '1000');
    renderPanel();
    expect(within(card(/^Historical$/)).getByText('$26.70')).toBeInTheDocument();
  });

  it('ignores amounts that are not positive', () => {
    renderPanel();
    fireEvent.change(screen.getByLabelText('Position size (USD)'), { target: { value: '-5' } });
    expect(within(card(/^Historical$/)).getByText('$267')).toBeInTheDocument();
  });

  it('switches confidence level and notes the weak 99% backtest', () => {
    renderPanel();
    expect(screen.queryByText(/backtest can only catch large errors/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '99%' }));

    expect(screen.getByRole('button', { name: '99%' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(card(/^Student-t/)).getByText('$552')).toBeInTheDocument();
    expect(screen.getByText(/1 day in 100/)).toBeInTheDocument();
    expect(screen.getByText(/fewer than 2 exceptions are expected/)).toBeInTheDocument();
  });

  it('says there is no loss when a tail return is not negative', () => {
    renderPanel({
      ...summary,
      levels: [{ confidence: 0.95, methods: [method('historical', 0, 0.001, 0, true)] }],
    });
    expect(screen.getByText('No loss')).toBeInTheDocument();
  });

  it('puts the backtest statistics in the method details', () => {
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'About Normal' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Kupiec p = 0.016, Christoffersen p = 0.700, conditional coverage p = 0.040');
  });
});
