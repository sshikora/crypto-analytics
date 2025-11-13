import React, { useEffect } from 'react';
import { useQuery } from '@apollo/client';
import { useNavigate } from 'react-router-dom';
import { CryptoCard } from '../components/CryptoCard';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { GET_TOP_CRYPTOCURRENCIES } from '../services/queries';
import { Cryptocurrency } from '../types/crypto';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useQuery(GET_TOP_CRYPTOCURRENCIES, {
    variables: { limit: 10 },
  });

  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 60000); // Refresh every minute

    return () => clearInterval(interval);
  }, [refetch]);

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="text-red-500 p-4">Error: {error.message}</div>;

  const topCryptos: Cryptocurrency[] = data?.topCryptocurrencies || [];

  console.log('Dashboard data:', data);
  console.log('Top cryptos count:', topCryptos.length);
  console.log('Top cryptos:', topCryptos);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Cryptocurrency Dashboard</h1>
        <button
          onClick={() => refetch()}
          className="btn btn-primary"
        >
          Refresh Data
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {topCryptos.map((crypto) => (
          <CryptoCard
            key={crypto.coinGeckoId}
            crypto={crypto}
            onClick={() => navigate(`/crypto/${crypto.symbol}`)}
          />
        ))}
      </div>
    </div>
  );
};
