import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { useQuery } from '@apollo/client';
import Methodology from './Methodology';
import { track } from '../services/analytics';

vi.mock('../services/analytics', () => ({ track: vi.fn() }));
vi.mock('@apollo/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@apollo/client')>()),
  useQuery: vi.fn(),
}));

const bitcoin = {
  coinId: 'bitcoin',
  asOf: '2026-10-26',
  realizedVolatility: [
    { windowDays: 7, annualizedVolatility: 30.6 },
    { windowDays: 30, annualizedVolatility: 24.9 },
    { windowDays: 90, annualizedVolatility: 38.2 },
  ],
  ewmaVolatility: 30.6,
  volatilityForecast: null,
  garch: {
    alpha: 0.1874,
    beta: 0.6377,
    persistence: 0.8251,
    halfLifeDays: 3.6,
    logLikelihood: 879.0,
    aic: -1750.1,
    ljungBoxResiduals: { pValue: 0.696 },
    ljungBoxSquaredResiduals: { pValue: 0.401 },
    standardizedExcessKurtosis: 2.6,
  },
  valueAtRisk: {
    levels: [
      {
        confidence: 0.95,
        methods: [
          {
            method: 'filteredHistorical',
            valueAtRisk: 0.0273,
            expectedShortfall: 0.0336,
            backtest: { exceptions: 8, days: 187, kupiecPValue: 0.73, conditionalCoveragePValue: 0.41 },
          },
        ],
      },
    ],
  },
  performance: null,
};

function renderPage(path = '/methodology') {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[path]}>
        <Methodology />
      </MemoryRouter>
    </HelmetProvider>
  );
}

describe('Methodology', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useQuery).mockReturnValue({ data: { riskSummary: bitcoin } } as never);
  });

  it('has a section for every model, with rendered formulas and source links', () => {
    const { container } = renderPage();

    for (const heading of [
      'Data and conventions',
      'Realized volatility',
      'HAR-RV forecast',
      'GARCH(1,1) and diagnostics',
      'Value at Risk and expected shortfall',
      'VaR backtesting',
      'Return, drawdown and beta',
      'How the models are validated',
      'References',
    ]) {
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
    }
    expect(container.querySelectorAll('.katex').length).toBeGreaterThan(20);
    expect(screen.getByRole('link', { name: 'garch.ts' })).toHaveAttribute(
      'href',
      'https://github.com/sshikora/crypto-analytics/blob/master/backend/src/models/garch.ts'
    );
  });

  it("shows today's Bitcoin numbers next to the formulas", () => {
    renderPage();

    expect(vi.mocked(useQuery).mock.calls[0][1]).toEqual({ variables: { coinId: 'bitcoin' } });
    expect(screen.getAllByText('Live on Bitcoin, daily closes up to 2026-10-26').length).toBeGreaterThan(0);
    expect(screen.getByText(/half-life 3\.6 days/)).toBeInTheDocument();
    expect(screen.getByText('GARCH-filtered')).toBeInTheDocument();
    expect(screen.getByText('8 / 187')).toBeInTheDocument();
  });

  it('records the section a visitor arrived at and scrolls to it', () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    renderPage('/methodology#garch');

    expect(track).toHaveBeenCalledWith('view_methodology', { section: 'garch' });
    expect(scrollIntoView).toHaveBeenCalled();
  });

  it('scrolls to the section again once the live numbers have loaded above it', () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    vi.mocked(useQuery).mockReturnValue({ data: undefined } as never);

    const { rerender } = renderPage('/methodology#backtesting');
    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    vi.mocked(useQuery).mockReturnValue({ data: { riskSummary: bitcoin } } as never);
    rerender(
      <HelmetProvider>
        <MemoryRouter initialEntries={['/methodology#backtesting']}>
          <Methodology />
        </MemoryRouter>
      </HelmetProvider>
    );

    expect(scrollIntoView).toHaveBeenCalledTimes(2);
    expect(track).toHaveBeenCalledTimes(1);
  });

  it('still explains every model before the live numbers load', () => {
    vi.mocked(useQuery).mockReturnValue({ data: undefined } as never);
    renderPage();
    expect(screen.getByRole('heading', { name: 'GARCH(1,1) and diagnostics' })).toBeInTheDocument();
    expect(screen.queryByText(/Live on Bitcoin/)).not.toBeInTheDocument();
  });
});
