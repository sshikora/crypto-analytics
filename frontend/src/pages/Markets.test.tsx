import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { useQuery } from '@apollo/client';
import { Markets } from './Markets';
import { GET_MARKET_RISK } from '../services/queries';

vi.mock('@apollo/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@apollo/client')>()),
  useQuery: vi.fn(),
}));

const coins = [
  { coinGeckoId: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', currentPrice: 80000, priceChangePercentage24h: -0.1, marketCap: 1.6e12, volume24h: 2e10 },
  { coinGeckoId: 'ethereum', symbol: 'ETH', name: 'Ethereum', currentPrice: 2500, priceChangePercentage24h: 1.2, marketCap: 3e11, volume24h: 1e10 },
  { coinGeckoId: 'tether', symbol: 'USDT', name: 'Tether', currentPrice: 1, priceChangePercentage24h: 0, marketCap: 1.8e11, volume24h: 5e10 },
  { coinGeckoId: 'brand-new', symbol: 'NEW', name: 'Brand New', currentPrice: 3, priceChangePercentage24h: 5, marketCap: 1e9, volume24h: 1e8 },
];

const regime = { trend: 'up', movingAverage: 1, priceToMovingAverage: 1.1, volatilityPercentile: 0.1, volatilityLevel: 'low' };
const risk = [
  { coinId: 'bitcoin', asOf: '2026-10-26', volatility30d: 25.1, currentDrawdown: -0.3, valueAtRisk95: 0.0268, regime },
  { coinId: 'ethereum', asOf: '2026-10-26', volatility30d: 33.2, currentDrawdown: -0.44, valueAtRisk95: 0.0338, regime: { ...regime, volatilityLevel: 'high' } },
  { coinId: 'tether', asOf: '2026-10-26', volatility30d: 0.3, currentDrawdown: -0.002, valueAtRisk95: 0.0003, regime: null },
];

function mockQueries(marketRisk: unknown) {
  vi.mocked(useQuery).mockImplementation(((query: unknown) =>
    query === GET_MARKET_RISK
      ? { data: { marketRisk } }
      : { data: { topCryptocurrencies: coins }, loading: false, error: undefined, refetch: vi.fn() }) as never);
}

function renderPage() {
  return render(
    <HelmetProvider>
      <MemoryRouter>
        <Markets />
      </MemoryRouter>
    </HelmetProvider>
  );
}

function names() {
  return screen.getAllByRole('row').slice(1).map(row => within(row).getAllByRole('cell')[1].querySelector('p')!.textContent);
}

describe('Markets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueries({ computedAt: '2026-10-26T01:00:00.000Z', rows: risk });
  });

  it('lists the top 100 with risk columns joined by coin', () => {
    renderPage();

    expect(vi.mocked(useQuery).mock.calls.find(c => c[0] !== GET_MARKET_RISK)![1]).toEqual({ variables: { limit: 100 } });
    const btc = screen.getAllByRole('row')[1];
    expect(within(btc).getByText('25.1%')).toBeInTheDocument();
    expect(within(btc).getByText('-30.0%')).toBeInTheDocument();
    expect(within(btc).getByText('2.7%')).toBeInTheDocument();
    expect(within(btc).getByText('↑ low')).toBeInTheDocument();
    const newCoin = screen.getAllByRole('row')[4];
    expect(within(newCoin).getAllByText('—')).toHaveLength(4);
  });

  it('sorts a risk column riskiest first, then reverses, keeping coins without data last', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: '30d Volatility' }));
    expect(names()).toEqual(['Ethereum', 'Bitcoin', 'Tether', 'Brand New']);
    expect(screen.getByRole('columnheader', { name: /30d Volatility/ })).toHaveAttribute('aria-sort', 'descending');

    fireEvent.click(screen.getByRole('button', { name: /30d Volatility/ }));
    expect(names()).toEqual(['Tether', 'Bitcoin', 'Ethereum', 'Brand New']);
    expect(screen.getByRole('columnheader', { name: /30d Volatility/ })).toHaveAttribute('aria-sort', 'ascending');
  });

  it('shows the deepest drawdown first', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'From 1Y High' }));
    expect(names()).toEqual(['Ethereum', 'Bitcoin', 'Tether', 'Brand New']);
  });

  it('returns to rank order', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: '1-Day VaR 95%' }));
    fireEvent.click(screen.getByRole('button', { name: '#' }));
    expect(names()).toEqual(['Bitcoin', 'Ethereum', 'Tether', 'Brand New']);
  });

  it('still lists every coin before the first risk snapshot exists', () => {
    mockQueries(null);
    renderPage();
    expect(names()).toEqual(['Bitcoin', 'Ethereum', 'Tether', 'Brand New']);
    expect(screen.getAllByText('—')).toHaveLength(16);
  });
});
