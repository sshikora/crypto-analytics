import React from 'react';
import { Cryptocurrency } from '../types/crypto';

interface CryptoCardProps {
  crypto: Cryptocurrency;
  onClick?: () => void;
}

export const CryptoCard: React.FC<CryptoCardProps> = ({ crypto, onClick }) => {
  const isPositive = (crypto.priceChangePercentage24h ?? 0) >= 0;

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

  return (
    <div
      className="card hover:shadow-lg transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          {crypto.imageUrl && (
            <img
              src={crypto.imageUrl}
              alt={crypto.name}
              className="w-10 h-10 rounded-full"
            />
          )}
          <div>
            <h3 className="text-lg font-semibold">{crypto.name}</h3>
            <p className="text-sm text-gray-500 uppercase">{crypto.symbol}</p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-2xl font-bold">
            {formatPrice(crypto.currentPrice)}
          </span>
          {crypto.priceChangePercentage24h !== undefined && (
            <span
              className={`px-2 py-1 rounded text-sm font-semibold ${
                isPositive
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-700'
              }`}
            >
              {isPositive ? '+' : ''}
              {crypto.priceChangePercentage24h.toFixed(2)}%
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2 border-t text-sm">
          <div>
            <p className="text-gray-500">Market Cap</p>
            <p className="font-semibold">{formatNumber(crypto.marketCap)}</p>
          </div>
          <div>
            <p className="text-gray-500">Volume 24h</p>
            <p className="font-semibold">{formatNumber(crypto.volume24h)}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
