import React from 'react';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { Cryptocurrency, MarketRiskRow } from '../types/crypto';

interface MarketTodayProps {
  coins: { crypto: Cryptocurrency; risk: MarketRiskRow }[];
  totalCoins: number;
  computedAt: string;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export const MarketToday: React.FC<MarketTodayProps> = ({ coins, totalCoins, computedAt }) => {
  const withRegime = coins.filter(c => c.risk.regime);
  const downtrend = withRegime.filter(c => c.risk.regime!.trend === 'down').length;
  const highVolatility = withRegime.filter(c => c.risk.regime!.volatilityLevel === 'high').length;
  const volatilities = coins.map(c => c.risk.volatility30d).filter((v): v is number => v != null);
  const deepest = coins
    .filter(c => c.risk.currentDrawdown != null)
    .reduce<(typeof coins)[number] | undefined>(
      (worst, c) => (!worst || c.risk.currentDrawdown! < worst.risk.currentDrawdown! ? c : worst),
      undefined
    );

  const tiles = [
    {
      label: 'In a downtrend',
      value: `${downtrend} of ${withRegime.length}`,
      note: 'Price below its 200-day average',
    },
    {
      label: 'High volatility',
      value: `${highVolatility} of ${withRegime.length}`,
      note: '30-day volatility in the top third of the past year',
    },
    {
      label: 'Median 30-day volatility',
      value: volatilities.length ? `${median(volatilities).toFixed(0)}%` : '—',
      note: 'Annualized',
    },
    {
      label: 'Deepest drawdown',
      value: deepest ? `${(deepest.risk.currentDrawdown! * 100).toFixed(0)}%` : '—',
      note: deepest ? `${deepest.crypto.name}, from its 1-year high` : 'From the 1-year high',
      to: deepest ? `/crypto/${deepest.crypto.symbol}?tab=risk` : undefined,
    },
  ];

  return (
    <section aria-labelledby="market-today" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="market-today" className="text-xl font-semibold text-gray-900">
          Market today
        </h2>
        <p className="text-xs text-gray-500">
          {coins.length} of the {totalCoins} largest coins, stablecoins left out · models as of{' '}
          {format(parseISO(computedAt), 'MMM d, yyyy')}
        </p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {tiles.map(tile => (
          <div key={tile.label} className="card py-4">
            <p className="text-sm text-gray-500">{tile.label}</p>
            <p className="text-2xl font-bold text-gray-900">{tile.value}</p>
            {tile.to ? (
              <Link to={tile.to} className="block text-xs text-primary-600 hover:text-primary-700">
                {tile.note}
              </Link>
            ) : (
              <p className="text-xs text-gray-500">{tile.note}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};
