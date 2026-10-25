import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { PriceChart } from '../components/PriceChart';
import { MovingAverageChart } from '../components/MovingAverageChart';
import { GarchPanel } from '../components/GarchPanel';
import { StatCard } from '../components/StatCard';
import { TimeRangeSelector } from '../components/TimeRangeSelector';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { SEO } from '../components/SEO';
import NotificationRulesList from '../components/NotificationRulesList';
import { GET_CRYPTOCURRENCY, GET_PRICE_HISTORY, GET_MARKET_STATS, GET_RISK_SUMMARY } from '../services/queries';
import { TimeRange } from '../types/crypto';
import { format } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import { Tabs, TabItem, tabId, tabPanelId } from '../components/Tabs';
import { Disclaimer } from '../components/Disclaimer';
import { RiskSummaryPanel } from '../components/RiskSummaryPanel';
import { CoinTab, useCoinPageParams } from '../hooks/useCoinPageParams';
import { track } from '../services/analytics';

const TABS: TabItem<CoinTab>[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'risk', label: 'Risk' },
];

export const CryptoDetail: React.FC = () => {
  const { symbol } = useParams<{ symbol: string }>();
  const navigate = useNavigate();
  const { preferences, isAuthenticated } = useAuth();
  const { tab, setTab, range, setRange } = useCoinPageParams(
    (preferences?.defaultTimeRange as TimeRange | undefined) ?? TimeRange.MONTH
  );

  const { data: cryptoData, loading: cryptoLoading } = useQuery(GET_CRYPTOCURRENCY, {
    variables: { symbol: symbol?.toUpperCase() },
    skip: !symbol,
  });

  // The price and moving average charts share one range, kept in the URL
  const { data: historyData, loading: historyLoading } = useQuery(GET_PRICE_HISTORY, {
    variables: { symbol: symbol?.toUpperCase(), timeRange: range },
    skip: !symbol,
  });

  const { data: statsData, loading: statsLoading } = useQuery(GET_MARKET_STATS, {
    variables: { symbol: symbol?.toUpperCase() },
    skip: !symbol,
  });

  const coinGeckoId: string | undefined = cryptoData?.cryptocurrency?.coinGeckoId;
  const { data: riskData, loading: riskLoading, error: riskError } = useQuery(GET_RISK_SUMMARY, {
    variables: { coinId: coinGeckoId },
    skip: !coinGeckoId || tab !== 'risk',
  });

  const coinLoaded = Boolean(cryptoData?.cryptocurrency);
  useEffect(() => {
    if (symbol && coinLoaded) {
      track('view_coin', { symbol: symbol.toUpperCase(), tab });
    }
  }, [symbol, coinLoaded, tab]);

  if (cryptoLoading || statsLoading) {
    return <LoadingSpinner />;
  }

  const crypto = cryptoData?.cryptocurrency;
  const priceHistory = historyData?.priceHistory;
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

  const formatPrice = (price?: number) => {
    if (price === undefined || price === null) return 'N/A';
    if (price < 0.01) return `$${price.toFixed(6)}`;
    if (price < 1) return `$${price.toFixed(4)}`;
    return `$${price.toLocaleString()}`;
  };

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "FinancialProduct",
    "name": crypto.name,
    "description": `${crypto.name} (${crypto.symbol}) - Real-time price, market cap, and analytics`,
    "category": "Cryptocurrency",
    "offers": {
      "@type": "Offer",
      "price": crypto.currentPrice,
      "priceCurrency": "USD",
      "availability": "https://schema.org/InStock"
    }
  };

  return (
    <>
      <SEO
        title={`${crypto.name} (${crypto.symbol}) Price & Analytics | CryptoQuantLab`}
        description={`Track ${crypto.name} (${crypto.symbol}) live price: ${formatPrice(crypto.currentPrice)}. View ${crypto.name} market cap, 24h trading volume, price charts, and detailed analytics.`}
        keywords={`${crypto.name}, ${crypto.symbol}, ${crypto.symbol.toLowerCase()} price, ${crypto.name.toLowerCase()} price, cryptocurrency, crypto analytics, ${crypto.symbol.toLowerCase()} chart`}
        canonicalUrl={`/crypto/${crypto.symbol}`}
        structuredData={structuredData}
      />
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

      <Tabs tabs={TABS} selected={tab} onSelect={setTab} idPrefix="coin" label={`${crypto.name} sections`} />

      {tab === 'overview' && (
        <div role="tabpanel" id={tabPanelId('coin', 'overview')} aria-labelledby={tabId('coin', 'overview')} className="space-y-6">
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
            <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
              <h2 className="text-xl font-semibold">Price Chart</h2>
              <TimeRangeSelector selected={range} onChange={setRange} />
            </div>
            {historyLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            ) : priceHistory && priceHistory.data.length > 0 ? (
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
            {priceHistory && priceHistory.data.length > 0 ? (
              <MovingAverageChart
                data={priceHistory.data}
                selectedTimeRange={range}
                onTimeRangeChange={setRange}
              />
            ) : historyLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No data available for moving averages</p>
            )}
          </div>

          {/* Crossover Alerts - only show when authenticated */}
          {isAuthenticated && crypto && (
            <NotificationRulesList
              coinId={crypto.coinGeckoId}
              coinSymbol={crypto.symbol}
            />
          )}

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
      )}

      {tab === 'risk' && (
        <div role="tabpanel" id={tabPanelId('coin', 'risk')} aria-labelledby={tabId('coin', 'risk')} className="space-y-6">
          <Disclaimer />
          <div className="card">
            {riskLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            ) : riskError ? (
              <p className="text-sm text-red-500">Couldn't load realized risk: {riskError.message}</p>
            ) : riskData?.riskSummary ? (
              <RiskSummaryPanel summary={riskData.riskSummary} />
            ) : null}
          </div>
          {riskData?.riskSummary?.garch && (
            <div className="card">
              <GarchPanel
                garch={riskData.riskSummary.garch}
                asOf={riskData.riskSummary.asOf}
                closes={riskData.riskSummary.observations}
              />
            </div>
          )}
        </div>
      )}
      </div>
    </>
  );
};
