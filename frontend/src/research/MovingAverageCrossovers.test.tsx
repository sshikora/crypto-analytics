import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import MovingAverageCrossovers from './MovingAverageCrossovers';
import { CROSSOVER_STUDY } from './crossoverStudy';

vi.mock('@apollo/client', async importOriginal => ({
  ...(await importOriginal<typeof import('@apollo/client')>()),
  useQuery: vi.fn(),
}));

const csv = readFileSync(join(__dirname, '..', '..', '..', 'validation', 'data', 'crossover_backtest_coins.csv'), 'utf8')
  .trim()
  .split('\n');
const header = csv[0].split(',');
const study = csv.slice(1).map(line => Object.fromEntries(line.split(',').map((v, i) => [header[i], v])));

const bitcoin = {
  coinId: 'bitcoin',
  asOf: '2026-11-11',
  impliedTrials: 5.3,
  best: { short: 1, long: 20, sharpe: 0.89, deflatedSharpe: 0.57 },
  walkForward: { days: 146, strategy: { sharpe: 0.56 }, holding: { sharpe: 1.79 } },
  timingPValue: 0.2886,
};

function renderPost(signals: object | null = null) {
  vi.mocked(useQuery).mockReturnValue({ data: signals ? { signals } : undefined } as ReturnType<typeof useQuery>);
  return render(
    <MemoryRouter>
      <MovingAverageCrossovers />
    </MemoryRouter>
  );
}

describe('crossover study data', () => {
  it('matches every coin in the validation results at 15 bp', () => {
    expect(CROSSOVER_STUDY.map(c => c.coin)).toEqual(study.map(r => r.coin));
    const columns = {
      timingPValue: 'timing_p_value',
      probabilisticSharpe: 'psr_15bp',
      deflatedSharpe: 'dsr_implied_15bp',
      inSampleSharpe: 'in_sample_sharpe_15bp',
      walkForwardSharpe: 'walk_forward_sharpe_15bp',
      holdingSharpe: 'hold_sharpe',
      timeInMarket: 'walk_forward_exposure_15bp',
    } as const;
    CROSSOVER_STUDY.forEach((coin, i) => {
      for (const [field, column] of Object.entries(columns)) {
        expect(Math.abs(coin[field as keyof typeof columns] - Number(study[i][column]))).toBeLessThanOrEqual(5e-5);
      }
    });
  });
});

describe('MovingAverageCrossovers', () => {
  it('reports the figures in the notebook', () => {
    renderPost();
    expect(screen.getByText(/Only one coin in 70 beat chance/)).toBeInTheDocument();
    expect(screen.getByText(/passed the PSR test on 8\.6% of coins and the deflated test, with implied trials, on 7\.1%: 5 coins/)).toBeInTheDocument();
    const row = (label: string) => screen.getByText(label).closest('tr')!.cells[1].textContent;
    expect(row("Best crossover's Sharpe ratio, in sample")).toBe('0.73');
    expect(row("Walk-forward crossover's Sharpe ratio, out of sample")).toBe('0.32');
    expect(row('Holding the coin over the same days')).toBe('0.35');
    expect(row('Coins where walk-forward beat holding')).toBe('53%');
    expect(row('Time in the market')).toBe('47%');
  });

  it('names the only coin below 0.05', () => {
    expect(CROSSOVER_STUDY.filter(c => c.timingPValue < 0.05).map(c => c.coin)).toEqual(['gatechain-token']);
  });

  it("adds Bitcoin's live result once it loads", () => {
    const { unmount } = renderPost();
    expect(screen.queryByText('See it live')).not.toBeInTheDocument();
    unmount();

    renderPost(bitcoin);
    expect(screen.getByText(/with daily closes up to 2026-11-11, the timing test gives p = 0\.29/)).toBeInTheDocument();
    expect(screen.getByText(/0\.56 against 1\.79 for holding over 146 days/)).toBeInTheDocument();
  });
});
