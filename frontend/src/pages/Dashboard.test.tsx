import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { useQuery } from '@apollo/client';
import { Dashboard } from './Dashboard';
import { GET_MARKET_RISK } from '../services/queries';
import { POSTS } from '../research/posts';

vi.mock('@apollo/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@apollo/client')>()),
  useQuery: vi.fn(),
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: false, preferences: null, savePreferences: vi.fn() }),
}));

const coin = (coinGeckoId: string, symbol: string, name: string) => ({
  coinGeckoId,
  symbol,
  name,
  currentPrice: 100,
  priceChangePercentage24h: 1,
  marketCap: 1e9,
  volume24h: 1e8,
});

const coins = [
  coin('bitcoin', 'BTC', 'Bitcoin'),
  coin('ethereum', 'ETH', 'Ethereum'),
  coin('tether', 'USDT', 'Tether'),
  coin('binancecoin', 'BNB', 'BNB'),
  coin('usd-coin', 'USDC', 'USDC'),
  coin('ripple', 'XRP', 'XRP'),
  coin('solana', 'SOL', 'Solana'),
  coin('tron', 'TRX', 'TRON'),
  coin('dogecoin', 'DOGE', 'Dogecoin'),
];

const regime = (trend: 'up' | 'down', volatilityLevel: 'low' | 'normal' | 'high') => ({
  trend,
  movingAverage: 1,
  priceToMovingAverage: trend === 'up' ? 1.1 : 0.9,
  volatilityPercentile: 0.5,
  volatilityLevel,
});

const risk = [
  { coinId: 'bitcoin', asOf: '2026-11-23', volatility30d: 47.3, currentDrawdown: -0.369, valueAtRisk95: 0.0386, regime: regime('down', 'high') },
  { coinId: 'ethereum', asOf: '2026-11-23', volatility30d: 66.4, currentDrawdown: -0.486, valueAtRisk95: 0.0425, regime: regime('down', 'high') },
  { coinId: 'tether', asOf: '2026-11-23', volatility30d: 0.7, currentDrawdown: -0.95, valueAtRisk95: 0.0005, regime: regime('down', 'high') },
  { coinId: 'binancecoin', asOf: '2026-11-23', volatility30d: 57.0, currentDrawdown: -0.41, valueAtRisk95: 0.0434, regime: regime('up', 'normal') },
  { coinId: 'ripple', asOf: '2026-11-23', volatility30d: 65.0, currentDrawdown: -0.606, valueAtRisk95: 0.0452, regime: regime('down', 'low') },
  { coinId: 'solana', asOf: '2026-11-23', volatility30d: 63.9, currentDrawdown: -0.518, valueAtRisk95: 0.0455, regime: null },
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
        <Dashboard />
      </MemoryRouter>
    </HelmetProvider>
  );
}

function cardFor(name: string) {
  return screen.getByRole('navigation', { name: `${name} models` }).closest('.card') as HTMLElement;
}

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueries({ computedAt: '2026-11-23T01:00:47.480Z', rows: risk });
  });

  it('shows the six largest coins that are not stablecoins by default', () => {
    renderPage();

    const shown = screen.getAllByRole('navigation', { name: / models$/ }).map(nav => nav.getAttribute('aria-label'));
    expect(shown).toEqual(['Bitcoin models', 'Ethereum models', 'BNB models', 'XRP models', 'Solana models', 'TRON models']);
  });

  it('puts each coin’s regime, risk numbers and model tabs on its card', () => {
    renderPage();

    const btc = cardFor('Bitcoin');
    expect(within(btc).getByRole('link', { name: '↓ Downtrend · high volatility' })).toHaveAttribute('href', '/methodology#regime');
    expect(within(btc).getByText('47.3%')).toBeInTheDocument();
    expect(within(btc).getByText('-36.9%')).toBeInTheDocument();
    expect(within(btc).getByText('3.9%')).toBeInTheDocument();
    expect(within(btc).getByRole('link', { name: 'Risk →' })).toHaveAttribute('href', '/crypto/BTC?tab=risk');
    expect(within(btc).getByRole('link', { name: 'Signals →' })).toHaveAttribute('href', '/crypto/BTC?tab=signals');
    expect(within(btc).getByRole('link', { name: 'Scenario →' })).toHaveAttribute('href', '/crypto/BTC?tab=scenario');

    const tron = cardFor('TRON');
    expect(within(tron).queryByRole('link', { name: /volatility/ })).not.toBeInTheDocument();
    expect(within(tron).getAllByText('—')).toHaveLength(3);
  });

  it('summarizes the non-stablecoins with risk data in the market row', () => {
    renderPage();

    const today = screen.getByRole('region', { name: 'Market today' });
    expect(within(today).getByText('3 of 4')).toBeInTheDocument();
    expect(within(today).getByText('2 of 4')).toBeInTheDocument();
    expect(within(today).getByText('64%')).toBeInTheDocument();
    expect(within(today).getByText('-61%')).toBeInTheDocument();
    expect(within(today).getByRole('link', { name: 'XRP, from its 1-year high' })).toHaveAttribute('href', '/crypto/XRP?tab=risk');
    expect(within(today).getByText(/5 of the 9 largest coins, stablecoins left out · models as of Nov 23, 2026/)).toBeInTheDocument();
  });

  it('leaves the market row out until the risk data loads', () => {
    mockQueries(undefined);
    renderPage();

    expect(screen.queryByRole('region', { name: 'Market today' })).not.toBeInTheDocument();
    expect(cardFor('Bitcoin')).toBeInTheDocument();
  });

  it('links the three latest research posts', () => {
    renderPage();

    const research = screen.getByRole('region', { name: 'Latest research' });
    for (const post of POSTS.slice(0, 3)) {
      expect(within(research).getByRole('link', { name: post.title })).toHaveAttribute('href', `/research/${post.slug}`);
    }
    expect(within(research).getByRole('link', { name: 'All research →' })).toHaveAttribute('href', '/research');
  });
});
