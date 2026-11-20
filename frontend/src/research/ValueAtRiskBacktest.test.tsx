import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import ValueAtRiskBacktest from './ValueAtRiskBacktest';
import { VAR_STUDY, VAR_STUDY_PERIODS } from './varStudy';

vi.mock('@apollo/client', async importOriginal => ({
  ...(await importOriginal<typeof import('@apollo/client')>()),
  useQuery: vi.fn(),
}));

function readCsv(name: string) {
  const lines = readFileSync(join(__dirname, '..', '..', '..', 'validation', 'data', name), 'utf8').trim().split('\n');
  const header = lines[0].split(',');
  return lines.slice(1).map(line => Object.fromEntries(line.split(',').map((v, i) => [header[i], v])));
}

const STEMS = { normal: 'gbm', studentT: 'student_t', garchBootstrap: 'garch_bootstrap' } as const;

const riskSummary = {
  asOf: '2026-11-19',
  valueAtRisk: {
    levels: [
      {
        confidence: 0.95,
        methods: [
          { method: 'normal', backtest: { days: 211, exceptions: 4, expectedExceptions: 10.55, kupiecPValue: 0.01 } },
          { method: 'filteredHistorical', backtest: { days: 211, exceptions: 9, expectedExceptions: 10.55, kupiecPValue: 0.6214 } },
        ],
      },
    ],
  },
};

function renderPost(summary: object | null = null) {
  vi.mocked(useQuery).mockReturnValue({ data: summary ? { riskSummary: summary } : undefined } as ReturnType<typeof useQuery>);
  return render(
    <MemoryRouter>
      <ValueAtRiskBacktest />
    </MemoryRouter>
  );
}

describe('VaR study data', () => {
  it('matches every coin in the Monte Carlo cross-section', () => {
    const coins = readCsv('monte_carlo_cross_section.csv').filter(r => Number(r.daily_volatility) >= 0.005);
    expect(VAR_STUDY.map(c => c.coin)).toEqual(coins.map(r => r.coin));
    VAR_STUDY.forEach((coin, i) => {
      const row = coins[i];
      expect(coin.forecasts).toBe(Number(row.forecasts));
      for (const [key, stem] of Object.entries(STEMS)) {
        const m = coin[key as keyof typeof STEMS];
        expect(m.exceptions95).toBe(Number(row[`${stem}_exceptions_95`]));
        expect(m.exceptions99).toBe(Number(row[`${stem}_exceptions_99`]));
        expect(m.zeroDriftExceptions95).toBe(Number(row[`${stem}_zero_drift_exceptions_95`]));
        expect(m.zeroDriftExceptions99).toBe(Number(row[`${stem}_zero_drift_exceptions_99`]));
        expect(Math.abs(m.lossToShortfall95 - Number(row[`${stem}_es_ratio_95`] || 0))).toBeLessThanOrEqual(5e-5);
        expect(Math.abs(m.lossToShortfall99 - Number(row[`${stem}_es_ratio_99`] || 0))).toBeLessThanOrEqual(5e-5);
      }
    });
  });

  it('matches every period shared by at least 10 coins', () => {
    const periods = readCsv('monte_carlo_periods.csv').filter(r => Number(r.coins) >= 10);
    expect(VAR_STUDY_PERIODS).toEqual(
      periods.map(r => ({
        start: r.date,
        coins: Number(r.coins),
        garchBootstrap: Number(r.garch_bootstrap_exceptions_95),
        normal: Number(r.gbm_exceptions_95),
        studentT: Number(r.student_t_exceptions_95),
      }))
    );
  });
});

describe('ValueAtRiskBacktest', () => {
  it('reports the figures in the notebooks', () => {
    renderPost();
    expect(screen.getByText(/1,467 forecasts per model/)).toBeInTheDocument();
    expect(screen.getByText(/breaking its 95% VaR on 3\.7% of forecasts/)).toBeInTheDocument();
    const table = within(screen.getByRole('columnheader', { name: 'Losses beyond 95% VaR (5% expected)' }).closest('table')!);
    const row = (label: string) => [...table.getByRole('cell', { name: label }).closest('tr')!.cells].slice(1).map(c => c.textContent);
    expect(row('GARCH bootstrap')).toEqual(['3.7%', '0.61%', '1.02']);
    expect(row('Normal')).toEqual(['2.9%', '0.41%', '0.99']);
    expect(row('Student-t')).toEqual(['2.0%', '0.14%', '0.91']);
    expect(screen.getByText(/moved every rate by under a percentage point/)).toBeInTheDocument();
  });

  it('counts the waves from the period data', () => {
    renderPost();
    expect(screen.getByText(/In 8 of the 18 periods no coin broke its VaR/)).toBeInTheDocument();
    expect(screen.getByText(/from May 30, 20% of coins did, and from October 7, 14%/)).toBeInTheDocument();
    expect(screen.getByText(/Those two periods hold 27 of the 50 exceptions/)).toBeInTheDocument();
  });

  it("adds Bitcoin's live backtest once it loads", () => {
    const { unmount } = renderPost();
    expect(screen.queryByText('See it live')).not.toBeInTheDocument();
    unmount();

    renderPost(riskSummary);
    expect(
      screen.getByText(/with daily closes up to 2026-11-19, the GARCH-filtered 95% VaR has 9 exceptions in 211 test days against 10\.6 expected \(Kupiec p = 0\.62\)/)
    ).toBeInTheDocument();
  });
});
