import React from 'react';
import { Link } from 'react-router-dom';
import { Cryptocurrency, MarketRiskRow } from '../types/crypto';
import { RegimeBadge } from './RegimeBadge';

interface CryptoCardProps {
  crypto: Cryptocurrency;
  risk?: MarketRiskRow;
  onClick?: () => void;
}

const TAB_LINKS = [
  { tab: 'risk', label: 'Risk' },
  { tab: 'signals', label: 'Signals' },
  { tab: 'scenario', label: 'Scenario' },
];

const formatPrice = (price?: number) => {
  if (price === undefined || price === null) return 'N/A';
  if (price < 0.01) return `$${price.toFixed(6)}`;
  if (price < 1) return `$${price.toFixed(4)}`;
  return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const percent = (x: number | null | undefined, scale = 1) => (x == null ? '—' : `${(x * scale).toFixed(1)}%`);

const stopCardClick = (event: React.MouseEvent) => event.stopPropagation();

export const CryptoCard: React.FC<CryptoCardProps> = ({ crypto, risk, onClick }) => {
  const isPositive = (crypto.priceChangePercentage24h ?? 0) >= 0;
  const metrics = [
    { label: '30d volatility', value: percent(risk?.volatility30d), title: 'Annualized, from the last 30 daily returns' },
    { label: 'From 1Y high', value: percent(risk?.currentDrawdown, 100), title: 'Drawdown from the highest close in the past year' },
    {
      label: '1-day VaR 95%',
      value: percent(risk?.valueAtRisk95, 100),
      title: 'One-day loss exceeded on about 1 day in 20, from GARCH-filtered historical simulation',
    },
  ];

  return (
    <div className="card h-full flex flex-col hover:shadow-lg transition-shadow cursor-pointer" onClick={onClick}>
      <div className="flex items-start space-x-3 pr-10">
        {crypto.imageUrl && <img src={crypto.imageUrl} alt={crypto.name} className="w-10 h-10 rounded-full" />}
        <div className="min-w-0 space-y-1">
          <h3 className="text-lg font-semibold leading-tight">
            {crypto.name} <span className="text-sm font-normal text-gray-500 uppercase">{crypto.symbol}</span>
          </h3>
          {risk?.regime && (
            <div onClick={stopCardClick}>
              <RegimeBadge regime={risk.regime} />
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-between items-center mt-4">
        <span className="text-2xl font-bold">{formatPrice(crypto.currentPrice)}</span>
        {crypto.priceChangePercentage24h !== undefined && (
          <span
            className={`px-2 py-1 rounded text-sm font-semibold ${
              isPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}
          >
            {isPositive ? '+' : ''}
            {crypto.priceChangePercentage24h.toFixed(2)}%
          </span>
        )}
      </div>

      <dl className="grid grid-cols-3 gap-2 mt-3 mb-3 pt-3 border-t text-sm">
        {metrics.map(m => (
          <div key={m.label} title={m.title}>
            <dt className="text-xs text-gray-500">{m.label}</dt>
            <dd className="font-semibold">{m.value}</dd>
          </div>
        ))}
      </dl>

      <nav
        aria-label={`${crypto.name} models`}
        className="flex gap-4 mt-auto pt-3 border-t text-sm font-medium"
        onClick={stopCardClick}
      >
        {TAB_LINKS.map(link => (
          <Link
            key={link.tab}
            to={`/crypto/${crypto.symbol}?tab=${link.tab}`}
            className="text-primary-600 hover:text-primary-700"
          >
            {link.label} →
          </Link>
        ))}
      </nav>
    </div>
  );
};
