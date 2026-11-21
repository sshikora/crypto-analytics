import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MinimumVarianceWeightCap from './MinimumVarianceWeightCap';
import { PORTFOLIO_PERIODS, PORTFOLIO_RESULTS } from './portfolioStudy';

function readCsv(name: string) {
  const lines = readFileSync(join(__dirname, '..', '..', '..', 'validation', 'data', name), 'utf8').trim().split('\n');
  const header = lines[0].split(',');
  return lines.slice(1).map(line => Object.fromEntries(line.split(',').map((v, i) => [header[i], v])));
}

const summary = readCsv('portfolio_backtest_summary.csv');
const periods = readCsv('portfolio_backtest_periods.csv');
const UNIVERSES = { top20: 'top_20', top20WithoutTron: 'top_20_without_tron' } as const;
const snake = (camel: string) => camel.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`).replace(/(\d+)/, '_$1');
const ratio = (r: Record<string, string>) => Number(r.realized_daily_volatility) / Number(r.forecast_daily_volatility);
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
// The module stores six significant figures, as the CSVs do
const close = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThanOrEqual(5e-6 * Math.abs(b) + 1e-12);

describe('portfolio study data', () => {
  it('matches every strategy averaged over the six schedules', () => {
    expect(PORTFOLIO_RESULTS).toHaveLength(20);
    for (const r of PORTFOLIO_RESULTS) {
      const strategy = snake(r.strategy);
      const rows = summary.filter(s => s.universe === UNIVERSES[r.universe] && s.strategy === strategy);
      const held = periods.filter(p => p.universe === UNIVERSES[r.universe] && p.strategy === strategy);
      expect(rows, strategy).toHaveLength(6);
      close(r.annualizedVolatility, mean(rows.map(s => Number(s.annualized_volatility))));
      close(r.maxDrawdown, mean(rows.map(s => Number(s.max_drawdown))));
      close(r.effectiveHoldings, mean(rows.map(s => Number(s.mean_effective_holdings))));
      close(r.turnover, mean(rows.map(s => Number(s.mean_turnover))));
      close(r.meanRatio, mean(held.map(ratio)));
      close(r.worstRatio, Math.max(...held.map(ratio)));
    }
  });

  it('matches every 90-day rebalance in the chart', () => {
    const top = periods.filter(p => p.universe === 'top_20' && p.window === '90');
    const uncapped = top.filter(p => p.strategy === 'min_variance_constant_correlation').sort((a, b) => a.start.localeCompare(b.start));
    expect(PORTFOLIO_PERIODS.map(p => p.start)).toEqual(uncapped.map(p => p.start));
    PORTFOLIO_PERIODS.forEach((p, i) => {
      const capped = top.find(q => q.strategy === 'min_variance_cap_20' && q.start === p.start)!;
      close(p.uncapped, ratio(uncapped[i]));
      close(p.capped, ratio(capped));
      close(p.largestWeight, Number(uncapped[i].largest_weight));
    });
  });
});

describe('MinimumVarianceWeightCap', () => {
  it('reports the figures in the data', () => {
    render(
      <MemoryRouter>
        <MinimumVarianceWeightCap />
      </MemoryRouter>
    );
    expect(screen.getByText(/cut volatility from 40\.1% a year for a\s+cap-weighted portfolio to 21\.3%/)).toBeInTheDocument();
    expect(screen.getByText(/kept about 67% of the reduction/)).toBeInTheDocument();
    expect(screen.getByText(/held 77–80% in TRON/)).toBeInTheDocument();
    expect(screen.getByText(/Two more weeks of data cut that to 9–14%/)).toBeInTheDocument();

    const table = within(screen.getByRole('columnheader', { name: 'Turnover per rebalance' }).closest('table')!);
    const row = (label: string) => [...table.getByRole('cell', { name: label }).closest('tr')!.cells].slice(1).map(c => c.textContent);
    expect(row('Minimum variance')).toEqual(['21.3%', '18.5%', '2.0', '17%']);
    expect(row('Minimum variance, 20% cap')).toEqual(['27.5%', '20.1%', '6.1', '17%']);
    expect(row('Cap-weighted')).toEqual(['40.1%', '30.3%', '2.0', '0%']);
    expect(row('Highest Sharpe')).toEqual(['54.1%', '41.5%', '3.1', '49%']);
  });
});
