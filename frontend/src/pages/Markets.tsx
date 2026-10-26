import React, { useState } from 'react';
import { useQuery } from '@apollo/client';
import { Link, useNavigate } from 'react-router-dom';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { RegimeBadge } from '../components/RegimeBadge';
import { SEO } from '../components/SEO';
import { GET_MARKET_RISK, GET_TOP_CRYPTOCURRENCIES } from '../services/queries';
import { Cryptocurrency, MarketRiskRow } from '../types/crypto';

type SortKey = 'rank' | 'price' | 'change' | 'marketCap' | 'volume' | 'volatility' | 'drawdown' | 'valueAtRisk';

interface Row {
  rank: number;
  crypto: Cryptocurrency;
  risk: MarketRiskRow | undefined;
}

const SORT_VALUE: Record<SortKey, (row: Row) => number | null | undefined> = {
  rank: r => r.rank,
  price: r => r.crypto.currentPrice,
  change: r => r.crypto.priceChangePercentage24h,
  marketCap: r => r.crypto.marketCap,
  volume: r => r.crypto.volume24h,
  volatility: r => r.risk?.volatility30d,
  drawdown: r => r.risk?.currentDrawdown,
  valueAtRisk: r => r.risk?.valueAtRisk95,
};

// The first click shows the top-ranked or riskiest coins first. Drawdowns are negative, so deepest first is ascending.
function firstDirection(key: SortKey): 'asc' | 'desc' {
  return key === 'rank' || key === 'drawdown' ? 'asc' : 'desc';
}

export const Markets: React.FC = () => {
  const navigate = useNavigate();
  const [sort, setSort] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'rank', direction: 'asc' });
  const { data, loading, error, refetch } = useQuery(GET_TOP_CRYPTOCURRENCIES, {
    variables: { limit: 100 },
  });
  const { data: riskData } = useQuery(GET_MARKET_RISK);

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="text-red-500 p-4">Error: {error.message}</div>;

  const cryptos: Cryptocurrency[] = data?.topCryptocurrencies || [];
  const riskByCoin = new Map<string, MarketRiskRow>(
    (riskData?.marketRisk?.rows ?? []).map((row: MarketRiskRow) => [row.coinId, row])
  );
  const rows: Row[] = cryptos.map((crypto, index) => ({ rank: index + 1, crypto, risk: riskByCoin.get(crypto.coinGeckoId) }));

  // Coins without a value always go last, whichever way the column is sorted
  const value = SORT_VALUE[sort.key];
  const sorted = [...rows].sort((a, b) => {
    const x = value(a);
    const y = value(b);
    if (x == null || y == null) return x == null ? (y == null ? a.rank - b.rank : 1) : -1;
    return sort.direction === 'asc' ? x - y : y - x;
  });

  const sortBy = (key: SortKey) =>
    setSort(current =>
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: firstDirection(key) }
    );

  const header = (key: SortKey, label: string, align: 'left' | 'right' = 'right') => (
    <th
      className={`py-3 px-4 whitespace-nowrap text-${align}`}
      aria-sort={sort.key === key ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button type="button" onClick={() => sortBy(key)} className="font-semibold hover:text-primary-600">
        {label}
        {sort.key === key && <span aria-hidden="true">{sort.direction === 'asc' ? ' ▲' : ' ▼'}</span>}
      </button>
    </th>
  );

  const formatNumber = (num?: number) => {
    if (num === undefined || num === null) return 'N/A';
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };

  const formatPrice = (price?: number) => {
    if (price === undefined || price === null) return 'N/A';
    if (price < 0.01) return `$${price.toFixed(6)}`;
    if (price < 1) return `$${price.toFixed(4)}`;
    return `$${price.toFixed(2)}`;
  };

  const percent = (x: number | null | undefined, scale = 1) => (x == null ? '—' : `${(x * scale).toFixed(1)}%`);

  return (
    <>
      <SEO
        title="Cryptocurrency Markets - Top 100 Cryptocurrencies with Risk | CryptoQuantLab"
        description="The top 100 cryptocurrencies by market cap with price, volume, 30-day volatility, drawdown from the 1-year high, one-day Value at Risk and trend regime."
        keywords="cryptocurrency market, crypto volatility, crypto value at risk, crypto drawdown, top cryptocurrencies, bitcoin market cap"
        canonicalUrl="/markets"
      />
      <div className="space-y-6">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <h1 className="text-3xl font-bold text-gray-900">Cryptocurrency Markets</h1>
          <button onClick={() => refetch()} className="btn btn-primary">
            Refresh Data
          </button>
        </div>

        <p className="text-sm text-gray-600">
          Risk columns come from daily closes and update after the nightly run. Volatility is annualized; VaR is the
          one-day loss exceeded on about 1 day in 20, from GARCH-filtered historical simulation.{' '}
          <Link to="/methodology" className="text-primary-600 hover:text-primary-700">
            How they are calculated
          </Link>
        </p>

        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                {header('rank', '#', 'left')}
                <th className="text-left py-3 px-4">Name</th>
                {header('price', 'Price')}
                {header('change', '24h %')}
                {header('marketCap', 'Market Cap')}
                {header('volume', 'Volume (24h)')}
                {header('volatility', '30d Volatility')}
                {header('drawdown', 'From 1Y High')}
                {header('valueAtRisk', '1-Day VaR 95%')}
                <th className="text-left py-3 px-4 whitespace-nowrap">Regime</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(({ rank, crypto, risk }) => {
                const isPositive = (crypto.priceChangePercentage24h ?? 0) >= 0;
                return (
                  <tr
                    key={crypto.coinGeckoId}
                    className="border-b hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`/crypto/${crypto.symbol}`)}
                  >
                    <td className="py-3 px-4 text-gray-500">{rank}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-3">
                        {crypto.imageUrl && (
                          <img src={crypto.imageUrl} alt={crypto.name} className="w-8 h-8 rounded-full" />
                        )}
                        <div>
                          <p className="font-semibold">{crypto.name}</p>
                          <p className="text-sm text-gray-500 uppercase">{crypto.symbol}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-semibold">{formatPrice(crypto.currentPrice)}</td>
                    <td className={`py-3 px-4 text-right font-semibold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                      {isPositive ? '+' : ''}
                      {crypto.priceChangePercentage24h?.toFixed(2) ?? 'N/A'}%
                    </td>
                    <td className="py-3 px-4 text-right">{formatNumber(crypto.marketCap)}</td>
                    <td className="py-3 px-4 text-right">{formatNumber(crypto.volume24h)}</td>
                    <td className="py-3 px-4 text-right">{risk?.volatility30d == null ? '—' : `${risk.volatility30d.toFixed(1)}%`}</td>
                    <td className="py-3 px-4 text-right">{percent(risk?.currentDrawdown, 100)}</td>
                    <td className="py-3 px-4 text-right">{percent(risk?.valueAtRisk95, 100)}</td>
                    <td className="py-3 px-4">{risk?.regime ? <RegimeBadge regime={risk.regime} compact /> : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};
