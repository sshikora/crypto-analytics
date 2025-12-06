import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { PriceChart } from '../components/PriceChart';
import { MovingAverageChart } from '../components/MovingAverageChart';
import { StatCard } from '../components/StatCard';
import { TimeRangeSelector } from '../components/TimeRangeSelector';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { GET_CRYPTOCURRENCY, GET_PRICE_HISTORY, GET_MARKET_STATS } from '../services/queries';
import { TimeRange } from '../types/crypto';
import { format } from 'date-fns';
import { useAuth } from '../context/AuthContext';

export const CryptoDetail: React.FC = () => {
  const { symbol } = useParams<{ symbol: string }>();
  const navigate = useNavigate();
  const { preferences } = useAuth();
  const [timeRange, setTimeRange] = useState<TimeRange>(TimeRange.DAY);
  const [maTimeRange, setMaTimeRange] = useState<TimeRange>(TimeRange.MONTH);

  // Load default time range from preferences
  useEffect(() => {
    if (preferences?.defaultTimeRange) {
      setMaTimeRange(preferences.defaultTimeRange as TimeRange);
    }
  }, [preferences]);

  const { data: cryptoData, loading: cryptoLoading } = useQuery(GET_CRYPTOCURRENCY, {
    variables: { symbol: symbol?.toUpperCase() },
    skip: !symbol,
  });

  const { data: historyData, loading: historyLoading } = useQuery(GET_PRICE_HISTORY, {
    variables: { symbol: symbol?.toUpperCase(), timeRange },
    skip: !symbol,
  });

  const { data: maHistoryData, loading: maHistoryLoading } = useQuery(GET_PRICE_HISTORY, {
    variables: { symbol: symbol?.toUpperCase(), timeRange: maTimeRange },
    skip: !symbol,
  });

  const { data: statsData, loading: statsLoading } = useQuery(GET_MARKET_STATS, {
    variables: { symbol: symbol?.toUpperCase() },
    skip: !symbol,
  });

  if (cryptoLoading || historyLoading || statsLoading) {
    return <LoadingSpinner />;
  }

  const crypto = cryptoData?.cryptocurrency;
  const priceHistory = historyData?.priceHistory;
  const maHistory = maHistoryData?.priceHistory;
  const marketStats = statsData?.marketStats;

  if (!crypto) {
    return (
      <div className="text-center p-8">
        <p className="text-gray-500">Cryptocurrency not found</p>
        <button onClick={() => navigate('/')} className="btn btn-primary mt-4">
          Back to Dashboard
        </button>
      </div>
    );
  }

  const formatNumber = (num?: number) => {
    if (num === undefined || num === null) return 'N/A';
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };

  const formatSupply = (num?: number) => {
    if (num === undefined || num === null) return 'N/A';
    if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
    return num.toFixed(2);
  };

  const isPositive = (crypto.priceChangePercentage24h ?? 0) >= 0;

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate('/')}
        className="text-primary-600 hover:text-primary-700 font-medium"
      >
        ← Back to Dashboard
      </button>

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {crypto.imageUrl && (
            <img
              src={crypto.imageUrl}
              alt={crypto.name}
              className="w-16 h-16 rounded-full"
            />
          )}
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{crypto.name}</h1>
            <p className="text-gray-500 uppercase">{crypto.symbol}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-4xl font-bold">{formatNumber(crypto.currentPrice)}</p>
          <p
            className={`text-lg font-semibold ${
              isPositive ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {isPositive ? '+' : ''}
            {crypto.priceChangePercentage24h?.toFixed(2)}% (24h)
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Market Cap"
          value={formatNumber(crypto.marketCap)}
          trend={isPositive ? 'up' : 'down'}
        />
        <StatCard
          title="24h Volume"
          value={formatNumber(crypto.volume24h)}
        />
        <StatCard
          title="24h High"
          value={formatNumber(crypto.high24h)}
          trend="up"
        />
        <StatCard
          title="24h Low"
          value={formatNumber(crypto.low24h)}
          trend="down"
        />
      </div>

      <div className="card">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Price Chart</h2>
          <TimeRangeSelector selected={timeRange} onChange={setTimeRange} />
        </div>
        {priceHistory && priceHistory.data.length > 0 ? (
          <PriceChart
            data={priceHistory.data}
            color={isPositive ? '#10b981' : '#ef4444'}
          />
        ) : (
          <p className="text-gray-500 text-center py-8">No price history available</p>
        )}
      </div>

      {/* Moving Average Chart */}
      <div className="card">
        {maHistory && maHistory.data.length > 0 ? (
          <MovingAverageChart
            data={maHistory.data}
            selectedTimeRange={maTimeRange}
            onTimeRangeChange={setMaTimeRange}
          />
        ) : maHistoryLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">No data available for moving averages</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Supply Information</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-500">Circulating Supply</span>
              <span className="font-semibold">
                {formatSupply(marketStats?.circulatingSupply)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Total Supply</span>
              <span className="font-semibold">
                {formatSupply(marketStats?.totalSupply)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Max Supply</span>
              <span className="font-semibold">
                {formatSupply(marketStats?.maxSupply)}
              </span>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="text-xl font-semibold mb-4">All-Time Stats</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-500">All-Time High</span>
              <div className="text-right">
                <p className="font-semibold">{formatNumber(marketStats?.athPrice)}</p>
                {marketStats?.athDate && (
                  <p className="text-xs text-gray-400">
                    {format(new Date(marketStats.athDate), 'MMM dd, yyyy')}
                  </p>
                )}
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">All-Time Low</span>
              <div className="text-right">
                <p className="font-semibold">{formatNumber(marketStats?.atlPrice)}</p>
                {marketStats?.atlDate && (
                  <p className="text-xs text-gray-400">
                    {format(new Date(marketStats.atlDate), 'MMM dd, yyyy')}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
