import React from 'react';
import { useQuery } from '@apollo/client';
import { useNavigate } from 'react-router-dom';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { SEO } from '../components/SEO';
import { GET_TOP_CRYPTOCURRENCIES } from '../services/queries';
import { Cryptocurrency } from '../types/crypto';

export const Markets: React.FC = () => {
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useQuery(GET_TOP_CRYPTOCURRENCIES, {
    variables: { limit: 50 },
  });

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="text-red-500 p-4">Error: {error.message}</div>;

  const cryptos: Cryptocurrency[] = data?.topCryptocurrencies || [];

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
    <>
      <SEO
        title="Cryptocurrency Markets - Top 50 Cryptocurrencies | CryptoQuantLab"
        description="Browse the top 50 cryptocurrencies by market cap. View real-time prices, 24h changes, trading volumes, and market capitalizations for Bitcoin, Ethereum, and more."
        keywords="cryptocurrency market, crypto market cap, top cryptocurrencies, bitcoin market cap, ethereum market cap, crypto trading volume, altcoins, crypto rankings"
        canonicalUrl="/markets"
      />
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Cryptocurrency Markets</h1>
        <button onClick={() => refetch()} className="btn btn-primary">
          Refresh Data
        </button>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left py-3 px-4">#</th>
              <th className="text-left py-3 px-4">Name</th>
              <th className="text-right py-3 px-4">Price</th>
              <th className="text-right py-3 px-4">24h %</th>
              <th className="text-right py-3 px-4">Market Cap</th>
              <th className="text-right py-3 px-4">Volume (24h)</th>
            </tr>
          </thead>
          <tbody>
            {cryptos.map((crypto, index) => {
              const isPositive = (crypto.priceChangePercentage24h ?? 0) >= 0;
              return (
                <tr
                  key={crypto.coinGeckoId}
                  className="border-b hover:bg-gray-50 cursor-pointer"
                  onClick={() => navigate(`/crypto/${crypto.symbol}`)}
                >
                  <td className="py-3 px-4 text-gray-500">{index + 1}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-3">
                      {crypto.imageUrl && (
                        <img
                          src={crypto.imageUrl}
                          alt={crypto.name}
                          className="w-8 h-8 rounded-full"
                        />
                      )}
                      <div>
                        <p className="font-semibold">{crypto.name}</p>
                        <p className="text-sm text-gray-500 uppercase">
                          {crypto.symbol}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right font-semibold">
                    {formatPrice(crypto.currentPrice)}
                  </td>
                  <td
                    className={`py-3 px-4 text-right font-semibold ${
                      isPositive ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {isPositive ? '+' : ''}
                    {crypto.priceChangePercentage24h?.toFixed(2) ?? 'N/A'}%
                  </td>
                  <td className="py-3 px-4 text-right">
                    {formatNumber(crypto.marketCap)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {formatNumber(crypto.volume24h)}
                  </td>
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
